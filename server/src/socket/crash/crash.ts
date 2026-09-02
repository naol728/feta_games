import { Server, Socket } from "socket.io";
import { randomInt } from "crypto";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
  playerId?: string;
  queueKey?: string | null;
  queueEntry?: string | null;
  roomId?: string;
}

type CrashPhase = "betting" | "running" | "crashed";

interface CrashPlayer {
  id: string;
  username: string;
  Fname: string;
  Lname: string;
  payout: number | null;
}

interface CrashCashoutData {
  userId: string;
  payout: number;
  multiplier: number;
  wallet: Awaited<ReturnType<typeof walletService.settleCrashWin>>;
}

interface CrashBetPayload {
  amount?: unknown;
  autoCashoutAt?: unknown;
}

interface CrashBetResult {
  ok?: boolean;
  roundId?: string | null;
  error?: string;
}

interface CrashCashoutResult {
  ok?: boolean;
  multiplier?: number;
  error?: string;
}

interface PublicGameState {
  gameBets: Record<string, number>;
  gamePlayers: Record<string, CrashPlayer>;
  gameStartTime: number | null;
  roundId: string | null;
  phase: CrashPhase;
}

interface GameState {
  gameBets: Record<string, number>;
  gamePlayers: Record<string, CrashPlayer>;
  autoCashouts: Record<string, number>;
  crashPoint: number;
  gameStartTime: number | null;
  roundId: string | null;
  phase: CrashPhase;
}

const freshState = (): GameState => ({
  gameBets: {},
  gamePlayers: {},
  autoCashouts: {},
  crashPoint: 1.01,
  gameStartTime: null,
  roundId: null,
  phase: "betting",
});

/**
 * Only expose information the frontend actually needs.
 *
 * IMPORTANT:
 * crashPoint is intentionally NOT included here.
 */
const publicState = (state: GameState) => ({
  gameBets: state.gameBets,
  gamePlayers: state.gamePlayers,
  gameStartTime: state.gameStartTime,
  roundId: state.roundId,
  phase: state.phase,
});

/**
 * Generate a crash point.
 *
 * Uses crypto randomness instead of Math.random().
 *
 * This is still NOT a full provably-fair implementation.
 * For production gambling, use a committed server seed/client seed
 * scheme and store the resulting hash/seed information.
 */
function generateCrashPoint(): number {
  const random = randomInt(0, 1_000_000) / 1_000_000;

  const crash = 1 / (1 - random);

  return Math.max(1.01, Math.min(1000, Math.floor(crash * 100) / 100));
}

/**
 * Calculate the current multiplier.
 */
function calculateMultiplierAt(elapsedMs: number): number {
  const multiplier = Math.exp(elapsedMs / 10_000);

  return Math.floor(multiplier * 100) / 100;
}

const crashGame = (io: Server, { bettingMs = 12_000, tickMs = 80 } = {}) => {
  let gameState: GameState = freshState();

  let stopped = false;

  let nextRound: NodeJS.Timeout | null = null;

  let ticker: NodeJS.Timeout | null = null;

  const pendingBets = new Set<string>();

  const pendingCashouts = new Set<string>();

  /**
   * --------------------------------
   * SEND STATE TO ONE SOCKET
   * --------------------------------
   */
  const sendState = (socket: CustomSocket) => {
    socket.emit("crash:sync", publicState(gameState));
  };

  /**
   * --------------------------------
   * SETTLE CASHOUT
   * --------------------------------
   */
  const settleCashout = async (
    userId: string,
    multiplier: number,
    notify: Function,
  ) => {
    const player = gameState.gamePlayers[userId];

    if (!player || player.payout != null || pendingCashouts.has(userId)) {
      return false;
    }

    const betAmount = gameState.gameBets[userId];

    if (!betAmount) {
      return false;
    }

    const payout = betAmount * multiplier;

    pendingCashouts.add(userId);

    try {
      const wallet = await walletService.settleCrashWin(
        userId,
        payout,
        betAmount,
      );

      player.payout = multiplier;

      io.emit("crash:gameState", publicState(gameState));

      notify({
        userId,
        payout,
        multiplier,
        wallet,
      });

      return true;
    } catch (err) {
      console.error("Cashout error:", err);
      return false;
    } finally {
      pendingCashouts.delete(userId);
    }
  };

  /**
   * --------------------------------
   * OPEN BETTING
   * --------------------------------
   */
  const openBetting = () => {
    if (stopped) {
      return;
    }

    gameState = freshState();

    gameState.roundId = `crash_${Date.now()}`;

    /**
     * Generate the crash point on the SERVER.
     *
     * It is NOT included in publicState().
     */
    gameState.crashPoint = generateCrashPoint();

    gameState.phase = "betting";

    io.emit("crash:gameState", publicState(gameState));

    nextRound = setTimeout(runRound, bettingMs);
  };

  /**
   * --------------------------------
   * RUN ROUND
   * --------------------------------
   */
  const runRound = () => {
    if (stopped) {
      return;
    }

    gameState.phase = "running";

    gameState.gameStartTime = Date.now();

    io.emit("crash:start", {
      roundId: gameState.roundId,
      gameStartTime: gameState.gameStartTime,
    });

    io.emit("crash:gameState", publicState(gameState));

    let ticking = false;

    const multiplierInterval = setInterval(async () => {
      if (stopped) {
        clearInterval(multiplierInterval);

        return;
      }

      if (ticking) {
        return;
      }

      ticking = true;

      try {
        await tick();
      } catch (err) {
        console.error("Crash tick error:", err);
      } finally {
        ticking = false;
      }
    }, tickMs);

    ticker = multiplierInterval;

    /**
     * --------------------------------
     * TICK
     * --------------------------------
     */
    const tick = async () => {
      if (!gameState.gameStartTime) {
        return;
      }

      const elapsedMs = Date.now() - gameState.gameStartTime;

      const currentMultiplier = calculateMultiplierAt(elapsedMs);

      /**
       * --------------------------------
       * AUTO CASHOUTS
       * --------------------------------
       */
      const dueAutoCashouts = Object.entries(gameState.autoCashouts).filter(
        ([, target]) =>
          target <= currentMultiplier && target < gameState.crashPoint,
      );

      if (dueAutoCashouts.length > 0) {
        await Promise.all(
          dueAutoCashouts.map(async ([userId, target]) => {
            delete gameState.autoCashouts[userId];

            await settleCashout(userId, target, (data) => {
              /**
               * The socket joins a room named
               * after the userId.
               */
              io.to(userId).emit("crash:cashoutSuccess", data);
            });
          }),
        );
      }

      /**
       * --------------------------------
       * CRASH
       * --------------------------------
       */
      if (currentMultiplier >= gameState.crashPoint) {
        clearInterval(multiplierInterval);

        ticker = null;

        gameState.phase = "crashed";

        /**
         * The final multiplier is exactly
         * the generated crash point.
         */
        io.emit("crash:multiplier", gameState.crashPoint);

        /**
         * --------------------------------
         * LOSING BETS
         * --------------------------------
         *
         * IMPORTANT:
         *
         * Do NOT call unlockBalance() here
         * if unlockBalance returns the locked
         * bet to the user's available balance.
         *
         * A losing bet must be CONSUMED from
         * locked_balance.
         *
         * You need a wallet service method such as:
         *
         * walletService.consumeLockedBalance(...)
         *
         * or
         *
         * walletService.settleLoss(...)
         *
         * Use the actual method from your
         * wallet.service.ts.
         */
        for (const [userId, player] of Object.entries(gameState.gamePlayers)) {
          if (player.payout === null) {
            const betAmount = gameState.gameBets[userId];

            if (!betAmount) continue;

            try {
              await walletService.consumeLockedBalance(userId, betAmount);

              console.log(`Player ${userId} lost ${betAmount} ETB.`);
            } catch (err) {
              console.error("Failed to settle losing bet:", userId, err);
            }
          }
        }

        /**
         * Tell clients the round crashed.
         *
         * This is the FIRST time crashPoint
         * is exposed.
         */
        io.emit("crash:result", gameState.crashPoint);

        io.emit("crash:reveal", {
          roundId: gameState.roundId,
          crashPoint: gameState.crashPoint,
        });

        io.emit("crash:gameState", publicState(gameState));

        /**
         * Start next betting round.
         */
        openBetting();

        return;
      }

      /**
       * --------------------------------
       * NORMAL MULTIPLIER UPDATE
       * --------------------------------
       */
      io.emit("crash:multiplier", currentMultiplier);
    };
  };

  /**
   * --------------------------------
   * REGISTER ONE CONNECTED SOCKET
   * --------------------------------
   */
  const registerSocket = (socket: CustomSocket) => {
    /**
     * Join a private room using userId.
     *
     * This makes:
     *
     * io.to(userId).emit(...)
     *
     * work.
     */
    socket.join(socket.user.userId);

    /**
     * Send current game immediately.
     */
    sendState(socket);

    /**
     * Client asks for current state.
     */
    socket.on("crash:requestState", () => {
      sendState(socket);
    });

    /**
     * --------------------------------
     * BET
     * --------------------------------
     */
    socket.on(
      "crash:bet",
      async (bet: unknown, callback?: (result: any) => void) => {
        const reply = (result: any) => {
          if (typeof callback === "function") {
            callback(result);
          }
        };

        try {
          const userId = socket.user?.userId;

          if (!userId) {
            return reply({
              error: "You must be logged in to bet",
            });
          }

          /**
           * Only betting phase accepts bets.
           */
          if (gameState.phase !== "betting") {
            return reply({
              error: "Betting is closed for this round",
            });
          }

          const payload =
            typeof bet === "object" && bet !== null
              ? (bet as {
                  amount?: unknown;
                  autoCashoutAt?: unknown;
                })
              : {
                  amount: bet,
                };

          const amount = Number(payload.amount);

          const autoCashoutAt =
            payload.autoCashoutAt == null
              ? null
              : Number(payload.autoCashoutAt);

          /**
           * Integer ETB bet.
           */
          if (!Number.isInteger(amount) || amount < 10 || amount > 1_000_000) {
            return reply({
              error: "minimum bet 10 ETB",
            });
          }

          /**
           * Validate auto cashout.
           */
          if (
            autoCashoutAt !== null &&
            (!Number.isFinite(autoCashoutAt) ||
              autoCashoutAt < 1.01 ||
              autoCashoutAt > 1000)
          ) {
            return reply({
              error: "Invalid auto cashout target",
            });
          }

          /**
           * Prevent duplicate bet.
           */
          if (
            gameState.gameBets[userId] !== undefined ||
            pendingBets.has(userId)
          ) {
            return reply({
              error: "You already have a bet this round",
            });
          }

          pendingBets.add(userId);

          try {
            /**
             * Lock balance atomically.
             */
            const locked = await walletService.lockandchcekBalance(
              userId,
              amount,
            );

            if (!locked) {
              return reply({
                error: "Insufficient funds",
              });
            }

            /**
             * Get ONLY data required by LiveBets.
             *
             * Do NOT select wallet information.
             */
            const { data: user, error } = await supabase
              .from("users")
              .select("id, username, Fname, Lname")
              .eq("id", userId)
              .single();

            if (error || !user) {
              /**
               * User lookup failed, so return
               * the locked balance.
               */
              await walletService.unlockBalance(userId);

              return reply({
                error: "User not found",
              });
            }

            /**
             * Save bet.
             */
            gameState.gameBets[userId] = amount;

            /**
             * Save auto cashout.
             */
            if (autoCashoutAt !== null) {
              gameState.autoCashouts[userId] = autoCashoutAt;
            }

            /**
             * Save SAFE public player data.
             */
            gameState.gamePlayers[userId] = {
              id: user.id,
              username: user.username ?? "",
              Fname: user.Fname ?? "",
              Lname: user.Lname ?? "",
              payout: null,
            };

            /**
             * Broadcast updated live bets.
             */
            io.emit("crash:gameState", publicState(gameState));

            return reply({
              ok: true,
              roundId: gameState.roundId,
            });
          } finally {
            pendingBets.delete(userId);
          }
        } catch (err) {
          console.error("Crash bet error:", err);

          return reply({
            error: "Could not place the bet",
          });
        }
      },
    );

    /**
     * --------------------------------
     * CASHOUT
     * --------------------------------
     */
    socket.on("crash:cashout", async (callback?: (result: any) => void) => {
      const done = (result?: any) => {
        if (typeof callback === "function") {
          callback(result);
        }
      };

      try {
        const userId = socket.user?.userId;

        if (!userId) {
          return done({
            error: "You must be logged in",
          });
        }

        /**
         * Must be running.
         */
        if (gameState.phase !== "running" || !gameState.gameStartTime) {
          return done({
            error: "Game is not running",
          });
        }

        const player = gameState.gamePlayers[userId];

        if (!player) {
          return done({
            error: "You don't have a bet",
          });
        }

        if (player.payout !== null) {
          return done({
            error: "Already cashed out",
          });
        }

        if (pendingCashouts.has(userId)) {
          return done({
            error: "Cashout already processing",
          });
        }

        const currentMultiplier = calculateMultiplierAt(
          Date.now() - gameState.gameStartTime,
        );

        /**
         * Crash already happened.
         */
        if (currentMultiplier >= gameState.crashPoint) {
          return done({
            error: "Too late",
          });
        }

        /**
         * Remove auto cashout because
         * user manually cashed out.
         */
        delete gameState.autoCashouts[userId];

        const success = await settleCashout(
          userId,
          currentMultiplier,
          (data) => {
            socket.emit("crash:cashoutSuccess", data);
          },
        );

        if (!success) {
          return done({
            error: "Cashout failed",
          });
        }

        return done({
          ok: true,
          multiplier: currentMultiplier,
        });
      } catch (err) {
        console.error("Crash cashout error:", err);

        return done({
          error: "Cashout failed",
        });
      }
    });

    /**
     * Remove crash listeners when
     * this socket disconnects.
     *
     * The actual game DOES NOT stop.
     */
    socket.on("disconnect", () => {
      socket.removeAllListeners("crash:requestState");

      socket.removeAllListeners("crash:bet");

      socket.removeAllListeners("crash:cashout");
    });
  };

  /**
   * Start game ONCE.
   */
  openBetting();

  /**
   * Stop global game.
   */
  const stop = () => {
    stopped = true;

    if (nextRound) {
      clearTimeout(nextRound);
      nextRound = null;
    }

    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };

  return {
    registerSocket,
    stop,
  };
};

/**
 * ========================================
 * GLOBAL CRASH GAME INSTANCE
 * ========================================
 *
 * There should be only ONE crash game running
 * for this Node.js process.
 */
let crashGameInstance: ReturnType<typeof crashGame> | null = null;

/**
 * ========================================
 * CRASH SOCKET MODULE
 * ========================================
 */
export default function Crash(io: Server, socket: CustomSocket) {
  /**
   * Create the game only once.
   */
  if (!crashGameInstance) {
    crashGameInstance = crashGame(io);
  }

  /**
   * Register THIS user's socket.
   */
  crashGameInstance.registerSocket(socket);
}

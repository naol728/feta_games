/* eslint-disable */
import { Server, Socket } from "socket.io";
import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import { wageringService } from "../../services/waggering.service";

// ======================== TYPES ========================

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
  wallet?: any;
  error?: string;
}

interface CrashCashoutResult {
  ok?: boolean;
  multiplier?: number;
  wallet?: any;
  error?: string;
}

// Public state (what clients see)
interface PublicGameState {
  gameBets: Record<string, number>;
  gamePlayers: Record<string, CrashPlayer>;
  gameStartTime: number | null;
  roundId: string | null;
  phase: CrashPhase;
}

// Internal state (crashPoint kept secret)
interface GameState {
  gameBets: Map<string, number>;
  gamePlayers: Map<string, CrashPlayer>;
  autoCashouts: Map<string, number>;
  crashPoint: number;
  gameStartTime: number | null;
  roundId: string | null;
  phase: CrashPhase;
}

// ======================== UTILITIES ========================

const freshState = (): GameState => ({
  gameBets: new Map(),
  gamePlayers: new Map(),
  autoCashouts: new Map(),
  crashPoint: 1.01,
  gameStartTime: null,
  roundId: null,
  phase: "betting",
});

const publicState = (state: GameState): PublicGameState => ({
  gameBets: Object.fromEntries(state.gameBets),
  gamePlayers: Object.fromEntries(state.gamePlayers),
  gameStartTime: state.gameStartTime,
  roundId: state.roundId,
  phase: state.phase,
});

/**
 * Generate crash point with 95% RTP (5% house edge).
 * Uses fast Math.random() – NOT cryptographically secure.
 */
function generateCrashPoint(): number {
  const random = Math.random();
  let crash = 0.95 / (1 - random);
  if (crash < 1.01) crash = 1.01;
  if (crash > 1000) crash = 1000;
  return Math.floor(crash * 100) / 100;
}

function calculateMultiplierAt(elapsedMs: number): number {
  return Math.floor(Math.exp(elapsedMs / 10_000) * 100) / 100;
}

/**
 * Record a transaction – kept separate for clarity.
 */
const recordCrashTransaction = async (params: {
  userId: string;
  type: "win" | "lose";
  amount: number;
  roundId: string | null;
  multiplier?: number;
}): Promise<void> => {
  const { userId, type, amount, roundId, multiplier } = params;
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount,
    status: "completed",
    reference_id: `crash_${roundId ?? "unknown"}_${userId}_${type}`,
    metadata: {
      game: "crash",
      round_id: roundId,
      ...(multiplier !== undefined ? { multiplier } : {}),
    },
  });
  if (error) console.error("Failed to record crash transaction:", error);
};

// ======================== GAME ENGINE ========================

const crashGame = (io: Server, { bettingMs = 12_000, tickMs = 80 } = {}) => {
  let gameState = freshState();
  let stopped = false;
  let nextRound: NodeJS.Timeout | null = null;
  let ticker: NodeJS.Timeout | null = null;

  const pendingBets = new Set<string>();
  const pendingCashouts = new Set<string>();

  const sendState = (socket: CustomSocket) => {
    socket.emit("crash:sync", publicState(gameState));
  };

  /**
   * Settle a single cashout – returns true on success.
   */
  const settleCashout = async (
    userId: string,
    multiplier: number,
    notify: (data: CrashCashoutData) => void,
  ): Promise<boolean> => {
    const player = gameState.gamePlayers.get(userId);
    if (!player || player.payout !== null || pendingCashouts.has(userId)) {
      return false;
    }
    const betAmount = gameState.gameBets.get(userId);
    if (!betAmount) return false;

    const payout = betAmount * multiplier;
    pendingCashouts.add(userId);

    try {
      await walletService.settleCrashWin(userId, payout, betAmount);
      const wallet = await walletService.getWallet(userId);
      await Promise.all([
        supabase.rpc("record_daily_activity", {
          p_user_id: userId,
          p_activity_type: "played",
        }),
        recordCrashTransaction({
          userId,
          type: "win",
          amount: payout,
          roundId: gameState.roundId,
          multiplier,
        }),
      ]);

      player.payout = multiplier;
      io.emit("crash:gameState", publicState(gameState));
      notify({ userId, payout, multiplier, wallet });
      return true;
    } catch (err) {
      console.error("Cashout error:", err);
      return false;
    } finally {
      pendingCashouts.delete(userId);
    }
  };

  /**
   * Open betting phase.
   */
  const openBetting = () => {
    if (stopped) return;
    gameState = freshState();
    gameState.roundId = `crash_${Date.now()}`;
    gameState.crashPoint = generateCrashPoint();
    gameState.phase = "betting";
    io.emit("crash:gameState", publicState(gameState));
    nextRound = setTimeout(runRound, bettingMs);
  };

  /**
   * Run the round – start multiplier ticker.
   */
  const runRound = () => {
    if (stopped) return;
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
      if (ticking) return;
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
     * Tick function – called every tickMs.
     */
    const tick = async (): Promise<void> => {
      if (!gameState.gameStartTime) return;

      const elapsedMs = Date.now() - gameState.gameStartTime;
      const currentMultiplier = calculateMultiplierAt(elapsedMs);

      // ---- AUTO CASHOUTS ----
      const dueAutoCashouts: [string, number][] = [];
      for (const [userId, target] of gameState.autoCashouts) {
        if (target <= currentMultiplier && target < gameState.crashPoint) {
          dueAutoCashouts.push([userId, target]);
        }
      }

      if (dueAutoCashouts.length > 0) {
        await Promise.all(
          dueAutoCashouts.map(async ([userId, target]) => {
            gameState.autoCashouts.delete(userId);
            await settleCashout(userId, target, (data) => {
              io.to(userId).emit("crash:cashoutSuccess", data);
            });
          }),
        );
      }

      // ---- CRASH CONDITION ----
      if (currentMultiplier >= gameState.crashPoint) {
        clearInterval(multiplierInterval);
        ticker = null;
        gameState.phase = "crashed";

        io.emit("crash:multiplier", gameState.crashPoint);

        // Settle all losing bets in parallel
        const lossPromises: Promise<void>[] = [];
        for (const [userId, player] of gameState.gamePlayers) {
          if (player.payout === null) {
            const betAmount = gameState.gameBets.get(userId);
            if (!betAmount) continue;
            lossPromises.push(
              (async () => {
                try {
                  await walletService.consumeLockedBalance(userId, betAmount);
                  await Promise.all([
                    supabase.rpc("record_daily_activity", {
                      p_user_id: userId,
                      p_activity_type: "played",
                    }),
                    recordCrashTransaction({
                      userId,
                      type: "lose",
                      amount: betAmount,
                      roundId: gameState.roundId,
                    }),
                  ]);

                  // --- Send updated wallet to the losing user ---
                  const wallet = await walletService.getWallet(userId);
                  io.to(userId).emit("crash:wallet", wallet);
                } catch (err) {
                  console.error("Failed to settle losing bet:", userId, err);
                }
              })(),
            );
          }
        }
        await Promise.all(lossPromises);

        // Emit final results
        io.emit("crash:result", gameState.crashPoint);
        io.emit("crash:reveal", {
          roundId: gameState.roundId,
          crashPoint: gameState.crashPoint,
        });
        io.emit("crash:gameState", publicState(gameState));

        openBetting();
        return;
      }

      // ---- NORMAL MULTIPLIER UPDATE ----
      io.emit("crash:multiplier", currentMultiplier);
    };
  };

  // ======================== SOCKET REGISTRATION ========================

  const registerSocket = (socket: CustomSocket) => {
    socket.join(socket.user.userId);
    sendState(socket);

    socket.on("crash:requestState", () => {
      sendState(socket);
    });

    // ---- BET ----
    socket.on(
      "crash:bet",
      async (
        bet: unknown,
        callback?: (result: CrashBetResult) => void,
      ): Promise<void> => {
        const reply = (result: CrashBetResult) => {
          if (typeof callback === "function") callback(result);
        };

        try {
          const userId = socket.user?.userId;
          if (!userId) {
            return reply({ error: "You must be logged in to bet" });
          }

          if (gameState.phase !== "betting") {
            return reply({ error: "Betting is closed for this round" });
          }

          const payload =
            typeof bet === "object" && bet !== null
              ? (bet as CrashBetPayload)
              : { amount: bet };

          const amount = Number(payload.amount);
          const autoCashoutAt =
            payload.autoCashoutAt == null
              ? null
              : Number(payload.autoCashoutAt);

          if (!Number.isFinite(amount) || amount < 10 || amount > 1_000_000) {
            return reply({
              error: "Minimum bet 10 ETB, maximum 1,000,000 ETB",
            });
          }

          if (
            autoCashoutAt !== null &&
            (!Number.isFinite(autoCashoutAt) ||
              autoCashoutAt < 1.01 ||
              autoCashoutAt > 1000)
          ) {
            return reply({ error: "Invalid auto cashout target" });
          }

          if (gameState.gameBets.has(userId) || pendingBets.has(userId)) {
            return reply({ error: "You already have a bet this round" });
          }

          pendingBets.add(userId);
          try {
            const locked = await walletService.lockandchcekBalance(
              userId,
              amount,
            );
            if (!locked) {
              return reply({ error: "Insufficient funds" });
            }

            await wageringService.recordWager(
              userId,
              amount,
              "Crash",
              gameState.roundId,
            );

            // Fetch user info – minimal fields
            const { data: user, error } = await supabase
              .from("users")
              .select("id, username, Fname, Lname")
              .eq("id", userId)
              .single();

            if (error || !user) {
              await walletService.unlockBalance(userId);
              return reply({ error: "User not found" });
            }

            gameState.gameBets.set(userId, amount);
            if (autoCashoutAt !== null) {
              gameState.autoCashouts.set(userId, autoCashoutAt);
            }
            gameState.gamePlayers.set(userId, {
              id: user.id,
              username: user.username ?? "",
              Fname: user.Fname ?? "",
              Lname: user.Lname ?? "",
              payout: null,
            });

            const wallet = await walletService.getWallet(userId);
            io.emit("crash:gameState", publicState(gameState));
            return reply({ ok: true, roundId: gameState.roundId, wallet });
          } finally {
            pendingBets.delete(userId);
          }
        } catch (err) {
          console.error("Crash bet error:", err);
          return reply({ error: "Could not place the bet" });
        }
      },
    );

    // ---- CASHOUT ----
    socket.on(
      "crash:cashout",
      async (
        callback?: (result: CrashCashoutResult) => void,
      ): Promise<void> => {
        const done = (result: CrashCashoutResult) => {
          if (typeof callback === "function") callback(result);
        };

        try {
          const userId = socket.user?.userId;
          if (!userId) {
            return done({ error: "You must be logged in" });
          }

          if (gameState.phase !== "running" || !gameState.gameStartTime) {
            return done({ error: "Game is not running" });
          }

          const player = gameState.gamePlayers.get(userId);
          if (!player) {
            return done({ error: "You don't have a bet" });
          }
          if (player.payout !== null) {
            return done({ error: "Already cashed out" });
          }
          if (pendingCashouts.has(userId)) {
            return done({ error: "Cashout already processing" });
          }

          const currentMultiplier = calculateMultiplierAt(
            Date.now() - gameState.gameStartTime,
          );

          if (currentMultiplier >= gameState.crashPoint) {
            return done({ error: "Too late" });
          }

          gameState.autoCashouts.delete(userId);

          let cashoutWallet: any = null;
          const success = await settleCashout(
            userId,
            currentMultiplier,
            (data) => {
              cashoutWallet = data.wallet;
              socket.emit("crash:cashoutSuccess", data);
            },
          );

          if (!success) {
            return done({ error: "Cashout failed" });
          }

          // If for some reason wallet wasn't attached, fetch it
          if (!cashoutWallet) {
            cashoutWallet = await walletService.getWallet(userId);
          }

          return done({
            ok: true,
            multiplier: currentMultiplier,
            wallet: cashoutWallet,
          });
        } catch (err) {
          console.error("Crash cashout error:", err);
          return done({ error: "Cashout failed" });
        }
      },
    );

    socket.on("disconnect", () => {
      socket.removeAllListeners("crash:requestState");
      socket.removeAllListeners("crash:bet");
      socket.removeAllListeners("crash:cashout");
    });
  };

  openBetting();

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

  return { registerSocket, stop };
};

// ======================== SINGLETON INSTANCE ========================

let crashGameInstance: ReturnType<typeof crashGame> | null = null;

export default function Crash(io: Server, socket: CustomSocket) {
  if (!crashGameInstance) {
    crashGameInstance = crashGame(io);
  }
  crashGameInstance.registerSocket(socket);
}

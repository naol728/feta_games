import { Server, Socket } from "socket.io";
import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";

interface CustomSocket extends Socket {
  user?: { userId: string; telegramId: number };
  userId?: string;
}

const freshState = () => ({
  gameBets: {} as Record<string, number>,
  gamePlayers: {} as Record<string, any>,
  autoCashouts: {} as Record<string, number>,
  crashPoint: 1.0,
  gameStartTime: null as number | null,
  roundId: null as string | null,
});

type GameState = ReturnType<typeof freshState>;

const publicState = (state: GameState) => ({
  gameBets: state.gameBets,
  gamePlayers: state.gamePlayers,
  gameStartTime: state.gameStartTime,
  roundId: state.roundId,
});

// Generate crash point based on simple algorithm
function generateCrashPoint(): number {
  const random = Math.random();
  const crash = 1 / (1 - random);
  return Math.max(1.01, Math.min(1000, Math.floor(crash * 100) / 100));
}

// Calculate multiplier based on elapsed time and crash point
function calculateMultiplierAt(elapsedMs: number, crashPoint: number): number {
  // Exponential growth curve
  return Math.floor(Math.exp(elapsedMs / 10000) * 100) / 100;
}

const crashGame = (
  io: Server,
  { bettingMs = 12000, tickMs = 80, retryMs = 2000 } = {},
) => {
  let gameState: GameState = freshState();
  let bettingOpen = false;
  const pendingBets = new Set<string>();
  const pendingCashouts = new Set<string>();
  let stopped = false;
  let nextRound: NodeJS.Timeout | null = null;
  let ticker: NodeJS.Timeout | null = null;

  io.on("connection", (socket: CustomSocket) => {
    const sendState = () =>
      socket.emit("crash:sync", {
        phase: bettingOpen
          ? "betting"
          : gameState.gameStartTime
            ? "running"
            : "idle",
        ...publicState(gameState),
      });

    sendState();
    socket.on("crash:requestState", sendState);

    socket.on("crash:bet", async (bet: any, callback?: Function) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        const userId = socket.user?.playerId;
        if (!userId) return reply({ error: "You must be logged in to bet" });
        if (!bettingOpen)
          return reply({ error: "Betting is closed for this round" });

        const payload =
          typeof bet === "object" && bet !== null ? bet : { amount: bet };
        const amount = payload.amount;
        const autoCashoutAt = payload.autoCashoutAt ?? null;

        if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) {
          return reply({ error: "Invalid bet amount" });
        }

        if (
          autoCashoutAt !== null &&
          (!Number.isFinite(autoCashoutAt) || autoCashoutAt < 1.01)
        ) {
          return reply({ error: "Invalid auto cashout target" });
        }

        if (
          gameState.gameBets.hasOwnProperty(userId) ||
          pendingBets.has(userId)
        ) {
          return reply({ error: "You already have a bet this round" });
        }

        pendingBets.add(userId);
        try {
          // Check and lock balance
          const locked = await walletService.lockandchcekBalance(
            userId,
            amount,
          );
          if (!locked) {
            return reply({ error: "Insufficient funds" });
          }

          // Get user data for display
          const { data: user } = await supabase
            .from("users")
            .select("id, username, profile_picture, level")
            .eq("id", userId)
            .single();

          if (!user) {
            await walletService.unlockBalance(userId);
            return reply({ error: "User not found" });
          }

          gameState.gameBets[userId] = amount;
          if (autoCashoutAt) gameState.autoCashouts[userId] = autoCashoutAt;
          gameState.gamePlayers[userId] = {
            userId,
            username: user.username,
            profilePicture: user.profile_picture,
            level: user.level,
            payout: null,
          };

          io.emit("crash:gameState", publicState(gameState));
          reply({ ok: true });
        } finally {
          pendingBets.delete(userId);
        }
      } catch (err: any) {
        console.error("Crash bet error:", err);
        reply({ error: "Could not place the bet" });
      }
    });

    socket.on("crash:cashout", async (callback?: Function) => {
      const done = () => {
        if (typeof callback === "function") callback();
      };

      try {
        const userId = socket.user?.userId;
        const player = userId && gameState.gamePlayers[userId];

        if (
          !userId ||
          !player ||
          player.payout != null ||
          pendingCashouts.has(userId)
        ) {
          return done();
        }

        const currentMultiplier = calculateMultiplierAt(
          gameState.gameStartTime ? Date.now() - gameState.gameStartTime : 0,
          gameState.crashPoint,
        );

        if (currentMultiplier < gameState.crashPoint) {
          delete gameState.autoCashouts[userId];
          await settleCashout(userId, currentMultiplier, (data: any) =>
            socket.emit("crash:cashoutSuccess", data),
          );
        }

        return done();
      } catch (err: any) {
        console.error("Crash cashout error:", err);
        return done();
      }
    });
  });

  const settleCashout = async (
    userId: string,
    multiplier: number,
    notify: Function,
  ) => {
    const player = gameState.gamePlayers[userId];
    if (!player || player.payout != null || pendingCashouts.has(userId))
      return false;

    const betAmount = gameState.gameBets[userId];
    const payout = betAmount * multiplier;

    pendingCashouts.add(userId);
    try {
      // Add the payout to wallet
      await walletService.addBalance(userId, payout);

      // Unlock any locked balance (return original bet amount)
      await walletService.unlockBalance(userId);

      player.payout = multiplier;
      io.emit("crash:gameState", publicState(gameState));

      notify({ userId, payout, multiplier });
      return true;
    } catch (err: any) {
      console.error("Cashout error:", err);
      return false;
    } finally {
      pendingCashouts.delete(userId);
    }
  };

  const openBetting = async () => {
    if (stopped) return;
    gameState = freshState();
    gameState.roundId = `crash_${Date.now()}`;
    gameState.crashPoint = generateCrashPoint();
    bettingOpen = true;

    io.emit("crash:gameState", publicState(gameState));
    nextRound = setTimeout(runRound, bettingMs);
  };

  const runRound = async () => {
    if (stopped) return;
    bettingOpen = false;
    io.emit("crash:start");

    gameState.gameStartTime = Date.now();

    let ticking = false;
    const multiplierInterval = setInterval(async () => {
      if (stopped) return clearInterval(multiplierInterval);
      if (ticking) return;
      ticking = true;
      try {
        await tick();
      } finally {
        ticking = false;
      }
    }, tickMs);

    const tick = async () => {
      const currentMultiplier = calculateMultiplierAt(
        gameState.gameStartTime ? Date.now() - gameState.gameStartTime : 0,
        gameState.crashPoint,
      );

      // Process auto cashouts
      const due = Object.entries(gameState.autoCashouts).filter(
        ([, target]) =>
          target <= currentMultiplier && target < gameState.crashPoint,
      );

      if (due.length) {
        for (const [userId] of due) delete gameState.autoCashouts[userId];
        await Promise.all(
          due.map(([userId, target]) =>
            settleCashout(userId, target, (data: any) =>
              io.to(userId).emit("crash:cashoutSuccess", data),
            ).catch((err: any) => console.error("Auto cashout error:", err)),
          ),
        );
      }

      if (currentMultiplier >= gameState.crashPoint) {
        clearInterval(multiplierInterval);
        ticker = null;

        // Handle losing bets - unlock the balance (no payout)
        for (const [userId, player] of Object.entries(gameState.gamePlayers)) {
          if (player.payout == null) {
            // Player didn't cash out in time - they lost
            try {
              await walletService.unlockBalance(userId);
            } catch (err: any) {
              console.error("Failed to unlock balance for user:", userId, err);
            }
          }
        }

        io.emit("crash:result", gameState.crashPoint);
        io.emit("crash:reveal", {
          roundId: gameState.roundId,
          crashPoint: gameState.crashPoint,
        });

        openBetting();
      } else {
        io.emit("crash:multiplier", currentMultiplier);
      }
    };

    ticker = multiplierInterval;
  };

  openBetting();

  return () => {
    stopped = true;
    bettingOpen = false;
    if (nextRound) clearTimeout(nextRound);
    if (ticker) clearInterval(ticker);
  };
};

let stopGame: (() => void) | null = null;

export default function Crash(io: Server, socket: CustomSocket) {
  // Set userId from the socket's user data
  if (socket.user?.userId) {
    socket.userId = socket.user.userId;
  }

  // Initialize crash game on first connection
  if (!stopGame) {
    stopGame = crashGame(io);
  }
}

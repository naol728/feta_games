/* eslint-disable */
import { randomInt, randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";

// ============================================================
// TYPES
// ============================================================
interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

interface Wallet {
  balance: number;
  locked_balance: number;
  withdrawable_balance: number;
  available_balance: number;
}

type DifficultyKey = "easy" | "medium" | "hard";

interface DifficultyConfig {
  survivalChance: number;
  label: string;
}

interface ActiveGame {
  userId: string;
  socketId: string;
  roundId: string;
  betAmount: number;
  difficulty: DifficultyKey;
  cleared: number;
  multiplier: number;
  atObstacle: boolean;
  startedAt: number;
}

interface ErrorReply {
  error: string;
}

interface StartOkReply {
  ok: true;
  difficulty: DifficultyKey;
  cleared: number;
  multiplier: number;
  nextMultiplier: number;
  betAmount: number;
  wallet: Wallet | null;
}

interface ObstacleOkReply {
  ok: true;
  cleared: number;
  multiplier: number;
  nextMultiplier: number;
}

interface JumpOkReply {
  ok: true;
  survived: boolean;
  cleared: number;
  multiplier: number;
  nextMultiplier?: number;
  roll: number;
  wallet?: Wallet | null;
}

interface CashoutOkReply {
  ok: true;
  cleared: number;
  multiplier: number;
  payout: number;
  wallet: Wallet | null;
}

/**
 * Crash reply. `ignored: true` means the server saw a crash signal
 * while the dino was waiting at a tree — the game is still alive.
 */
interface CrashOkReply {
  ok: true;
  ignored?: boolean;
  cleared: number;
  multiplier: number;
  payout: number;
  wallet: Wallet | null;
}

// ============================================================
// CONFIG
// ============================================================
const RTP = 0.99;

const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  easy: { survivalChance: 0.85, label: "Easy" },
  medium: { survivalChance: 0.65, label: "Medium" },
  hard: { survivalChance: 0.45, label: "Hard" },
};

const MIN_BET = 1;
const MAX_BET = 50_000;
const MAX_CLEARED = 60;

/** A game alive longer than this is force-settled by the janitor. */
const MAX_GAME_DURATION_MS = 10 * 60 * 1000;
const JANITOR_INTERVAL_MS = 60 * 1000;

/** If an in-flight op never unlocks (DB hang), auto-release after this. */
const INFLIGHT_TIMEOUT_MS = 15 * 1000;

/** Minimum gap between `deno:start` calls per user (anti-spam). */
const START_COOLDOWN_MS = 500;

// ============================================================
// STATE (per-process)
// ============================================================
const activeGames = new Map<string, ActiveGame>();
const inFlight = new Map<string, number>(); // userId -> lockedAt
const startCooldown = new Map<string, number>(); // userId -> lastStartAt

// ============================================================
// IN-FLIGHT GUARDS
// ============================================================
function isInFlight(userId: string): boolean {
  const ts = inFlight.get(userId);
  if (ts === undefined) return false;
  if (Date.now() - ts > INFLIGHT_TIMEOUT_MS) {
    inFlight.delete(userId);
    return false;
  }
  return true;
}

function markInFlight(userId: string): void {
  inFlight.set(userId, Date.now());
}

function clearInFlight(userId: string): void {
  inFlight.delete(userId);
}

function isOnCooldown(userId: string): boolean {
  const ts = startCooldown.get(userId) ?? 0;
  return Date.now() - ts < START_COOLDOWN_MS;
}

function markCooldown(userId: string): void {
  startCooldown.set(userId, Date.now());
}

// ============================================================
// MATH
// ============================================================
function getMultiplier(difficulty: DifficultyKey, cleared: number): number {
  if (cleared <= 0) return 1.0;
  const diff = DIFFICULTIES[difficulty];
  const prob = Math.pow(diff.survivalChance, cleared);
  const pure = RTP / prob;
  return parseFloat((Math.floor(pure * 100) / 100).toFixed(2));
}

const RANGE = 2 ** 47;
function secureRoll(): number {
  return randomInt(0, RANGE) / RANGE;
}

// ============================================================
// WALLET BRIDGE
// ============================================================
async function readWallet(userId: string): Promise<Wallet | null> {
  try {
    const data = await walletService.getWallet(userId);
    return (data as Wallet) ?? null;
  } catch (err) {
    console.error("[dino] readWallet failed", userId, err);
    return null;
  }
}

async function lockBet(userId: string, amount: number): Promise<Wallet | null> {
  try {
    const data = await walletService.lockandchcekBalance(userId, amount);
    if (!data) return null;
    return await readWallet(userId);
  } catch (err) {
    console.error("[dino] lockBet failed", userId, amount, err);
    return null;
  }
}

async function settleWin(game: ActiveGame): Promise<Wallet | null> {
  const payout = Math.round(game.betAmount * game.multiplier * 100) / 100;
  try {
    await walletService.settleCrashWin(game.userId, payout, game.betAmount);
  } catch (err) {
    console.error("[dino] settleWin failed", game.roundId, err);
  }
  return readWallet(game.userId);
}

async function settleLoss(game: ActiveGame): Promise<Wallet | null> {
  try {
    await walletService.consumeLockedBalance(game.userId, game.betAmount);
  } catch (err) {
    console.error("[dino] settleLoss failed", game.roundId, err);
  }
  return readWallet(game.userId);
}

async function refund(game: ActiveGame): Promise<Wallet | null> {
  try {
    await walletService.unlockBalance(game.userId);
  } catch (err) {
    console.error("[dino] refund failed", game.roundId, err);
  }
  return readWallet(game.userId);
}

async function cleanupExistingGame(userId: string): Promise<Wallet | null> {
  const existing = activeGames.get(userId);
  if (!existing) return null;

  activeGames.delete(userId);

  if (existing.cleared > 0) return settleWin(existing);
  return refund(existing);
}

// ============================================================
// JANITOR
// ============================================================
let janitorHandle: NodeJS.Timeout | null = null;

function startJanitor(): void {
  if (janitorHandle) return;
  janitorHandle = setInterval(async () => {
    const now = Date.now();
    for (const [userId, game] of activeGames.entries()) {
      const age = now - game.startedAt;
      if (age < MAX_GAME_DURATION_MS) continue;

      activeGames.delete(userId);
      clearInFlight(userId);

      if (game.cleared > 0) {
        await settleWin(game);
      } else {
        await refund(game);
      }
    }
  }, JANITOR_INTERVAL_MS);
}

function stopJanitor(): void {
  if (janitorHandle) {
    clearInterval(janitorHandle);
    janitorHandle = null;
  }
}

/** Force-settle every active game — used on graceful shutdown. */
async function forceSettleAll(): Promise<void> {
  const entries = Array.from(activeGames.entries());
  activeGames.clear();
  inFlight.clear();

  await Promise.allSettled(
    entries.map(([, game]) =>
      game.cleared > 0 ? settleWin(game) : refund(game),
    ),
  );
}

startJanitor();

process.once("SIGTERM", () => {
  stopJanitor();
  void forceSettleAll();
});
process.once("SIGINT", () => {
  stopJanitor();
  void forceSettleAll();
});

// ============================================================
// HELPERS
// ============================================================
const makeReply =
  <T>(callback?: (r: T | ErrorReply) => void) =>
  (r: T | ErrorReply): void => {
    if (typeof callback === "function") {
      try {
        callback(r);
      } catch (err) {
        console.error("[dino] reply callback threw", err);
      }
    }
  };

const isOwner = (game: ActiveGame, socket: Socket): boolean =>
  game.socketId === socket.id;

// ============================================================
// SOCKET HANDLERS
// ============================================================
const registerSocket = (socket: CustomSocket): void => {
  const userId = socket.user?.userId;
  if (userId) socket.join(userId);

  const sendState = (): void => {
    socket.emit("deno:sync", {
      difficulties: (
        Object.entries(DIFFICULTIES) as [DifficultyKey, DifficultyConfig][]
      ).map(([key, v]) => ({
        key,
        label: v.label,
        survivalChance: v.survivalChance,
      })),
      rtp: RTP,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      maxCleared: MAX_CLEARED,
    });
  };

  sendState();
  socket.on("deno:requestState", sendState);

  // ------------------------------------------------------------------
  // deno:start
  // ------------------------------------------------------------------
  socket.on(
    "deno:start",
    async (
      payload: unknown,
      callback?: (r: StartOkReply | ErrorReply) => void,
    ): Promise<void> => {
      const reply = makeReply<StartOkReply>(callback);

      try {
        if (!userId) return reply({ error: "You must be logged in" });
        if (isInFlight(userId)) return reply({ error: "Please wait" });
        if (isOnCooldown(userId)) return reply({ error: "Please slow down" });

        markInFlight(userId);
        markCooldown(userId);

        // Always clear any lingering game (fixes "already in progress").
        await cleanupExistingGame(userId);

        const body =
          typeof payload === "object" && payload !== null
            ? (payload as { amount?: unknown; difficulty?: unknown })
            : {};

        const amount = Number(body.amount);
        const difficulty = String(body.difficulty ?? "medium") as DifficultyKey;

        if (!DIFFICULTIES[difficulty]) {
          clearInFlight(userId);
          return reply({ error: "Invalid difficulty" });
        }

        if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
          clearInFlight(userId);
          return reply({
            error: `Bet must be between ${MIN_BET} and ${MAX_BET} ETB`,
          });
        }

        const wallet = await lockBet(userId, amount);
        if (!wallet) {
          clearInFlight(userId);
          return reply({ error: "Insufficient funds" });
        }

        const game: ActiveGame = {
          userId,
          socketId: socket.id,
          roundId: `dino-${randomUUID()}`,
          betAmount: amount,
          difficulty,
          cleared: 0,
          multiplier: 1.0,
          atObstacle: false,
          startedAt: Date.now(),
        };
        activeGames.set(userId, game);
        clearInFlight(userId);

        return reply({
          ok: true,
          difficulty,
          cleared: 0,
          multiplier: 1.0,
          nextMultiplier: getMultiplier(difficulty, 1),
          betAmount: amount,
          wallet,
        });
      } catch (err) {
        console.error("[dino] start error", userId, err);
        clearInFlight(userId);
        return reply({ error: "Something went wrong, please try again" });
      }
    },
  );

  // ------------------------------------------------------------------
  // deno:obstacle
  // ------------------------------------------------------------------
  socket.on(
    "deno:obstacle",
    (
      _payload: unknown,
      callback?: (r: ObstacleOkReply | ErrorReply) => void,
    ): void => {
      const reply = makeReply<ObstacleOkReply>(callback);

      try {
        if (!userId) return reply({ error: "You must be logged in" });

        const game = activeGames.get(userId);
        if (!game) return reply({ error: "No active game" });
        if (!isOwner(game, socket)) {
          return reply({ error: "Game belongs to another session" });
        }

        game.atObstacle = true;

        return reply({
          ok: true,
          cleared: game.cleared,
          multiplier: game.multiplier,
          nextMultiplier: getMultiplier(game.difficulty, game.cleared + 1),
        });
      } catch (err) {
        console.error("[dino] obstacle error", userId, err);
        return reply({ error: "Something went wrong, please try again" });
      }
    },
  );

  // ------------------------------------------------------------------
  // deno:jump
  // ------------------------------------------------------------------
  socket.on(
    "deno:jump",
    async (
      _payload: unknown,
      callback?: (r: JumpOkReply | ErrorReply) => void,
    ): Promise<void> => {
      const reply = makeReply<JumpOkReply>(callback);

      try {
        if (!userId) return reply({ error: "You must be logged in" });
        if (isInFlight(userId)) return reply({ error: "Please wait" });

        markInFlight(userId);

        const game = activeGames.get(userId);
        if (!game) {
          clearInFlight(userId);
          return reply({ error: "No active game" });
        }
        if (!isOwner(game, socket)) {
          clearInFlight(userId);
          return reply({ error: "Game belongs to another session" });
        }
        if (!game.atObstacle) {
          clearInFlight(userId);
          return reply({ error: "No obstacle ahead" });
        }

        game.atObstacle = false;

        const diff = DIFFICULTIES[game.difficulty];
        const roll = secureRoll();
        const canSurvive = game.cleared < MAX_CLEARED;
        const survived = canSurvive && roll < diff.survivalChance;

        if (survived) {
          game.cleared += 1;
          game.multiplier = getMultiplier(game.difficulty, game.cleared);
          clearInFlight(userId);

          return reply({
            ok: true,
            survived: true,
            cleared: game.cleared,
            multiplier: game.multiplier,
            nextMultiplier: getMultiplier(game.difficulty, game.cleared + 1),
            roll,
          });
        }

        // Loss: settle and remove.
        activeGames.delete(userId);
        const wallet = await settleLoss(game);
        clearInFlight(userId);

        return reply({
          ok: true,
          survived: false,
          cleared: game.cleared,
          multiplier: 0,
          roll,
          wallet,
        });
      } catch (err) {
        console.error("[dino] jump error", userId, err);
        clearInFlight(userId);
        return reply({ error: "Something went wrong, please try again" });
      }
    },
  );

  // ------------------------------------------------------------------
  // deno:cashout
  // ------------------------------------------------------------------
  socket.on(
    "deno:cashout",
    async (
      _payload: unknown,
      callback?: (r: CashoutOkReply | ErrorReply) => void,
    ): Promise<void> => {
      const reply = makeReply<CashoutOkReply>(callback);

      try {
        if (!userId) return reply({ error: "You must be logged in" });
        if (isInFlight(userId)) return reply({ error: "Please wait" });

        markInFlight(userId);

        const game = activeGames.get(userId);
        if (!game) {
          clearInFlight(userId);
          return reply({ error: "No active game" });
        }
        if (!isOwner(game, socket)) {
          clearInFlight(userId);
          return reply({ error: "Game belongs to another session" });
        }
        if (!game.atObstacle) {
          clearInFlight(userId);
          return reply({ error: "No obstacle ahead" });
        }
        if (game.cleared <= 0) {
          clearInFlight(userId);
          return reply({ error: "Clear at least one obstacle first" });
        }

        const payout = Math.round(game.betAmount * game.multiplier * 100) / 100;

        activeGames.delete(userId);
        const wallet = await settleWin(game);
        clearInFlight(userId);

        if (!wallet) {
          activeGames.set(userId, game);
          return reply({ error: "Could not settle bet, please try again" });
        }

        return reply({
          ok: true,
          cleared: game.cleared,
          multiplier: game.multiplier,
          payout,
          wallet,
        });
      } catch (err) {
        console.error("[dino] cashout error", userId, err);
        clearInFlight(userId);
        return reply({ error: "Something went wrong, please try again" });
      }
    },
  );

  // ------------------------------------------------------------------
  // deno:crash
  //
  // The client emits this when Phaser fires GAME_OVER.
  //
  // IMPORTANT: if the dino is paused at a tree (atObstacle === true), a
  // crash is a CLIENT RACE — the physics overlap fires before Phaser's
  // pause takes effect. We must NOT delete the game in that case, or the
  // user's next `deno:jump` will get "No active game". Instead, reply
  // with `ignored: true` so the client can revert to "waiting".
  // ------------------------------------------------------------------
  socket.on(
    "deno:crash",
    async (
      _payload: unknown,
      callback?: (r: CrashOkReply | ErrorReply) => void,
    ): Promise<void> => {
      const reply = makeReply<CrashOkReply>(callback);

      try {
        if (!userId) return reply({ error: "You must be logged in" });

        const game = activeGames.get(userId);

        // Idempotent: no active game → nothing to settle.
        if (!game) {
          return reply({
            ok: true,
            cleared: 0,
            multiplier: 0,
            payout: 0,
            wallet: null,
          });
        }

        if (!isOwner(game, socket)) {
          return reply({ error: "Game belongs to another session" });
        }

        // ⚠️ THE KEY FIX: ignore crashes while waiting at a tree.
        if (game.atObstacle) {
          return reply({
            ok: true,
            ignored: true,
            cleared: game.cleared,
            multiplier: game.multiplier,
            payout: 0,
            wallet: null,
          });
        }

        // Normal crash between obstacles: settle as a loss.
        if (isInFlight(userId)) {
          return reply({ error: "Please wait" });
        }
        markInFlight(userId);

        activeGames.delete(userId);
        const wallet = await settleLoss(game);
        clearInFlight(userId);

        return reply({
          ok: true,
          cleared: game.cleared,
          multiplier: 0,
          payout: 0,
          wallet,
        });
      } catch (err) {
        console.error("[dino] crash error", userId, err);
        clearInFlight(userId);
        return reply({ error: "Something went wrong, please try again" });
      }
    },
  );

  // ------------------------------------------------------------------
  // disconnect
  // ------------------------------------------------------------------
  socket.on("disconnect", async (): Promise<void> => {
    try {
      if (!userId) return;
      const game = activeGames.get(userId);
      if (!game || !isOwner(game, socket)) return;

      activeGames.delete(userId);
      clearInFlight(userId);

      if (game.cleared > 0) {
        await settleWin(game);
      } else {
        await refund(game);
      }
    } catch (err) {
      console.error("[dino] disconnect cleanup failed", err);
    }
  });
};

// ============================================================
// ENTRY POINT
// ============================================================
export default function Dino(_io: Server, socket: CustomSocket): void {
  try {
    registerSocket(socket);
  } catch (err) {
    console.error("[dino] registerSocket failed", err);
  }
}

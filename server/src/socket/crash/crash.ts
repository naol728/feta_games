/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import { wageringService } from "../../services/waggering.service";
import { pointsService } from "../../services/points.service";

import {
  encodeSync,
  encodeRoundStart,
  encodeBetBatch,
  encodeCashoutBatch,
  encodeCrash,
  encodeMultiplierTick,
  BetBatchEntry,
  CashoutBatchEntry,
} from "./Protocols";

// ============================================================
// NOTES -- IN-MEMORY STATE (no longer Redis-backed)
// ============================================================
//
// This used to rely on Redis for two things: (1) sharing round state
// across multiple Node processes, and (2) atomic Lua-script claims
// (claimBet/claimCashout/popDueAutoCashouts) so two processes could
// never both settle the same bet.
//
// With in-memory state, NEITHER of those guarantees hold across
// processes anymore -- there is nothing shared to coordinate on. This
// file must now run as a SINGLE Node process. Do not run this behind
// multiple replicas/dynos or in PM2 cluster mode: every instance would
// independently believe it's the round leader and run its own
// separate round clock, and bets placed against one instance would be
// invisible to the others.
//
// The atomicity that Lua scripts gave us across processes is replaced
// here by plain JS single-threadedness: as long as claim functions
// (claimBet, claimCashout, popDueAutoCashouts) don't `await` before
// mutating in-memory state, two "concurrent" calls can't interleave
// mid-mutation within one process. That's preserved below.
//
// Per-bet/per-cashout batching (~150ms flush) is still worthwhile even
// single-process, since it's just reducing socket emit volume.
// ============================================================

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

// ============================================================
// IN-MEMORY STATE
// ============================================================

type CrashPhase = 0 | 1 | 2; // 0 = betting, 1 = running, 2 = crashed

interface InternalPlayer {
  playerId: number;
  userId: string;
  username: string;
  betAmount: number;
  autoCashoutAt: number | null;
  payout: number | null; // null until a win is finalized; stays null for losers
  cashoutInProgress: boolean; // claim lock so a player can't be settled twice
}

interface CrashMemState {
  phase: CrashPhase;
  roundNumber: number;
  roundId: string | null;
  crashPoint: number | null;
  gameStartTime: number | null;
  players: Map<number, InternalPlayer>;
  userToPlayer: Map<string, number>;
  nextPlayerId: number;
  pendingBetLocks: Set<string>;
}

const mem: CrashMemState = {
  phase: 0,
  roundNumber: 0,
  roundId: null,
  crashPoint: null,
  gameStartTime: null,
  players: new Map(),
  userToPlayer: new Map(),
  nextPlayerId: 1,
  pendingBetLocks: new Set(),
};

type ClaimBetResult =
  | { ok: true; playerId: number }
  | { ok: false; error: "PHASE_CLOSED" | "DUPLICATE" };

type ClaimCashoutResult =
  | { ok: true; playerId: number; betAmount: number }
  | { ok: false };

const state = {
  async getState() {
    return {
      phase: mem.phase,
      roundNumber: mem.roundNumber,
      roundId: mem.roundId,
      crashPoint: mem.crashPoint,
      gameStartTime: mem.gameStartTime,
    };
  },

  async resetRound(crashPoint: number): Promise<{ roundNumber: number }> {
    mem.roundNumber += 1;
    mem.roundId = randomUUID();
    mem.crashPoint = crashPoint;
    mem.gameStartTime = null;
    mem.phase = 0;
    mem.players = new Map();
    mem.userToPlayer = new Map();
    mem.nextPlayerId = 1;
    return { roundNumber: mem.roundNumber };
  },

  async setPhaseRunning(gameStartTime: number): Promise<void> {
    mem.phase = 1;
    mem.gameStartTime = gameStartTime;
  },

  async setPhaseCrashed(): Promise<void> {
    mem.phase = 2;
  },

  async tryLockPendingBet(userId: string): Promise<boolean> {
    if (mem.pendingBetLocks.has(userId)) return false;
    mem.pendingBetLocks.add(userId);
    return true;
  },

  async unlockPendingBet(userId: string): Promise<void> {
    mem.pendingBetLocks.delete(userId);
  },

  async claimBet(entry: {
    userId: string;
    username: string;
    betAmount: number;
    autoCashoutAt: number | null;
  }): Promise<ClaimBetResult> {
    if (mem.phase !== 0) {
      return { ok: false, error: "PHASE_CLOSED" };
    }
    if (mem.userToPlayer.has(entry.userId)) {
      return { ok: false, error: "DUPLICATE" };
    }

    const playerId = mem.nextPlayerId++;
    mem.players.set(playerId, {
      playerId,
      userId: entry.userId,
      username: entry.username,
      betAmount: entry.betAmount,
      autoCashoutAt: entry.autoCashoutAt,
      payout: null,
      cashoutInProgress: false,
    });
    mem.userToPlayer.set(entry.userId, playerId);

    return { ok: true, playerId };
  },

  async claimCashout(userId: string): Promise<ClaimCashoutResult> {
    const playerId = mem.userToPlayer.get(userId);
    if (playerId === undefined) return { ok: false };

    const player = mem.players.get(playerId);
    if (!player || player.payout !== null || player.cashoutInProgress) {
      return { ok: false };
    }

    player.cashoutInProgress = true; // synchronous -- no await above, so this is atomic
    return { ok: true, playerId, betAmount: player.betAmount };
  },

  async finalizeCashout(
    playerId: number,
    _userId: string,
    multiplier: number,
  ): Promise<void> {
    const player = mem.players.get(playerId);
    if (!player) return;
    player.payout = player.betAmount * multiplier;
    player.cashoutInProgress = false;
  },

  async releaseCashoutLock(userId: string): Promise<void> {
    const playerId = mem.userToPlayer.get(userId);
    if (playerId === undefined) return;
    const player = mem.players.get(playerId);
    if (player) player.cashoutInProgress = false;
  },

  async popDueAutoCashouts(currentMultiplier: number): Promise<number[]> {
    const due: number[] = [];
    for (const player of mem.players.values()) {
      if (
        player.payout === null &&
        !player.cashoutInProgress &&
        player.autoCashoutAt !== null &&
        player.autoCashoutAt <= currentMultiplier
      ) {
        player.cashoutInProgress = true; // claim immediately, atomic within this sync loop
        due.push(player.playerId);
      }
    }
    return due;
  },

  async getPlayer(playerId: number): Promise<InternalPlayer | null> {
    return mem.players.get(playerId) ?? null;
  },

  async *iterateAllPlayers(): AsyncGenerator<InternalPlayer> {
    for (const player of mem.players.values()) {
      yield player;
    }
  },

  // Leadership is meaningless with per-process in-memory state -- a
  // single process only ever coordinates with itself.
  async tryAcquireLeadership(
    _instanceId: string,
    _ttlMs: number,
  ): Promise<boolean> {
    return true;
  },

  async renewLeadership(_instanceId: string, _ttlMs: number): Promise<boolean> {
    return true;
  },

  async releaseLeadership(_instanceId: string): Promise<void> {
    // no-op
  },
};

// ============================================================
// CONSTANTS
// ============================================================

const INSTANCE_ID = randomUUID();
const LEADER_TTL_MS = 8_000;
const LEADER_RENEW_MS = 3_000;
const BATCH_INTERVAL_MS = 150;
const MAX_BATCH_SIZE = 1000; // flush early if a batch gets this big

// ============================================================
// TRANSACTION RECORDING
// ============================================================
//
// Returns true only if this call actually inserted the row -- i.e.
// this is the first time this entry+round+outcome has been settled.
// The unique constraint on reference_id doubles as our idempotency
// lock: callers must not touch the wallet unless this returns true.
const recordCrashTransaction = async ({
  userId,
  type,
  amount,
  roundId,
  multiplier,
}: {
  userId: string;
  type: "win" | "lose";
  amount: number;
  roundId: string | null;
  multiplier?: number;
}): Promise<boolean> => {
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

  if (error) {
    if (error.code === "23505") {
      console.warn(
        `[crash] duplicate settlement suppressed for ${userId} round ${roundId} (${type})`,
      );
      return false;
    }
    console.error("Failed to record crash transaction:", error);
    return false; // fail closed: don't move wallet balance if we can't confirm the log wrote
  }

  return true;
};

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

// ============================================================
// GAME ENGINE
// ============================================================

const crashGame = (io: Server, { bettingMs = 12_000, tickMs = 100 } = {}) => {
  let isLeader = false;
  let leaderRenewTimer: NodeJS.Timeout | null = null;
  let leaderAcquireTimer: NodeJS.Timeout | null = null;
  let stopped = false;

  let roundTimer: NodeJS.Timeout | null = null;
  let ticker: NodeJS.Timeout | null = null;

  let betBuffer: BetBatchEntry[] = [];
  let cashoutBuffer: CashoutBatchEntry[] = [];
  let batchFlushTimer: NodeJS.Timeout | null = null;

  const flushBatches = () => {
    if (betBuffer.length) {
      io.emit("crash:bets", encodeBetBatch(betBuffer));
      betBuffer = [];
    }
    if (cashoutBuffer.length) {
      io.emit("crash:cashouts", encodeCashoutBatch(cashoutBuffer));
      cashoutBuffer = [];
    }
  };

  const queueBet = (entry: BetBatchEntry) => {
    betBuffer.push(entry);
    if (betBuffer.length >= MAX_BATCH_SIZE) flushBatches();
  };

  const queueCashout = (entry: CashoutBatchEntry) => {
    cashoutBuffer.push(entry);
    if (cashoutBuffer.length >= MAX_BATCH_SIZE) flushBatches();
  };

  batchFlushTimer = setInterval(flushBatches, BATCH_INTERVAL_MS);

  // ==========================================================
  // SYNC
  // ==========================================================

  const sendState = async (socket: CustomSocket) => {
    const snapshot = await state.getState();
    socket.emit(
      "crash:sync",
      encodeSync({
        phase: snapshot.phase,
        roundNumber: snapshot.roundNumber,
        gameStartTime: snapshot.gameStartTime,
      }),
    );
  };

  // ==========================================================
  // CASHOUT (shared logic used by manual + auto-cashout paths)
  // ==========================================================

  const settleCashout = async (
    userId: string,
    multiplier: number,
    notify: (data: {
      userId: string;
      payout: number;
      multiplier: number;
      wallet: any;
    }) => void,
  ): Promise<{ ok: true; payout: number } | { ok: false }> => {
    const claim = await state.claimCashout(userId);

    if (!claim.ok) {
      return { ok: false };
    }

    const { playerId, betAmount } = claim;

    try {
      const roundId = (await state.getState()).roundId;
      const payout = betAmount * multiplier;

      // Insert the ledger row FIRST. Its unique reference_id acts as
      // the idempotency lock -- only move the wallet if this is the
      // first time this cashout has actually been recorded.
      const inserted = await recordCrashTransaction({
        userId,
        type: "win",
        amount: payout,
        roundId,
        multiplier,
      });

      if (!inserted) {
        // Release the claim without ever touching the wallet. This
        // leaves the player's payout as null, so if the round crashes
        // they'll correctly fall through to the loss path instead --
        // same fallback behavior as any other cashout failure.
        await state.releaseCashoutLock(userId);
        return { ok: false };
      }

      await walletService.settleCrashWin(userId, payout, betAmount);
      const wallet = await walletService.getWallet(userId);

      await Promise.all([
        supabase.rpc("record_daily_activity", {
          p_user_id: userId,
          p_activity_type: "played",
        }),
      ]);
      await pointsService
        .addGameplayPoints(userId, betAmount)
        .catch((error) => {
          console.error("Failed to add crash gameplay points:", error);
        });

      await state.finalizeCashout(playerId, userId, multiplier);

      queueCashout({ playerId, multiplier, payout });
      io.to(userId).emit("crash:wallet", wallet);
      notify({ userId, payout, multiplier, wallet });

      return { ok: true, payout };
    } catch (error) {
      console.error("Cashout error:", error);
      // Release the pending lock without recording a payout, so the bet
      // is still eligible to be settled as a loss if the round crashes,
      // or retried by the user if the round is still running.
      await state.releaseCashoutLock(userId);
      return { ok: false };
    }
  };

  // ==========================================================
  // ROUND LIFECYCLE (leader only)
  // ==========================================================

  const openBetting = async () => {
    if (stopped || !isLeader) return;

    const crashPoint = generateCrashPoint();
    const { roundNumber } = await state.resetRound(crashPoint);

    io.emit(
      "crash:sync",
      encodeSync({ phase: 0, roundNumber, gameStartTime: null }),
    );

    roundTimer = setTimeout(runRound, bettingMs);
  };

  const runRound = async () => {
    if (stopped || !isLeader) return;

    const gameStartTime = Date.now();
    await state.setPhaseRunning(gameStartTime);

    const current = await state.getState();
    io.emit(
      "crash:start",
      encodeRoundStart(current.roundNumber, gameStartTime),
    );

    let ticking = false;

    ticker = setInterval(async () => {
      if (stopped || !isLeader) {
        if (ticker) clearInterval(ticker);
        ticker = null;
        return;
      }

      if (ticking) return;
      ticking = true;

      try {
        await tick(gameStartTime);
      } catch (error) {
        console.error("Crash tick error:", error);
      } finally {
        ticking = false;
      }
    }, tickMs);

    const tick = async (startTime: number): Promise<void> => {
      const snapshot = await state.getState();
      const elapsedMs = Date.now() - startTime;
      const currentMultiplier = calculateMultiplierAt(elapsedMs);

      io.emit("crash:multiplier", encodeMultiplierTick(currentMultiplier));

      // ------------------------------------------------------
      // AUTO CASHOUT -- pop everyone whose target has been hit
      // ------------------------------------------------------

      const duePlayerIds = await state.popDueAutoCashouts(currentMultiplier);

      if (duePlayerIds.length && currentMultiplier < snapshot.crashPoint!) {
        await Promise.all(
          duePlayerIds.map(async (playerId) => {
            const player = await state.getPlayer(playerId);
            if (!player) return;
            await settleCashout(player.userId, currentMultiplier, () => {});
          }),
        );
      }

      // ------------------------------------------------------
      // CRASH
      // ------------------------------------------------------

      if (currentMultiplier >= snapshot.crashPoint!) {
        if (ticker) clearInterval(ticker);
        ticker = null;

        await state.setPhaseCrashed();
        flushBatches(); // make sure every bet/cashout lands before the crash frame

        io.emit("crash:crash", encodeCrash(snapshot.crashPoint!));

        // ----------------------------------------------------
        // LOSSES -- stream players in batches, never one giant
        // in-memory array for 10k+ entries.
        // ----------------------------------------------------

        const lossPromises: Promise<void>[] = [];

        for await (const player of state.iterateAllPlayers()) {
          if (player.payout !== null) continue;

          lossPromises.push(
            (async () => {
              try {
                // Insert first -- same idempotency-lock pattern as the
                // win path. If this player was somehow already
                // recorded as a loss, skip the wallet mutation.
                const inserted = await recordCrashTransaction({
                  userId: player.userId,
                  type: "lose",
                  amount: player.betAmount,
                  roundId: snapshot.roundId,
                });

                if (!inserted) return;

                await walletService.consumeLockedBalance(
                  player.userId,
                  player.betAmount,
                );

                await Promise.all([
                  supabase.rpc("record_daily_activity", {
                    p_user_id: player.userId,
                    p_activity_type: "played",
                  }),
                ]);
                await pointsService
                  .addGameplayPoints(player.userId, player.betAmount)
                  .catch((error) => {
                    console.error(
                      "Failed to add crash gameplay points:",
                      error,
                    );
                  });

                const wallet = await walletService.getWallet(player.userId);
                io.to(player.userId).emit("crash:wallet", wallet);
              } catch (error) {
                console.error(
                  "Failed to settle losing bet:",
                  player.userId,
                  error,
                );
              }
            })(),
          );
        }

        await Promise.all(lossPromises);

        openBetting();
      }
    };
  };

  // ==========================================================
  // SOCKET REGISTRATION
  // ==========================================================

  const registerSocket = (socket: CustomSocket) => {
    const userId = socket.user.userId;

    socket.join(userId);
    sendState(socket);

    socket.on("crash:requestState", () => sendState(socket));

    socket.on(
      "crash:bet",
      async (payload: unknown, callback?: (result: any) => void) => {
        const reply = (result: any) => {
          if (typeof callback === "function") callback(result);
        };

        try {
          if (!userId) return reply({ error: "You must be logged in" });

          const bet =
            typeof payload === "object" && payload !== null
              ? (payload as { amount?: unknown; autoCashoutAt?: unknown })
              : { amount: payload };

          const amount = Number(bet.amount);
          const autoCashoutAt =
            bet.autoCashoutAt == null ? null : Number(bet.autoCashoutAt);

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

          const locked = await state.tryLockPendingBet(userId);
          if (!locked)
            return reply({ error: "You already have a bet this round" });

          try {
            const walletLocked = await walletService.lockandchcekBalance(
              userId,
              amount,
            );
            if (!walletLocked) return reply({ error: "Insufficient funds" });

            await wageringService.recordWager(
              userId,
              amount,
              "Crash",
              (await state.getState()).roundId,
            );

            const { data: user, error } = await supabase
              .from("users")
              .select("id, username, Fname")
              .eq("id", userId)
              .single();

            if (error || !user) {
              await walletService.unlockBalance(userId);
              return reply({ error: "User not found" });
            }

            const username = user.username ?? user.Fname ?? "";
            const claim = await state.claimBet({
              userId,
              username,
              betAmount: amount,
              autoCashoutAt,
            });

            if (!claim.ok) {
              await walletService.unlockBalance(userId);
              return reply({
                error:
                  claim.error === "PHASE_CLOSED"
                    ? "Betting is closed"
                    : "You already have a bet this round",
              });
            }

            const wallet = await walletService.getWallet(userId);

            queueBet({ playerId: claim.playerId, amount });

            reply({
              ok: true,
              roundId: (await state.getState()).roundId,
              playerId: claim.playerId,
              wallet,
            });
          } finally {
            await state.unlockPendingBet(userId);
          }
        } catch (error) {
          console.error("Crash bet error:", error);
          reply({ error: "Could not place the bet" });
        }
      },
    );

    socket.on("crash:cashout", async (callback?: (result: any) => void) => {
      const done = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        if (!userId) return done({ error: "You must be logged in" });

        const snapshot = await state.getState();
        if (snapshot.phase !== 1 || !snapshot.gameStartTime) {
          return done({ error: "Game is not running" });
        }

        const currentMultiplier = calculateMultiplierAt(
          Date.now() - snapshot.gameStartTime,
        );

        if (currentMultiplier >= snapshot.crashPoint!) {
          return done({ error: "Too late" });
        }

        let cashoutWallet: any = null;
        let payoutMultiplier = currentMultiplier;

        const result = await settleCashout(
          userId,
          currentMultiplier,
          (data) => {
            cashoutWallet = data.wallet;
          },
        );

        if (!result.ok) {
          return done({ error: "Cashout failed" });
        }

        if (!cashoutWallet) {
          cashoutWallet = await walletService.getWallet(userId);
        }

        done({ ok: true, multiplier: payoutMultiplier, wallet: cashoutWallet });
      } catch (error) {
        console.error("Crash cashout error:", error);
        done({ error: "Cashout failed" });
      }
    });
  };

  // ==========================================================
  // LEADER ELECTION (no-op with in-memory state -- kept for shape)
  // ==========================================================

  const becomeLeader = async () => {
    isLeader = true;
    console.log(`[crash] instance ${INSTANCE_ID} is now the round leader`);

    leaderRenewTimer = setInterval(async () => {
      const renewed = await state.renewLeadership(INSTANCE_ID, LEADER_TTL_MS);
      if (!renewed) {
        console.warn(`[crash] instance ${INSTANCE_ID} lost leadership`);
        isLeader = false;
        if (leaderRenewTimer) clearInterval(leaderRenewTimer);
        leaderRenewTimer = null;
        if (roundTimer) clearTimeout(roundTimer);
        if (ticker) clearInterval(ticker);
      }
    }, LEADER_RENEW_MS);

    await openBetting();
  };

  const pollForLeadership = async () => {
    if (stopped || isLeader) return;
    const acquired = await state.tryAcquireLeadership(
      INSTANCE_ID,
      LEADER_TTL_MS,
    );
    if (acquired) await becomeLeader();
  };

  leaderAcquireTimer = setInterval(pollForLeadership, LEADER_RENEW_MS);
  pollForLeadership();

  // ==========================================================
  // STOP
  // ==========================================================

  const stop = async () => {
    stopped = true;

    if (roundTimer) clearTimeout(roundTimer);
    if (ticker) clearInterval(ticker);
    if (leaderRenewTimer) clearInterval(leaderRenewTimer);
    if (leaderAcquireTimer) clearInterval(leaderAcquireTimer);
    if (batchFlushTimer) clearInterval(batchFlushTimer);

    if (isLeader) await state.releaseLeadership(INSTANCE_ID);
  };

  return { registerSocket, stop };
};

// ============================================================
// SINGLETON PER PROCESS
// ============================================================

let crashGameInstance: ReturnType<typeof crashGame> | null = null;

export default function Crash(io: Server, socket: CustomSocket) {
  if (!crashGameInstance) {
    crashGameInstance = crashGame(io);
  }

  crashGameInstance.registerSocket(socket);
}

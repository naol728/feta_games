/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import {
  lockBet,
  settleGameBatch,
  SettleEntry,
  WalletSnapshot,
} from "../../services/game-settlement.service";

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
// NOTES -- IN-MEMORY STATE
// ============================================================
//
// All round state lives in this process's memory, so this file must
// run as a SINGLE Node process (no replicas, no PM2 cluster mode).
// Atomicity of claim functions (claimBet/claimCashout/popDueAutoCashouts)
// relies on JS single-threadedness: they must not `await` before
// mutating state.
//
// Money safety: every settlement goes through the settle_game RPC,
// which is idempotent per (game, round, user). At most ONE outcome
// (win or lose) can ever be committed for a player in a round.
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
// CONSTANTS / HELPERS
// ============================================================

const GAME_NAME = "crash";
const INSTANCE_ID = randomUUID();
const LEADER_TTL_MS = 8_000;
const LEADER_RENEW_MS = 3_000;
const BATCH_INTERVAL_MS = 150;
const MAX_BATCH_SIZE = 1000; // flush early if a batch gets this big

const round2 = (n: number) => Math.round(n * 100) / 100;

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

// Usernames never change mid-session, so read each one from the DB at
// most once per process instead of once per bet.
const usernameCache = new Map<string, string>();

async function getUsername(userId: string): Promise<string | null> {
  const cached = usernameCache.get(userId);
  if (cached !== undefined) return cached;

  const { data: user, error } = await supabase
    .from("users")
    .select("id, username, Fname")
    .eq("id", userId)
    .single();

  if (error || !user) return null;

  const username = user.username ?? user.Fname ?? "";
  if (usernameCache.size > 50_000) usernameCache.clear();
  usernameCache.set(userId, username);
  return username;
}

interface ClaimedCashout {
  playerId: number;
  userId: string;
  betAmount: number;
  multiplier: number;
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

  // Cashout settlements currently talking to the DB. The crash handler
  // waits for these so a cashout that was clicked before the crash
  // can't lose a race against its own loss settlement.
  const pendingCashouts = new Set<Promise<unknown>>();

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
  // CASHOUT SETTLEMENT (manual + auto share this)
  //
  // Items must already be claimed (cashoutInProgress = true). All items
  // go to the database in ONE batched call, so a multiplier tick that
  // triggers 300 auto-cashouts costs one round trip, not 300.
  // Returns payout + wallet for every cashout that actually landed.
  // ==========================================================

  const settleClaimed = (
    items: ClaimedCashout[],
  ): Promise<Map<string, { payout: number; wallet: WalletSnapshot }>> => {
    const run = async () => {
      const won = new Map<string, { payout: number; wallet: WalletSnapshot }>();
      const roundId = (await state.getState()).roundId ?? "unknown";

      const entries: SettleEntry[] = items.map((item) => ({
        userId: item.userId,
        bet: item.betAmount,
        payout: round2(item.betAmount * item.multiplier),
        metadata: { multiplier: item.multiplier },
      }));

      const results = await settleGameBatch(GAME_NAME, roundId, entries);
      const byUser = new Map(results.map((r) => [r.user_id, r]));

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const res = byUser.get(item.userId);

        if (res?.status === "ok" && res.wallet) {
          const payout = entries[i].payout;
          await state.finalizeCashout(
            item.playerId,
            item.userId,
            item.multiplier,
          );
          queueCashout({
            playerId: item.playerId,
            multiplier: item.multiplier,
            payout,
          });
          io.to(item.userId).emit("crash:wallet", res.wallet);
          won.set(item.userId, { payout, wallet: res.wallet });
        } else {
          // Nothing was committed (error) or this player was already
          // settled (duplicate). Release the claim; if the round
          // crashes they fall through to the loss path, which is a
          // harmless no-op if they were in fact already settled.
          await state.releaseCashoutLock(item.userId);
        }
      }

      return won;
    };

    const promise = run().catch(async (error) => {
      console.error("[crash] cashout settlement error:", error);
      for (const item of items) await state.releaseCashoutLock(item.userId);
      return new Map<string, { payout: number; wallet: WalletSnapshot }>();
    });

    pendingCashouts.add(promise);
    void promise.finally(() => pendingCashouts.delete(promise));
    return promise;
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
      // AUTO CASHOUT -- everyone whose target was hit this tick
      // is settled together in a single batched call
      // ------------------------------------------------------

      const duePlayerIds = await state.popDueAutoCashouts(currentMultiplier);

      if (duePlayerIds.length && currentMultiplier < snapshot.crashPoint!) {
        const items: ClaimedCashout[] = [];
        for (const playerId of duePlayerIds) {
          const player = await state.getPlayer(playerId);
          if (!player) continue;
          items.push({
            playerId,
            userId: player.userId,
            betAmount: player.betAmount,
            multiplier: currentMultiplier,
          });
        }
        if (items.length) await settleClaimed(items);
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

        // Let in-flight cashouts finish first so they can't be beaten
        // to the ledger by their own loss settlement.
        await Promise.allSettled([...pendingCashouts]);

        // ----------------------------------------------------
        // LOSSES -- everyone without a payout, settled in a few
        // batched calls instead of one call per player.
        // ----------------------------------------------------

        const roundId = snapshot.roundId ?? "unknown";
        const lossEntries: SettleEntry[] = [];

        for await (const player of state.iterateAllPlayers()) {
          if (player.payout !== null) continue;
          lossEntries.push({
            userId: player.userId,
            bet: player.betAmount,
            payout: 0,
          });
        }

        if (lossEntries.length) {
          try {
            const results = await settleGameBatch(
              GAME_NAME,
              roundId,
              lossEntries,
            );
            for (const res of results) {
              if (res.status === "ok" && res.wallet) {
                io.to(res.user_id).emit("crash:wallet", res.wallet);
              }
            }
          } catch (error) {
            console.error("[crash] loss settlement error:", error);
          }
        }

        openBetting().catch((error) =>
          console.error("[crash] openBetting error:", error),
        );
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

          const pendingLock = await state.tryLockPendingBet(userId);
          if (!pendingLock)
            return reply({ error: "You already have a bet this round" });

          let walletLocked = false;
          let claimed = false;

          try {
            // Free in-memory pre-checks: a closed round or a duplicate
            // bet should never cost a database write.
            const snapshot = await state.getState();
            if (snapshot.phase !== 0) {
              return reply({ error: "Betting is closed" });
            }
            if (mem.userToPlayer.has(userId)) {
              return reply({ error: "You already have a bet this round" });
            }

            // Cached after the first bet, so usually no DB read at all.
            const username = await getUsername(userId);
            if (username === null) return reply({ error: "User not found" });

            // One DB call: lock funds and get the fresh wallet back.
            const wallet = await lockBet(userId, amount);
            if (!wallet) return reply({ error: "Insufficient funds" });
            walletLocked = true;

            const claim = await state.claimBet({
              userId,
              username,
              betAmount: amount,
              autoCashoutAt,
            });

            if (!claim.ok) {
              await walletService.unlockBalance(userId);
              walletLocked = false;
              return reply({
                error:
                  claim.error === "PHASE_CLOSED"
                    ? "Betting is closed"
                    : "You already have a bet this round",
              });
            }
            claimed = true;

            // Wagering, points and daily activity are recorded by
            // settle_game when this bet is settled.
            queueBet({ playerId: claim.playerId, amount });

            reply({
              ok: true,
              roundId: snapshot.roundId,
              playerId: claim.playerId,
              wallet,
            });
          } catch (error) {
            if (walletLocked && !claimed) {
              try {
                await walletService.unlockBalance(userId);
              } catch (unlockErr) {
                console.error(
                  "[crash] unlock after failed bet failed:",
                  unlockErr,
                );
              }
            }
            throw error;
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

        const claim = await state.claimCashout(userId);
        if (!claim.ok) return done({ error: "Cashout failed" });

        const won = await settleClaimed([
          {
            playerId: claim.playerId,
            userId,
            betAmount: claim.betAmount,
            multiplier: currentMultiplier,
          },
        ]);

        const result = won.get(userId);
        if (!result) return done({ error: "Cashout failed" });

        done({
          ok: true,
          multiplier: currentMultiplier,
          wallet: result.wallet,
        });
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

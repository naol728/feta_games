/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import { wageringService } from "../../services/waggering.service";

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

import * as state from "./state";

// ============================================================
// NOTES ON RUNNING THIS AT 10,000 CONCURRENT USERS
// ============================================================
//
// 1. This file assumes your Socket.IO server is created with the Redis
//    adapter attached (in your main server bootstrap, not here):
//
//      import { createAdapter } from "@socket.io/redis-adapter";
//      const pubClient = redis.duplicate();
//      const subClient = redis.duplicate();
//      io.adapter(createAdapter(pubClient, subClient));
//
//    Without that, io.emit()/io.to(room).emit() only reaches sockets on the
//    SAME process. With it, every process's io.emit() fans out to every
//    connected socket cluster-wide, which is what lets you run several
//    Node instances behind a load balancer instead of one process holding
//    10,000 open sockets.
//
// 2. Only one process should run the round clock (betting countdown, tick
//    loop, crash resolution). Every process still handles "crash:bet" and
//    "crash:cashout" locally -- those are now safe to run anywhere because
//    all shared state lives in Redis (see state.ts) and is claimed
//    atomically via Lua scripts.
//
// 3. Per-bet/per-cashout events are no longer emitted one at a time --
//    they're buffered for ~150ms and flushed as a single binary batch
//    packet. See protocol.ts for why that matters at this scale.
// ============================================================

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

const INSTANCE_ID = randomUUID();
const LEADER_TTL_MS = 8_000;
const LEADER_RENEW_MS = 3_000;
const BATCH_INTERVAL_MS = 150;
const MAX_BATCH_SIZE = 1000; // flush early if a batch gets this big

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
}): Promise<void> => {
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
    console.error("Failed to record crash transaction:", error);
  }
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

  // Local (per-process) buffers -- purely a broadcast optimization, not
  // shared state. Whichever process handled a given socket's request
  // buffers it and flushes on its own timer.
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
          roundId,
          multiplier,
        }),
      ]);

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

      if (duePlayerIds.length && currentMultiplier < snapshot.crashPoint) {
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

      if (currentMultiplier >= snapshot.crashPoint) {
        if (ticker) clearInterval(ticker);
        ticker = null;

        await state.setPhaseCrashed();
        flushBatches(); // make sure every bet/cashout lands before the crash frame

        io.emit("crash:crash", encodeCrash(snapshot.crashPoint));

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
                await walletService.consumeLockedBalance(
                  player.userId,
                  player.betAmount,
                );

                await Promise.all([
                  supabase.rpc("record_daily_activity", {
                    p_user_id: player.userId,
                    p_activity_type: "played",
                  }),
                  recordCrashTransaction({
                    userId: player.userId,
                    type: "lose",
                    amount: player.betAmount,
                    roundId: snapshot.roundId,
                  }),
                ]);

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
  // SOCKET REGISTRATION (runs on every instance)
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
              // Round closed or duplicate bet slipped through -- refund the lock.
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

        if (currentMultiplier >= snapshot.crashPoint) {
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
  // LEADER ELECTION
  // ==========================================================
  // Every instance keeps trying to become leader. Whichever one holds the
  // lock runs the round clock; the others idle on this and just serve
  // sockets. If the leader dies, its lease expires (LEADER_TTL_MS) and
  // another instance picks it up on its next poll.

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
// Note: this is a singleton per Node PROCESS, not cluster-wide -- that's
// intentional. Each process runs its own crashGame() instance; leader
// election (above) decides which one actually drives the clock.

let crashGameInstance: ReturnType<typeof crashGame> | null = null;

export default function Crash(io: Server, socket: CustomSocket) {
  if (!crashGameInstance) {
    crashGameInstance = crashGame(io);
  }

  crashGameInstance.registerSocket(socket);
}

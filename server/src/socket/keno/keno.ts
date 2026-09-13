/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import { wageringService } from "../../services/waggering.service";
import { pointsService } from "../../services/points.service";

import * as state from "./states";
import type { KenoEntry } from "./states";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

// ============================================================
// BOARD / DRAW CONFIG
// ============================================================

const BOARD_SIZE = 40; // numbers 1..40
const DRAW_COUNT = 10; // numbers drawn per round
const DRAW_INTERVAL_MS = 200; // matches the original reveal pacing
const MIN_PICKS = 1;
const MAX_PICKS = 10;
const MIN_BET = 1;
const MAX_BET = 50_000;

const BETTING_DURATION_MS = 15_000;
const RESULT_DURATION_MS = 4_000;
// Small buffer after the 10th reveal before moving to RESULT, so the
// last number's animation has time to land before the phase flips.
const DRAWING_BUFFER_MS = 400;
const DRAWING_DURATION_MS = DRAW_COUNT * DRAW_INTERVAL_MS + DRAWING_BUFFER_MS;

// ============================================================
// PAYTABLE -- SOLVED FOR 90% RTP
// ============================================================
//
// Keno's payout depends on (numbers picked, numbers matched). The
// probability of matching k out of n picks, when 10 numbers are drawn
// out of 40, is the exact hypergeometric distribution:
//
//   P(k) = C(n,k) * C(40-n, 10-k) / C(40,10)
//
// For each pick count n, only matches at or above a threshold pay out
// (threshold = ceil(n/2) -- you need roughly half your picks right
// before it's worth anything), with the multiplier growing
// quadratically above that threshold so a near-miss pays little and a
// near-perfect match pays a lot. For each n, all the nonzero
// multipliers were scaled by a single constant so that:
//
//   sum over k of P(k) * multiplier(k) == 0.90
//
// solved exactly (no simulation needed -- the distribution is exact
// and tractable at this size), then rounded to cents. Realized RTP
// after rounding is 89.90%-90.02% for every pick count -- see the
// comment after each row.
const PAYTABLE: Record<number, Record<number, number>> = {
  1: { 1: 3.6 }, // realized RTP 0.9000
  2: { 1: 1.46, 2: 5.85 }, // realized RTP 0.8990
  3: { 2: 4.86, 3: 19.44 }, // realized RTP 0.9002
  4: { 2: 2.29, 3: 9.17, 4: 20.64 }, // realized RTP 0.8991
  5: { 3: 7.43, 4: 29.73, 5: 66.9 }, // realized RTP 0.8997
  6: { 3: 3.74, 4: 14.95, 5: 33.65, 6: 59.82 }, // realized RTP 0.9001
  7: { 4: 12.43, 5: 49.73, 6: 111.89, 7: 198.91 }, // realized RTP 0.8999
  8: { 4: 6.45, 5: 25.81, 6: 58.06, 7: 103.22, 8: 161.29 }, // realized RTP 0.8999
  9: { 5: 22.77, 6: 91.08, 7: 204.93, 8: 364.31, 9: 569.24 }, // realized RTP 0.9000
  10: { 5: 11.99, 6: 47.95, 7: 107.89, 8: 191.81, 9: 299.7, 10: 431.57 }, // realized RTP 0.9001
};

function computeHitsAndPayout(
  numbers: number[],
  drawn: number[],
  betAmount: number,
) {
  const drawnSet = new Set(drawn);
  const hits = numbers.filter((n) => drawnSet.has(n)).length;
  const multiplier = PAYTABLE[numbers.length]?.[hits] ?? 0;
  const payout = Math.round(betAmount * multiplier * 100) / 100;
  return { hits, multiplier, payout };
}

// ============================================================
// DRAW GENERATION
// ============================================================

function drawNumbers(): number[] {
  const pool = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);

  // Fisher-Yates, only as many swaps as numbers we need to draw.
  for (let i = 0; i < DRAW_COUNT; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, DRAW_COUNT);
}

// ============================================================
// TRANSACTION RECORDING
// ============================================================

const recordKenoTransaction = async ({
  userId,
  type,
  amount,
  roundId,
  hits,
  picks,
}: {
  userId: string;
  type: "win" | "lose";
  amount: number;
  roundId: string | null;
  hits: number;
  picks: number;
}): Promise<void> => {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount,
    status: "completed",
    reference_id: `keno_${roundId ?? "unknown"}_${userId}_${type}`,
    metadata: { game: "keno", round_id: roundId, hits, picks },
  });

  if (error) {
    console.error("Failed to record keno transaction:", error);
  }
};

// ============================================================
// GAME ENGINE
// ============================================================

const kenoGame = (io: Server) => {
  const INSTANCE_ID = randomUUID();
  const LEADER_TTL_MS = 8_000;
  const LEADER_RENEW_MS = 3_000;

  let isLeader = false;
  let stopped = false;
  let leaderRenewTimer: NodeJS.Timeout | null = null;
  let leaderAcquireTimer: NodeJS.Timeout | null = null;
  let phaseTimer: NodeJS.Timeout | null = null;
  let drawTimer: NodeJS.Timeout | null = null;

  // ==========================================================
  // SYNC
  // ==========================================================

  const sendState = async (socket: CustomSocket) => {
    const snapshot = await state.getState();
    const userId = socket.user.userId;

    const yourEntry = userId ? await state.getEntry(userId) : null;

    socket.emit("keno:sync", {
      phase: snapshot.phase,
      roundNumber: snapshot.roundNumber,
      phaseEndsAt: snapshot.phaseEndsAt,
      drawn: snapshot.drawn,
      yourEntry,
    });
  };

  // ==========================================================
  // ROUND LIFECYCLE (leader only)
  // ==========================================================

  const runBettingPhase = async () => {
    if (stopped || !isLeader) return;

    const { roundNumber } = await state.resetRound();
    const phaseEndsAt = Date.now() + BETTING_DURATION_MS;
    await state.setPhase(0, phaseEndsAt);

    io.emit("keno:round-start", { roundNumber, phaseEndsAt });

    phaseTimer = setTimeout(runDrawingPhase, BETTING_DURATION_MS);
  };

  const runDrawingPhase = async () => {
    if (stopped || !isLeader) return;

    const phaseEndsAt = Date.now() + DRAWING_DURATION_MS;
    await state.setPhase(1, phaseEndsAt);

    io.emit("keno:drawing-start", { phaseEndsAt });

    const drawn: number[] = [];
    const numbers = drawNumbers();
    let index = 0;

    drawTimer = setInterval(async () => {
      if (stopped || !isLeader) {
        if (drawTimer) clearInterval(drawTimer);
        drawTimer = null;
        return;
      }

      drawn.push(numbers[index]);
      await state.setDrawn(drawn);
      io.emit("keno:number-drawn", {
        number: numbers[index],
        drawn: [...drawn],
      });

      index++;

      if (index >= DRAW_COUNT) {
        if (drawTimer) clearInterval(drawTimer);
        drawTimer = null;

        phaseTimer = setTimeout(() => runResultPhase(drawn), DRAWING_BUFFER_MS);
      }
    }, DRAW_INTERVAL_MS);
  };

  const runResultPhase = async (drawn: number[]) => {
    if (stopped || !isLeader) return;

    const phaseEndsAt = Date.now() + RESULT_DURATION_MS;
    await state.setPhase(2, phaseEndsAt);

    const roundId = (await state.getState()).roundId;

    // phaseEndsAt is included here (not just in the sync/round-start
    // events) so that spectators who never placed a bet still get a
    // correct RESULT-phase countdown, not just bettors.
    io.emit("keno:result", { drawn, roundId, phaseEndsAt });

    // ------------------------------------------------------
    // SETTLE EVERY ENTRY -- streamed so a 10k-entry round
    // doesn't require one giant in-memory array.
    // ------------------------------------------------------

    const settlements: Promise<void>[] = [];

    for await (const entry of state.iterateAllEntries()) {
      settlements.push(settleEntry(entry, drawn, roundId));
    }

    await Promise.all(settlements);

    phaseTimer = setTimeout(runBettingPhase, RESULT_DURATION_MS);
  };

  const settleEntry = async (
    entry: KenoEntry,
    drawn: number[],
    roundId: string | null,
  ) => {
    const { hits, multiplier, payout } = computeHitsAndPayout(
      entry.numbers,
      drawn,
      entry.amount,
    );

    try {
      if (payout > 0) {
        await walletService.settleCrashWin(entry.userId, payout, entry.amount);
        await recordKenoTransaction({
          userId: entry.userId,
          type: "win",
          amount: payout,
          roundId,
          hits,
          picks: entry.numbers.length,
        });
      } else {
        await walletService.consumeLockedBalance(entry.userId, entry.amount);
        await recordKenoTransaction({
          userId: entry.userId,
          type: "lose",
          amount: entry.amount,
          roundId,
          hits,
          picks: entry.numbers.length,
        });
      }

      await supabase.rpc("record_daily_activity", {
        p_user_id: entry.userId,
        p_activity_type: "played",
      });

      const wallet = await walletService.getWallet(entry.userId);

      io.to(entry.userId).emit("keno:my-result", {
        hits,
        multiplier,
        payout,
        wallet,
      });
      io.to(entry.userId).emit("keno:wallet", wallet);
    } catch (error) {
      console.error("Keno settlement error:", entry.userId, error);
    }
  };

  // ==========================================================
  // SOCKET REGISTRATION (every instance)
  // ==========================================================

  const registerSocket = (socket: CustomSocket) => {
    const userId = socket.user.userId;

    socket.join(userId);
    sendState(socket);

    socket.on("keno:requestState", () => sendState(socket));

    socket.on(
      "keno:bet",
      async (payload: unknown, callback?: (result: any) => void) => {
        const reply = (result: any) => {
          if (typeof callback === "function") callback(result);
        };

        try {
          if (!userId) return reply({ error: "You must be logged in" });

          const body =
            typeof payload === "object" && payload !== null
              ? (payload as { numbers?: unknown; amount?: unknown })
              : {};

          const numbers = Array.isArray(body.numbers)
            ? Array.from(new Set(body.numbers.map(Number)))
            : [];
          const amount = Number(body.amount);

          if (
            numbers.length < MIN_PICKS ||
            numbers.length > MAX_PICKS ||
            numbers.some((n) => !Number.isInteger(n) || n < 1 || n > BOARD_SIZE)
          ) {
            return reply({
              error: `Pick between ${MIN_PICKS} and ${MAX_PICKS} unique numbers from 1-${BOARD_SIZE}`,
            });
          }

          if (
            !Number.isFinite(amount) ||
            amount < MIN_BET ||
            amount > MAX_BET
          ) {
            return reply({
              error: `Bet must be between ${MIN_BET} and ${MAX_BET} ETB`,
            });
          }

          const locked = await walletService.lockandchcekBalance(
            userId,
            amount,
          );
          if (!locked) return reply({ error: "Insufficient funds" });

          const entry: KenoEntry = { userId, numbers, amount };
          const claim = await state.claimBet(entry);

          if (!claim.ok) {
            await walletService.unlockBalance(userId);
            return reply({
              error:
                claim.error === "PHASE_CLOSED"
                  ? "Betting is closed"
                  : "You already have a bet this round",
            });
          }

          void wageringService.recordWager(
            userId,
            amount,
            "Keno",
            (await state.getState()).roundId,
          );
          void pointsService.addGameplayPoints(userId, amount);

          const wallet = await walletService.getWallet(userId);
          reply({ ok: true, numbers, amount, wallet });
        } catch (error) {
          console.error("Keno bet error:", error);
          reply({ error: "Could not place the bet" });
        }
      },
    );
  };

  // ==========================================================
  // LEADER ELECTION
  // ==========================================================

  const becomeLeader = async () => {
    isLeader = true;
    console.log(`[keno] instance ${INSTANCE_ID} is now the round leader`);

    leaderRenewTimer = setInterval(async () => {
      const renewed = await state.renewLeadership(INSTANCE_ID, LEADER_TTL_MS);
      if (!renewed) {
        console.warn(`[keno] instance ${INSTANCE_ID} lost leadership`);
        isLeader = false;
        if (leaderRenewTimer) clearInterval(leaderRenewTimer);
        leaderRenewTimer = null;
        if (phaseTimer) clearTimeout(phaseTimer);
        if (drawTimer) clearInterval(drawTimer);
      }
    }, LEADER_RENEW_MS);

    await runBettingPhase();
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

  const stop = async () => {
    stopped = true;
    if (phaseTimer) clearTimeout(phaseTimer);
    if (drawTimer) clearInterval(drawTimer);
    if (leaderRenewTimer) clearInterval(leaderRenewTimer);
    if (leaderAcquireTimer) clearInterval(leaderAcquireTimer);
    if (isLeader) await state.releaseLeadership(INSTANCE_ID);
  };

  return { registerSocket, stop };
};

// ============================================================
// SINGLETON PER PROCESS (leader election decides which process
// actually drives the round clock -- see crash's game.ts for the
// same pattern)
// ============================================================

let kenoGameInstance: ReturnType<typeof kenoGame> | null = null;

export default function Keno(io: Server, socket: CustomSocket) {
  if (!kenoGameInstance) {
    kenoGameInstance = kenoGame(io);
  }

  kenoGameInstance.registerSocket(socket);
}

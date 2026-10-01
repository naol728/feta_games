/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import { wageringService } from "../../services/waggering.service";
import { pointsService } from "../../services/points.service";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

interface KenoEntry {
  userId: string;
  numbers: number[];
  amount: number;
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

const BETTING_DURATION_MS = 30_000;
const RESULT_DURATION_MS = 10_000;
// Small buffer after the 10th reveal before moving to RESULT, so the
// last number's animation has time to land before the phase flips.
const DRAWING_BUFFER_MS = 400;
const DRAWING_DURATION_MS = DRAW_COUNT * DRAW_INTERVAL_MS + DRAWING_BUFFER_MS;

// ============================================================
// IN-MEMORY STATE
// ============================================================
//
// This replaces the previous Redis-backed ./states module. All round
// state (phase, drawn numbers, per-user entries, leadership) now lives
// in plain process memory instead of a shared external store.
//
// IMPORTANT: this means state is NOT shared across multiple server
// instances/processes. Each process keeps its own independent Keno
// clock and entry list. This is fine for a single-instance deployment,
// but if you run more than one instance behind a load balancer,
// players on different instances will be in different, unsynchronized
// rounds. The leader-election plumbing below is left in place but is
// now a no-op (a process is always its own leader), since there's no
// longer any shared coordination point to elect a leader over.

type KenoPhase = 0 | 1 | 2; // 0 = betting, 1 = drawing, 2 = result

interface KenoMemState {
  phase: KenoPhase;
  roundNumber: number;
  roundId: string | null;
  phaseEndsAt: number;
  drawn: number[];
  entries: Map<string, KenoEntry>;
}

const memState: KenoMemState = {
  phase: 0,
  roundNumber: 0,
  roundId: null,
  phaseEndsAt: 0,
  drawn: [],
  entries: new Map(),
};

type ClaimBetResult =
  | { ok: true }
  | { ok: false; error: "PHASE_CLOSED" | "ALREADY_BET" };

const state = {
  async getState() {
    return {
      phase: memState.phase,
      roundNumber: memState.roundNumber,
      roundId: memState.roundId,
      phaseEndsAt: memState.phaseEndsAt,
      drawn: memState.drawn,
    };
  },

  async getEntry(userId: string): Promise<KenoEntry | null> {
    return memState.entries.get(userId) ?? null;
  },

  async resetRound(): Promise<{ roundNumber: number }> {
    memState.roundNumber += 1;
    memState.roundId = randomUUID();
    memState.drawn = [];
    memState.entries = new Map();
    return { roundNumber: memState.roundNumber };
  },

  async setPhase(phase: KenoPhase, phaseEndsAt: number): Promise<void> {
    memState.phase = phase;
    memState.phaseEndsAt = phaseEndsAt;
  },

  async setDrawn(drawn: number[]): Promise<void> {
    memState.drawn = drawn;
  },

  async claimBet(entry: KenoEntry): Promise<ClaimBetResult> {
    if (memState.phase !== 0) {
      return { ok: false, error: "PHASE_CLOSED" };
    }
    if (memState.entries.has(entry.userId)) {
      return { ok: false, error: "ALREADY_BET" };
    }
    memState.entries.set(entry.userId, entry);
    return { ok: true };
  },

  async *iterateAllEntries(): AsyncGenerator<KenoEntry> {
    for (const entry of memState.entries.values()) {
      yield entry;
    }
  },

  // Leadership is meaningless with per-process in-memory state: a
  // process only ever coordinates with itself, so it's always "the
  // leader" of its own state.
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
}): Promise<boolean> => {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount,
    status: "completed",
    reference_id: `keno_${roundId ?? "unknown"}_${userId}_${type}`,
    metadata: { game: "keno", round_id: roundId, hits, picks },
  });

  if (error) {
    if (error.code === "23505") {
      // Unique violation on reference_id -- this entry was already
      // settled by a previous call. Not a real error; just tell the
      // caller to skip the wallet mutation.
      console.warn(
        `[keno] duplicate settlement suppressed for ${userId} round ${roundId} (${type})`,
      );
      return false;
    }
    console.error("Failed to record keno transaction:", error);
    return false; // fail closed: if we can't confirm the log wrote, don't touch the wallet
  }

  return true;
};

// ============================================================
// GAME ENGINE
// ============================================================

const kenoGame = (io: Server) => {
  const INSTANCE_ID = randomUUID();
  const LEADER_TTL_MS = 8_000;
  const LEADER_RENEW_MS = 3_000;
  const RECOVERY_DELAY_MS = 2_000;

  let isLeader = false;
  let stopped = false;
  let leaderRenewTimer: NodeJS.Timeout | null = null;
  let leaderAcquireTimer: NodeJS.Timeout | null = null;
  let phaseTimer: NodeJS.Timeout | null = null;
  let drawTimer: NodeJS.Timeout | null = null;

  // ==========================================================
  // SAFETY HELPERS -- nothing async may ever reject unhandled
  // ==========================================================

  const fireAndForget = (
    label: string,
    fn: () => Promise<unknown> | unknown,
  ) => {
    Promise.resolve()
      .then(fn)
      .catch((err) => console.error(`[keno] ${label} failed:`, err));
  };

  const scheduleNext = (fn: () => Promise<void>, ms: number, label: string) => {
    if (stopped) return;
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = setTimeout(() => {
      fn().catch((err) => {
        console.error(`[keno] ${label} crashed:`, err);
      });
    }, ms);
  };

  // ==========================================================
  // SYNC
  // ==========================================================

  const sendState = async (socket: CustomSocket) => {
    try {
      const snapshot = await state.getState();
      const userId = socket.user?.userId;
      const yourEntry = userId ? await state.getEntry(userId) : null;

      socket.emit("keno:sync", {
        phase: snapshot.phase,
        roundNumber: snapshot.roundNumber,
        phaseEndsAt: snapshot.phaseEndsAt,
        drawn: snapshot.drawn,
        yourEntry,
      });
    } catch (error) {
      console.error("[keno] sendState error:", error);
    }
  };

  // ==========================================================
  // ROUND LIFECYCLE (leader only)
  // ==========================================================

  const runBettingPhase = async (): Promise<void> => {
    if (stopped || !isLeader) return;

    try {
      const { roundNumber } = await state.resetRound();
      const phaseEndsAt = Date.now() + BETTING_DURATION_MS;
      await state.setPhase(0, phaseEndsAt);

      io.emit("keno:round-start", { roundNumber, phaseEndsAt });

      scheduleNext(runDrawingPhase, BETTING_DURATION_MS, "drawing phase");
    } catch (error) {
      console.error("[keno] betting phase error, retrying:", error);
      scheduleNext(runBettingPhase, RECOVERY_DELAY_MS, "betting phase");
    }
  };

  const runDrawingPhase = async (): Promise<void> => {
    if (stopped || !isLeader) return;

    try {
      const phaseEndsAt = Date.now() + DRAWING_DURATION_MS;
      await state.setPhase(1, phaseEndsAt);

      io.emit("keno:drawing-start", { phaseEndsAt });

      const drawn: number[] = [];
      const numbers = drawNumbers();
      let index = 0;
      let ticking = false;

      drawTimer = setInterval(() => {
        if (ticking) return; // never overlap ticks
        ticking = true;

        (async () => {
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
            scheduleNext(
              () => runResultPhase(drawn),
              DRAWING_BUFFER_MS,
              "result phase",
            );
          }
        })()
          .catch((error) => {
            console.error("[keno] draw tick error:", error);
          })
          .finally(() => {
            ticking = false;
          });
      }, DRAW_INTERVAL_MS);
    } catch (error) {
      console.error("[keno] drawing phase error, restarting round:", error);
      if (drawTimer) clearInterval(drawTimer);
      drawTimer = null;
      scheduleNext(runBettingPhase, RECOVERY_DELAY_MS, "betting phase");
    }
  };

  const runResultPhase = async (drawn: number[]): Promise<void> => {
    if (stopped || !isLeader) return;

    try {
      const phaseEndsAt = Date.now() + RESULT_DURATION_MS;
      await state.setPhase(2, phaseEndsAt);

      const roundId = (await state.getState()).roundId;

      io.emit("keno:result", { drawn, roundId, phaseEndsAt });

      const settlements: Promise<void>[] = [];
      for await (const entry of state.iterateAllEntries()) {
        settlements.push(settleEntry(entry, drawn, roundId));
      }
      await Promise.all(settlements);
    } catch (error) {
      console.error("[keno] result phase error:", error);
    } finally {
      // Always keep the game loop alive, even if settlement blew up.
      scheduleNext(runBettingPhase, RESULT_DURATION_MS, "betting phase");
    }
  };

  const settleEntry = async (
    entry: KenoEntry,
    drawn: number[],
    roundId: string | null,
  ): Promise<void> => {
    try {
      const { hits, multiplier, payout } = computeHitsAndPayout(
        entry.numbers,
        drawn,
        entry.amount,
      );
      const isWin = payout > 0;

      // Ledger row first: the unique reference_id is our idempotency lock.
      const inserted = await recordKenoTransaction({
        userId: entry.userId,
        type: isWin ? "win" : "lose",
        amount: isWin ? payout : entry.amount,
        roundId,
        hits,
        picks: entry.numbers.length,
      });

      if (!inserted) return;

      if (isWin) {
        await walletService.settleCrashWin(entry.userId, payout, entry.amount);
      } else {
        await walletService.consumeLockedBalance(entry.userId, entry.amount);
      }

      fireAndForget("record_daily_activity", () =>
        supabase.rpc("record_daily_activity", {
          p_user_id: entry.userId,
          p_activity_type: "played",
        }),
      );

      const wallet = await walletService.getWallet(entry.userId);

      io.to(entry.userId).emit("keno:my-result", {
        hits,
        multiplier,
        payout,
        wallet,
      });
      io.to(entry.userId).emit("keno:wallet", wallet);
    } catch (error) {
      console.error("[keno] settlement error:", entry.userId, error);
    }
  };

  // ==========================================================
  // SOCKET HANDLERS
  // ==========================================================

  const registerSocket = (socket: CustomSocket) => {
    const userId = socket.user?.userId;

    if (userId) socket.join(userId);
    void sendState(socket);

    socket.on("keno:requestState", () => {
      void sendState(socket);
    });

    socket.on(
      "keno:bet",
      async (payload: unknown, callback?: (result: any) => void) => {
        const reply = (result: any) => {
          try {
            if (typeof callback === "function") callback(result);
          } catch (err) {
            console.error("[keno] bet callback error:", err);
          }
        };

        let locked = false;
        let claimed = false;

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

          const lockedOk = await walletService.lockandchcekBalance(
            userId,
            amount,
          );
          if (!lockedOk) return reply({ error: "Insufficient funds" });
          locked = true;

          const entry: KenoEntry = { userId, numbers, amount };
          const claim = await state.claimBet(entry);

          if (!claim.ok) {
            await walletService.unlockBalance(userId);
            locked = false;
            return reply({
              error:
                claim.error === "PHASE_CLOSED"
                  ? "Betting is closed"
                  : "You already have a bet this round",
            });
          }
          claimed = true; // bet is now live; never unlock past this point

          const roundId = (await state.getState()).roundId;
          fireAndForget("recordWager", () =>
            wageringService.recordWager(userId, amount, "Keno", roundId),
          );
          fireAndForget("addGameplayPoints", () =>
            pointsService.addGameplayPoints(userId, amount),
          );

          let wallet: unknown = null;
          try {
            wallet = await walletService.getWallet(userId);
          } catch (err) {
            console.error("[keno] getWallet after bet failed:", err);
          }

          return reply({ ok: true, numbers, amount, wallet });
        } catch (error) {
          console.error("[keno] bet error:", userId, error);

          // Bet failed before it was registered: give the money back.
          if (locked && !claimed && userId) {
            try {
              await walletService.unlockBalance(userId);
            } catch (unlockErr) {
              console.error(
                "[keno] unlock after failed bet failed:",
                unlockErr,
              );
            }
          }

          reply({ error: "Something went wrong, please try again" });
        }
      },
    );
  };

  // ==========================================================
  // LEADER ELECTION (no-op with in-memory state -- kept for shape)
  // ==========================================================

  const becomeLeader = async () => {
    isLeader = true;

    leaderRenewTimer = setInterval(() => {
      state
        .renewLeadership(INSTANCE_ID, LEADER_TTL_MS)
        .then((renewed) => {
          if (!renewed) {
            console.warn(`[keno] instance ${INSTANCE_ID} lost leadership`);
            isLeader = false;
            if (leaderRenewTimer) clearInterval(leaderRenewTimer);
            leaderRenewTimer = null;
            if (phaseTimer) clearTimeout(phaseTimer);
            if (drawTimer) clearInterval(drawTimer);
          }
        })
        .catch((err) => console.error("[keno] renewLeadership error:", err));
    }, LEADER_RENEW_MS);

    await runBettingPhase();
  };

  const pollForLeadership = async () => {
    try {
      if (stopped || isLeader) return;
      const acquired = await state.tryAcquireLeadership(
        INSTANCE_ID,
        LEADER_TTL_MS,
      );
      if (acquired) await becomeLeader();
    } catch (error) {
      console.error("[keno] pollForLeadership error:", error);
    }
  };

  leaderAcquireTimer = setInterval(() => {
    void pollForLeadership();
  }, LEADER_RENEW_MS);
  void pollForLeadership();

  const stop = async () => {
    stopped = true;
    if (phaseTimer) clearTimeout(phaseTimer);
    if (drawTimer) clearInterval(drawTimer);
    if (leaderRenewTimer) clearInterval(leaderRenewTimer);
    if (leaderAcquireTimer) clearInterval(leaderAcquireTimer);
    try {
      if (isLeader) await state.releaseLeadership(INSTANCE_ID);
    } catch (error) {
      console.error("[keno] releaseLeadership error:", error);
    }
  };

  return { registerSocket, stop };
};

// ============================================================
// SINGLETON PER PROCESS
// ============================================================

let kenoGameInstance: ReturnType<typeof kenoGame> | null = null;

export default function Keno(io: Server, socket: CustomSocket) {
  if (!kenoGameInstance) {
    kenoGameInstance = kenoGame(io);
  }

  kenoGameInstance.registerSocket(socket);
}

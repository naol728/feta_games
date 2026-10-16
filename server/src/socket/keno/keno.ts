/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import {
  lockBet,
  settleGameBatch,
  SettleEntry,
} from "../../services/game-settlement.service";

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

const GAME_NAME = "keno";
const BOARD_SIZE = 40;
const DRAW_COUNT = 10;
const DRAW_INTERVAL_MS = 200;
const MIN_PICKS = 1;
const MAX_PICKS = 10;
const MIN_BET = 1;
const MAX_BET = 50_000;

const BETTING_DURATION_MS = 30_000;
const RESULT_DURATION_MS = 10_000;
const DRAWING_BUFFER_MS = 400;
const DRAWING_DURATION_MS = DRAW_COUNT * DRAW_INTERVAL_MS + DRAWING_BUFFER_MS;

// ============================================================
// IN-MEMORY STATE
// ============================================================

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
// PAYTABLE
// ============================================================

const PAYTABLE: Record<number, Record<number, number>> = {
  1: { 1: 2.4 },
  2: { 2: 10.4 },
  3: { 2: 3.51, 3: 9.92 },
  4: { 3: 13.07, 4: 36.99 },
  5: { 3: 5.54, 4: 15.65, 5: 28.76 },
  6: { 3: 2.93, 4: 8.28, 5: 15.22, 6: 23.43 },
  7: { 4: 9.35, 5: 26.44, 6: 48.58, 7: 74.79 },
  8: { 4: 5.04, 5: 14.26, 6: 26.2, 7: 40.34, 8: 56.38 },
  9: { 5: 17.09, 6: 48.34, 7: 88.82, 8: 136.74, 9: 191.1 },
  10: { 5: 9.27, 6: 26.22, 7: 48.17, 8: 74.16, 9: 103.64, 10: 136.24 },
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
  for (let i = 0; i < DRAW_COUNT; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DRAW_COUNT);
}

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
  // ROUND LIFECYCLE
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
        if (ticking) return;
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

      const roundId = (await state.getState()).roundId ?? "unknown";

      io.emit("keno:result", { drawn, roundId, phaseEndsAt });

      const outcomes = new Map<
        string,
        { hits: number; multiplier: number; payout: number }
      >();
      const entries: SettleEntry[] = [];

      for await (const entry of state.iterateAllEntries()) {
        const outcome = computeHitsAndPayout(
          entry.numbers,
          drawn,
          entry.amount,
        );
        outcomes.set(entry.userId, outcome);
        entries.push({
          userId: entry.userId,
          bet: entry.amount,
          payout: outcome.payout,
          metadata: { hits: outcome.hits, picks: entry.numbers.length },
        });
      }

      if (entries.length === 0) return;

      const results = await settleGameBatch(GAME_NAME, roundId, entries);

      for (const res of results) {
        if (res.status !== "ok" || !res.wallet) continue;
        const outcome = outcomes.get(res.user_id);
        if (!outcome) continue;

        io.to(res.user_id).emit("keno:my-result", {
          hits: outcome.hits,
          multiplier: outcome.multiplier,
          payout: outcome.payout,
          wallet: res.wallet,
        });
        io.to(res.user_id).emit("keno:wallet", res.wallet);
      }
    } catch (error) {
      console.error("[keno] result phase error:", error);
    } finally {
      scheduleNext(runBettingPhase, RESULT_DURATION_MS, "betting phase");
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

          const snapshot = await state.getState();
          if (snapshot.phase !== 0) {
            return reply({ error: "Betting is closed" });
          }
          if (await state.getEntry(userId)) {
            return reply({ error: "You already have a bet this round" });
          }

          // 🆕 Release any stale lock left behind by a crashed or
          // abandoned round. No-op when nothing is locked. Never throws.
          await walletService.releaseAllLocks(userId);

          // One DB call: lock funds and get the fresh wallet back.
          const wallet = await lockBet(userId, amount);
          if (!wallet) return reply({ error: "Insufficient funds" });
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
          claimed = true;

          // 🆕 Push the new (locked) wallet to every tab the user has open.
          socket.emit("balance:update", wallet);
          io.to(userId).emit("balance:update", wallet);

          return reply({ ok: true, numbers, amount, wallet });
        } catch (error) {
          console.error("[keno] bet error:", userId, error);

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
  // LEADER ELECTION (no-op with in-memory state)
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

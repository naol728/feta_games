/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import {
  lockBet,
  settleGameBatch,
  SettleEntry,
} from "../../services/game-settlement.service";
import {
  VALID_SPOTS,
  randomPocket,
  settle,
  sumBets,
  type Bets,
  type Pocket,
} from "./roulette.logic";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

interface RouletteEntry {
  userId: string;
  bets: Bets; // spot -> chips on that spot
  amount: number; // total stake
}

interface MyResult {
  staked: number;
  returned: number;
  net: number;
}

// ============================================================
// CONFIG — one round = 30s
// ============================================================

const GAME_NAME = "roulette";
const BETTING_DURATION_MS = 15_000;
const SPINNING_DURATION_MS = 10_000;
const RESULT_DURATION_MS = 5_000;

const MIN_BET = 1;
const MAX_BET = 50_000;
const MAX_SPOTS = 50;
const MAX_RECENT = 12;

// ============================================================
// IN-MEMORY STATE
// ============================================================

type RoulettePhase = 0 | 1 | 2; // 0 = betting, 1 = spinning, 2 = result

interface RouletteMemState {
  phase: RoulettePhase;
  roundNumber: number;
  roundId: string | null;
  phaseEndsAt: number;
  winning: Pocket | null;
  entries: Map<string, RouletteEntry>;
  results: Map<string, MyResult>;
  recent: Pocket[];
}

const memState: RouletteMemState = {
  phase: 0,
  roundNumber: 0,
  roundId: null,
  phaseEndsAt: 0,
  winning: null,
  entries: new Map(),
  results: new Map(),
  recent: [],
};

type ClaimBetResult =
  | { ok: true }
  | { ok: false; error: "PHASE_CLOSED" | "ALREADY_BET" };

const state = {
  snapshot() {
    return {
      phase: memState.phase,
      roundNumber: memState.roundNumber,
      roundId: memState.roundId,
      phaseEndsAt: memState.phaseEndsAt,
      winning: memState.phase >= 1 ? memState.winning : null,
      recent: memState.recent,
    };
  },

  resetRound() {
    memState.roundNumber += 1;
    memState.roundId = randomUUID();
    memState.winning = null;
    memState.entries = new Map();
    memState.results = new Map();
    return { roundNumber: memState.roundNumber };
  },

  setPhase(phase: RoulettePhase, phaseEndsAt: number) {
    memState.phase = phase;
    memState.phaseEndsAt = phaseEndsAt;
  },

  claimBet(entry: RouletteEntry): ClaimBetResult {
    if (memState.phase !== 0 || Date.now() >= memState.phaseEndsAt) {
      return { ok: false, error: "PHASE_CLOSED" };
    }
    if (memState.entries.has(entry.userId)) {
      return { ok: false, error: "ALREADY_BET" };
    }
    memState.entries.set(entry.userId, entry);
    return { ok: true };
  },
};

// ============================================================
// GAME ENGINE
// ============================================================

const rouletteGame = (io: Server) => {
  const RECOVERY_DELAY_MS = 2_000;
  let phaseTimer: NodeJS.Timeout | null = null;

  // Users whose bet is mid-flight (between lockBet and claimBet).
  const inFlight = new Set<string>();

  const scheduleAt = (fn: () => Promise<void>, ts: number, label: string) => {
    if (phaseTimer) clearTimeout(phaseTimer);
    phaseTimer = setTimeout(
      () => {
        fn().catch((err) => console.error(`[roulette] ${label} crashed:`, err));
      },
      Math.max(0, ts - Date.now()),
    );
  };

  // ==========================================================
  // SYNC
  // ==========================================================

  const sendState = (socket: CustomSocket) => {
    try {
      const snap = state.snapshot();
      const userId = socket.user?.userId;

      socket.emit("roulette:sync", {
        ...snap,
        winning: snap.winning
          ? { nr: snap.winning.nr, color: snap.winning.color }
          : null,
        recent: snap.recent.map((p) => ({ nr: p.nr, color: p.color })),
        serverTime: Date.now(),
        yourEntry: userId ? (memState.entries.get(userId) ?? null) : null,
        yourResult: userId ? (memState.results.get(userId) ?? null) : null,
      });
    } catch (error) {
      console.error("[roulette] sendState error:", error);
    }
  };

  // ==========================================================
  // ROUND LIFECYCLE
  // ==========================================================

  const runBettingPhase = async (): Promise<void> => {
    try {
      const { roundNumber } = state.resetRound();
      const phaseEndsAt = Date.now() + BETTING_DURATION_MS;
      state.setPhase(0, phaseEndsAt);

      io.emit("roulette:round-start", {
        roundNumber,
        phaseEndsAt,
        serverTime: Date.now(),
      });

      scheduleAt(runSpinPhase, phaseEndsAt, "spin phase");
    } catch (error) {
      console.error("[roulette] betting phase error, retrying:", error);
      scheduleAt(
        runBettingPhase,
        Date.now() + RECOVERY_DELAY_MS,
        "betting phase",
      );
    }
  };

  const runSpinPhase = async (): Promise<void> => {
    try {
      memState.winning = randomPocket();
      const phaseEndsAt = Date.now() + SPINNING_DURATION_MS;
      state.setPhase(1, phaseEndsAt);

      io.emit("roulette:spin-start", {
        winning: memState.winning.nr,
        color: memState.winning.color,
        phaseEndsAt,
        serverTime: Date.now(),
      });

      scheduleAt(runResultPhase, phaseEndsAt, "result phase");
    } catch (error) {
      console.error("[roulette] spin phase error, restarting round:", error);
      scheduleAt(
        runBettingPhase,
        Date.now() + RECOVERY_DELAY_MS,
        "betting phase",
      );
    }
  };

  const runResultPhase = async (): Promise<void> => {
    const phaseEndsAt = Date.now() + RESULT_DURATION_MS;

    try {
      const winning = memState.winning;
      if (!winning)
        throw new Error("result phase reached with no winning number");

      state.setPhase(2, phaseEndsAt);
      memState.recent = [winning, ...memState.recent].slice(0, MAX_RECENT);

      const roundId = memState.roundId ?? "unknown";

      io.emit("roulette:result", {
        winning: { nr: winning.nr, color: winning.color },
        roundId,
        phaseEndsAt,
        recent: memState.recent.map((p) => ({ nr: p.nr, color: p.color })),
      });

      const outcomes = new Map<string, MyResult>();
      const entries: SettleEntry[] = [];

      for (const entry of memState.entries.values()) {
        const s = settle(entry.bets, winning);
        outcomes.set(entry.userId, {
          staked: s.staked,
          returned: s.returned,
          net: s.net,
        });
        entries.push({
          userId: entry.userId,
          bet: entry.amount,
          payout: s.returned, // total returned: stake + winnings
          metadata: {
            winning: winning.nr,
            color: winning.color,
            spots: Object.keys(entry.bets).length,
            bets: entry.bets,
          },
        });
      }

      if (entries.length === 0) return;

      const results = await settleGameBatch(GAME_NAME, roundId, entries);

      for (const res of results) {
        if (res.status !== "ok" || !res.wallet) continue;
        const outcome = outcomes.get(res.user_id);
        if (!outcome) continue;

        memState.results.set(res.user_id, outcome);
        io.to(res.user_id).emit("roulette:my-result", {
          ...outcome,
          winning: { nr: winning.nr, color: winning.color },
          wallet: res.wallet,
        });
        io.to(res.user_id).emit("roulette:wallet", res.wallet);
      }
    } catch (error) {
      console.error("[roulette] result phase error:", error);
    } finally {
      scheduleAt(runBettingPhase, phaseEndsAt, "betting phase");
    }
  };

  // ==========================================================
  // SOCKET HANDLERS
  // ==========================================================

  const registerSocket = (socket: CustomSocket) => {
    const userId = socket.user?.userId;

    if (userId) socket.join(userId);
    sendState(socket);

    socket.on("roulette:requestState", () => {
      sendState(socket);
    });

    socket.on(
      "roulette:bet",
      async (payload: unknown, callback?: (result: any) => void) => {
        const reply = (result: any) => {
          try {
            if (typeof callback === "function") callback(result);
          } catch (err) {
            console.error("[roulette] bet callback error:", err);
          }
        };

        let locked = false;
        let claimed = false;
        let guarded = false;

        try {
          if (!userId) return reply({ error: "You must be logged in" });

          const raw =
            typeof payload === "object" && payload !== null
              ? (payload as { bets?: unknown }).bets
              : undefined;

          if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
            return reply({ error: "Invalid bet" });
          }

          const bets: Bets = {};
          for (const [spot, value] of Object.entries(raw)) {
            const chips = Number(value);
            if (
              !VALID_SPOTS.has(spot) ||
              !Number.isInteger(chips) ||
              chips < 1
            ) {
              return reply({ error: "Invalid bet" });
            }
            bets[spot] = chips;
          }

          const spots = Object.keys(bets).length;
          const amount = sumBets(bets);

          if (spots === 0 || spots > MAX_SPOTS) {
            return reply({ error: `Pick between 1 and ${MAX_SPOTS} spots` });
          }
          if (amount < MIN_BET || amount > MAX_BET) {
            return reply({
              error: `Bet must be between ${MIN_BET} and ${MAX_BET} ETB`,
            });
          }

          if (inFlight.has(userId)) {
            return reply({ error: "Bet already in progress" });
          }
          inFlight.add(userId);
          guarded = true;

          // Cheap in-memory pre-checks first, so a closed round or a
          // duplicate bet never costs a database write.
          if (memState.phase !== 0 || Date.now() >= memState.phaseEndsAt) {
            return reply({ error: "Betting is closed" });
          }
          if (memState.entries.has(userId)) {
            return reply({ error: "You already have a bet this round" });
          }

          // 🆕 Release any stale lock left behind by a crashed or
          // abandoned round. No-op when nothing is locked. Never throws.
          await walletService.releaseAllLocks(userId);

          // One DB call: lock funds and get the fresh wallet back.
          const wallet = await lockBet(userId, amount);
          if (!wallet) return reply({ error: "Insufficient funds" });
          locked = true;

          const claim = state.claimBet({ userId, bets, amount });

          if (!claim.ok) {
            // The phase flipped while we were waiting on the wallet.
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

          return reply({ ok: true, bets, amount, wallet });
        } catch (error) {
          console.error("[roulette] bet error:", userId, error);

          if (locked && !claimed && userId) {
            try {
              await walletService.unlockBalance(userId);
            } catch (unlockErr) {
              console.error(
                "[roulette] unlock after failed bet failed:",
                unlockErr,
              );
            }
          }

          reply({ error: "Something went wrong, please try again" });
        } finally {
          if (guarded && userId) inFlight.delete(userId);
        }
      },
    );
  };

  void runBettingPhase();

  return { registerSocket };
};

// ============================================================
// SINGLETON PER PROCESS
// ============================================================

let rouletteGameInstance: ReturnType<typeof rouletteGame> | null = null;

export default function Roulette(io: Server, socket: CustomSocket) {
  if (!rouletteGameInstance) {
    rouletteGameInstance = rouletteGame(io);
  }

  rouletteGameInstance.registerSocket(socket);
}

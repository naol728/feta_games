// ============================================================
// Roulette — shared types, payout rules and the round state machine
//
//   idle ──SUBMIT──▶ awaiting ──SPIN_STARTED──▶ spinning ──SPIN_FINISHED──▶ result
//     ▲                 │                                                     │
//     └──── FAILED ─────┘                         NEW_ROUND / REBET ◀─────────┘
// ============================================================

// ---------- Types ----------
export type TableType = "european" | "american";
export type Phase = "idle" | "awaiting" | "spinning" | "result";

/** spot text ("17", "reds", "1st 12", …) -> total chips on that spot */
export type BetMap = Record<string, number>;

export interface PlacedBet {
  text: string;
  amount: number;
}

export interface Pocket {
  nr: string;
  color: "red" | "black" | "green";
}

/** Sent by the server on `roulette_read`. `monkey` = the winning number. */
export interface SpinParams {
  arc: number;
  spin_time: number;
  ball_speed: number;
  monkey?: number | string;
}

export interface RoundResult {
  winning: Pocket;
  bets: PlacedBet[];
  staked: number;
  returned: number; // stake + winnings of every winning spot
  net: number; // returned - staked
}

export interface RouletteState {
  phase: Phase;
  round: number;
  bets: BetMap;
  placements: PlacedBet[]; // undo stack
  lastBets: BetMap; // bets of the last submitted round (for Rebet)
  chip: number;
  spin: SpinParams | null;
  result: RoundResult | null;
  recent: Pocket[];
  startBalance: number;
  error: string | null;
}

// ---------- Constants ----------
export const CHIPS = [1, 5, 10, 25, 100] as const;
export const SERVER_TIMEOUT_MS = 15_000;
export const MAX_RECENT = 12;

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);
const DOZEN = /^[123]st 12$/;
const COLUMN = /^2 to 1[abc]$/;
const STRAIGHT = /^\d+$/;

// ---------- Helpers ----------
export const pocketFromNumber = (nr: string | number): Pocket => {
  const s = String(nr);
  if (s === "0" || s === "00") return { nr: s, color: "green" };
  return { nr: s, color: RED.has(Number(s)) ? "red" : "black" };
};

export const sumBets = (bets: BetMap): number =>
  Object.values(bets).reduce((a, b) => a + b, 0);

export const toList = (bets: BetMap): PlacedBet[] =>
  Object.entries(bets).map(([text, amount]) => ({ text, amount }));

/** Profit multiplier (stake is returned on top of it). */
export const payoutMultiplier = (text: string): number => {
  if (STRAIGHT.test(text)) return 35;
  if (DOZEN.test(text) || COLUMN.test(text)) return 2;
  return 1;
};

export const spotWins = (text: string, win: Pocket): boolean => {
  if (STRAIGHT.test(text)) return text === win.nr; // "0" and "00" are separate spots
  if (win.color === "green") return false; // zero kills every outside bet
  const n = Number(win.nr);
  switch (text) {
    case "1st 12":
      return n >= 1 && n <= 12;
    case "2st 12":
      return n >= 13 && n <= 24; // label spelled as the table emits it
    case "3st 12":
      return n >= 25 && n <= 36;
    case "1-18":
      return n <= 18;
    case "19-36":
      return n >= 19;
    case "Even":
      return n % 2 === 0;
    case "Odd":
      return n % 2 === 1;
    case "reds":
      return win.color === "red";
    case "blacks":
      return win.color === "black";
    case "2 to 1a":
      return n % 3 === 0; // 3, 6, 9 …
    case "2 to 1b":
      return n % 3 === 2; // 2, 5, 8 …
    case "2 to 1c":
      return n % 3 === 1; // 1, 4, 7 …
    default:
      return false;
  }
};

export const settle = (bets: PlacedBet[], winning: Pocket): RoundResult => {
  let staked = 0;
  let returned = 0;
  for (const b of bets) {
    staked += b.amount;
    if (spotWins(b.text, winning))
      returned += b.amount * (payoutMultiplier(b.text) + 1);
  }
  return { winning, bets, staked, returned, net: returned - staked };
};

// ---------- Reducer ----------
export const createInitialState = (): RouletteState => ({
  phase: "idle",
  round: 0,
  bets: {},
  placements: [],
  lastBets: {},
  chip: CHIPS[0],
  spin: null,
  result: null,
  recent: [],
  startBalance: 0,
  error: null,
});

export type RouletteAction =
  | { type: "SELECT_CHIP"; chip: number }
  | { type: "PLACE"; text: string }
  | { type: "SET_BETS"; bets: BetMap } // ← new
  | { type: "UNDO" }
  | { type: "CLEAR" }
  | { type: "REBET" }
  | { type: "SUBMIT"; balance: number }
  | { type: "SPIN_STARTED"; params: SpinParams }
  | { type: "SPIN_FINISHED"; winning: Pocket }
  | { type: "FAILED"; error: string }
  | { type: "NEW_ROUND" }
  | { type: "DISMISS_ERROR" };

export function rouletteReducer(
  s: RouletteState,
  a: RouletteAction,
): RouletteState {
  switch (a.type) {
    case "SELECT_CHIP":
      return s.phase === "idle" ? { ...s, chip: a.chip } : s;

    case "PLACE": {
      if (s.phase !== "idle") return s;
      return {
        ...s,
        bets: { ...s.bets, [a.text]: (s.bets[a.text] ?? 0) + s.chip },
        placements: [...s.placements, { text: a.text, amount: s.chip }],
        error: null,
      };
    }

    case "UNDO": {
      const last = s.placements[s.placements.length - 1];
      if (s.phase !== "idle" || !last) return s;
      const left = (s.bets[last.text] ?? 0) - last.amount;
      const bets = { ...s.bets };
      if (left <= 0) delete bets[last.text];
      else bets[last.text] = left;
      return { ...s, bets, placements: s.placements.slice(0, -1) };
    }

    case "CLEAR":
      return s.phase === "idle" ? { ...s, bets: {}, placements: [] } : s;

    case "REBET": {
      if ((s.phase !== "idle" && s.phase !== "result") || !sumBets(s.lastBets))
        return s;
      return {
        ...s,
        phase: "idle",
        bets: { ...s.lastBets },
        placements: toList(s.lastBets),
        result: null,
        spin: null,
        error: null,
      };
    }

    case "SUBMIT": {
      // Rounds are timed: the wheel spins even if nobody bet (staked = 0).
      if (s.phase !== "idle") return s;
      return {
        ...s,
        phase: "awaiting",
        round: s.round + 1,
        // keep the previous bet for "Repeat" if this round was empty
        lastBets: sumBets(s.bets) > 0 ? { ...s.bets } : s.lastBets,
        startBalance: a.balance,
        result: null,
        spin: null,
        error: null,
      };
    }

    case "SPIN_STARTED":
      return s.phase === "awaiting"
        ? { ...s, phase: "spinning", spin: a.params }
        : s;

    case "SPIN_FINISHED": {
      if (s.phase !== "spinning") return s;
      // The server's number is authoritative; the animation is only cosmetic.
      const winning =
        s.spin?.monkey != null ? pocketFromNumber(s.spin.monkey) : a.winning;
      return {
        ...s,
        phase: "result",
        result: settle(toList(s.bets), winning),
        recent: [winning, ...s.recent].slice(0, MAX_RECENT),
      };
    }

    case "FAILED":
      return s.phase === "awaiting"
        ? { ...s, phase: "idle", error: a.error }
        : s;

    case "NEW_ROUND":
      return s.phase === "result"
        ? {
            ...s,
            phase: "idle",
            bets: {},
            placements: [],
            result: null,
            spin: null,
            error: null,
          }
        : s;

    case "DISMISS_ERROR":
      return { ...s, error: null };
    case "SET_BETS": {
      if (s.phase !== "idle") return s;
      return {
        ...s,
        bets: { ...a.bets },
        placements: toList(a.bets),
        error: null,
      };
    }

    default:
      return s;
  }
}

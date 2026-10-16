import { randomInt } from "crypto";

// ============================================================
// Roulette — pure game rules (European, single zero).
// No I/O in here, so it is trivial to unit-test.
// ============================================================

export type Color = "red" | "black" | "green";

export interface Pocket {
  nr: string;
  color: Color;
}

/** spot text ("17", "reds", "1st 12", …) -> total chips on that spot */
export type Bets = Record<string, number>;

export const CHIPS = [1, 5, 10, 25, 100] as const;

const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

// Spot names must match exactly what the frontend table emits
// (including the "2st 12" / "3st 12" spelling).
const NUMBER_SPOTS = Array.from({ length: 37 }, (_, i) => String(i));
const OUTSIDE_SPOTS = [
  "1st 12",
  "2st 12",
  "3st 12",
  "1-18",
  "19-36",
  "Even",
  "Odd",
  "reds",
  "blacks",
  "2 to 1a",
  "2 to 1b",
  "2 to 1c",
];
export const VALID_SPOTS = new Set<string>([...NUMBER_SPOTS, ...OUTSIDE_SPOTS]);

const STRAIGHT = /^\d+$/;
const DOZEN = /^[123]st 12$|^2st 12$/;
const COLUMN = /^2 to 1[abc]$/;

export const pocketFromNumber = (nr: number | string): Pocket => {
  const s = String(nr);
  if (s === "0") return { nr: s, color: "green" };
  return { nr: s, color: RED.has(Number(s)) ? "red" : "black" };
};

/** Cryptographically secure, uniform 0–36. */
export const randomPocket = (): Pocket => pocketFromNumber(randomInt(0, 37));

export const sumBets = (bets: Bets): number =>
  Object.values(bets).reduce((a, b) => a + b, 0);

/** Profit multiplier (the stake is returned on top of it). */
export const payoutMultiplier = (spot: string): number => {
  if (STRAIGHT.test(spot)) return 35;
  if (DOZEN.test(spot) || COLUMN.test(spot)) return 2;
  return 1;
};

export const spotWins = (spot: string, win: Pocket): boolean => {
  if (STRAIGHT.test(spot)) return spot === win.nr;
  if (win.color === "green") return false; // zero kills every outside bet
  const n = Number(win.nr);
  switch (spot) {
    case "1st 12":
      return n >= 1 && n <= 12;
    case "2st 12":
      return n >= 13 && n <= 24;
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
      return n % 3 === 0;
    case "2 to 1b":
      return n % 3 === 2;
    case "2 to 1c":
      return n % 3 === 1;
    default:
      return false;
  }
};

export interface Settlement {
  staked: number;
  returned: number; // stake + winnings of every winning spot
  net: number; // returned - staked
  lines: { spot: string; amount: number; won: boolean }[];
}

export const settle = (bets: Bets, winning: Pocket): Settlement => {
  let staked = 0;
  let returned = 0;
  const lines: Settlement["lines"] = [];
  for (const [spot, amount] of Object.entries(bets)) {
    const won = spotWins(spot, winning);
    staked += amount;
    if (won) returned += amount * (payoutMultiplier(spot) + 1);
    lines.push({ spot, amount, won });
  }
  return { staked, returned, net: returned - staked, lines };
};

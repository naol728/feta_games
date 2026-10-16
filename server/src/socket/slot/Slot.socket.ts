/* eslint-disable */

import { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";

import { supabase } from "../../config/supabase";
import { walletService } from "../../services/wallet.service";
import { lockBet, settleOne } from "../../services/game-settlement.service";
// ============================================================
// FLOW
// ============================================================
// Each spin is self-contained (no shared round state, no Redis).
//   1. releaseAllLocks -> free any stale lock from a crashed spin
//   2. lockBet         -> checks balance, moves bet into locked_balance
//   3. generateGrid    -> roll ONLY after the bet is locked
//   4. settleOne       -> settle_game RPC, atomically:
//        - writes the transactions ledger row (idempotency lock)
//        - updates wagering progress
//        - releases locked bet, credits payout (balance or withdrawable)
//        - adds gameplay points + daily activity
//      and returns the fresh wallet.
// ============================================================

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

const SYMBOLS = [
  "red",
  "blue",
  "green",
  "yin_yang",
  "hakkero",
  "yellow",
  "wild",
] as const;

type SymbolName = (typeof SYMBOLS)[number];

interface SlotWin {
  line: string;
  symbol: SymbolName;
  multiplier: number;
  payout: number;
}

const MIN_BET = 1;
const MAX_BET = 50_000;

const PAYOUTS: Record<SymbolName, number> = {
  red: 1.1,
  blue: 1.2,
  green: 1.3,
  yin_yang: 1.4,
  hakkero: 1.5,
  yellow: 1.6,
  wild: 5,
};

const WIN_LINES = [
  { name: "Horizontal 1", indexes: [0, 3, 6] },
  { name: "Horizontal 2", indexes: [1, 4, 7] },
  { name: "Horizontal 3", indexes: [2, 5, 8] },
  { name: "Diagonal 1", indexes: [0, 4, 8] },
  { name: "Diagonal 2", indexes: [2, 4, 6] },
] as const;

// ============================================================
// RTP-CALIBRATED SYMBOL WEIGHTS -- TARGET: 75% RTP
// ============================================================

const SYMBOL_WEIGHTS_BP: Record<SymbolName, number> = {
  wild: 73_654,
  red: 286_498,
  blue: 229_199,
  green: 171_899,
  yin_yang: 114_600,
  hakkero: 76_400,
  yellow: 47_750,
};

const CUMULATIVE_WEIGHTS: { symbol: SymbolName; upperBound: number }[] =
  (() => {
    let running = 0;
    const table = SYMBOLS.map((symbol) => {
      running += SYMBOL_WEIGHTS_BP[symbol];
      return { symbol, upperBound: running };
    });

    if (running !== 1_000_000) {
      throw new Error(
        `Slot symbol weights must sum to 1,000,000 basis points, got ${running}. ` +
          `Re-run the RTP solve before changing SYMBOL_WEIGHTS_BP.`,
      );
    }

    return table;
  })();

function pickWeightedSymbol(): SymbolName {
  const roll = 1 + Math.floor(Math.random() * 1_000_000);

  for (const { symbol, upperBound } of CUMULATIVE_WEIGHTS) {
    if (roll <= upperBound) return symbol;
  }

  return CUMULATIVE_WEIGHTS[CUMULATIVE_WEIGHTS.length - 1].symbol;
}

function generateGrid(): SymbolName[] {
  return Array.from({ length: 9 }, pickWeightedSymbol);
}

// ============================================================
// CALCULATE WINS
// ============================================================

const round2 = (n: number) => Math.round(n * 100) / 100;

function calculateWins(grid: SymbolName[], betAmount: number) {
  const wins: SlotWin[] = [];
  let totalPayout = 0;

  for (const winLine of WIN_LINES) {
    const [a, b, c] = winLine.indexes.map((index) => grid[index]);

    const sameSymbol = a === b && b === c;

    const nonWildSymbols = [a, b, c].filter((symbol) => symbol !== "wild");
    const wildWin =
      nonWildSymbols.length > 0 &&
      nonWildSymbols.every((symbol) => symbol === nonWildSymbols[0]);

    let winningSymbol: SymbolName | null = null;

    if (sameSymbol) {
      winningSymbol = a;
    } else if (wildWin) {
      winningSymbol = nonWildSymbols[0];
    }

    if (!winningSymbol) continue;

    const multiplier = PAYOUTS[winningSymbol];
    const payout = round2(betAmount * multiplier);

    totalPayout += payout;

    wins.push({
      line: winLine.name,
      symbol: winningSymbol,
      multiplier,
      payout,
    });
  }

  return { wins, totalPayout: round2(totalPayout) };
}

// ============================================================
// BACKGROUND RECORDING (history only)
// ============================================================

const saveSlotHistory = async ({
  userId,
  roundId,
  betAmount,
  gridState,
  wins,
  totalPayout,
}: {
  userId: string;
  roundId: string;
  betAmount: number;
  gridState: SymbolName[];
  wins: SlotWin[];
  totalPayout: number;
}) => {
  try {
    const { error } = await supabase.from("game_history").insert({
      user_id: userId,
      game: "slots",
      bet_amount: betAmount,
      grid_state: gridState,
      spin_result: wins,
      total_payout: totalPayout,
    });

    if (error) {
      console.error("Game history error:", error);
    }
  } catch (error) {
    console.error("Game history exception:", error);
  }
};

// ============================================================
// SOCKET HANDLER
// ============================================================

export default function Slots(io: Server, socket: CustomSocket) {
  const userId = socket.user.userId;

  let spinInFlight = false;

  socket.on(
    "slots:spin",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      if (!userId) {
        return reply({ success: false, message: "Unauthorized" });
      }

      if (spinInFlight) {
        return reply({ success: false, message: "Spin already in progress" });
      }

      const startTime = Date.now();

      const betAmount = Number(
        typeof payload === "object" && payload !== null
          ? (payload as { betAmount?: unknown }).betAmount
          : payload,
      );

      if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
        return reply({ success: false, message: "Invalid bet amount" });
      }

      if (betAmount < MIN_BET) {
        return reply({ success: false, message: `Minimum bet is ${MIN_BET}` });
      }

      if (betAmount > MAX_BET) {
        return reply({ success: false, message: "Maximum bet is 50000" });
      }

      spinInFlight = true;

      const roundId = randomUUID();

      try {
        // 🆕 Free any stale lock left behind by a crashed or abandoned
        // spin. No-op when nothing is locked. Never throws.
        await walletService.releaseAllLocks(userId);

        // 1. Lock the bet (checks balance + moves it to locked_balance)
        try {
          const locked = await lockBet(userId, betAmount);
          if (!locked) {
            return reply({ success: false, message: "Failed to process spin" });
          }
        } catch (lockError: any) {
          const insufficient = String(lockError?.message ?? "")
            .toLowerCase()
            .includes("insufficient");
          if (!insufficient) console.error("Slot lockBet error:", lockError);
          return reply({
            success: false,
            message: insufficient
              ? "Insufficient funds"
              : "Failed to process spin",
          });
        }

        // 2. Roll only after the bet is safely locked
        const gridState = generateGrid();
        const { wins, totalPayout } = calculateWins(gridState, betAmount);

        // 3. Settle: payout = TOTAL payout (0 = loss), not profit
        const result = await settleOne("slots", roundId, {
          userId,
          bet: betAmount,
          payout: totalPayout,
          metadata: { bet_amount: betAmount, grid_state: gridState, wins },
        });

        if (result.status === "duplicate") {
          return reply({ success: false, message: "Spin already settled" });
        }

        if (result.status !== "ok" || !result.wallet) {
          console.error(
            `[slots] settlement ${result.status} for round ${roundId} user ${userId}:`,
            result.message,
          );
          return reply({ success: false, message: "Failed to settle spin" });
        }

        const wallet = result.wallet;
        const newBalance = Number(wallet.balance ?? 0);
        const newWithdrawableBalance = Number(wallet.withdrawable_balance ?? 0);

        reply({
          success: true,
          userId,
          roundId,
          balance: newBalance,
          walletBalance: newBalance,
          withdrawable_balance: newWithdrawableBalance,
          betAmount,
          gridState,
          lastSpinResult: wins,
          totalPayout,
          newBalance,
          wallet,
          processingTime: Date.now() - startTime,
        });

        void saveSlotHistory({
          userId,
          roundId,
          betAmount,
          gridState,
          wins,
          totalPayout,
        });
      } catch (error) {
        console.error("Slot spin error:", error);
        reply({ success: false, message: "Error spinning slots" });
      } finally {
        spinInFlight = false;
      }
    },
  );
}

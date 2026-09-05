/* eslint-disable */

import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

import { catchAsync } from "../utils/catchAsync";
import { supabase } from "../config/supabase";
import { wageringService } from "../services/waggering.service";
import { AppError } from "../utils/AppError";
import { walletService } from "../services/wallet.service";

// ============================================================
// TYPES
// ============================================================

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

// ============================================================
// CONFIG
// ============================================================

const MIN_BET = 1;
const MAX_BET = 50_000;

// ============================================================
// PAYOUTS
// ============================================================

const PAYOUTS: Record<SymbolName, number> = {
  red: 1.1,
  blue: 1.2,
  green: 1.3,
  yin_yang: 1.4,
  hakkero: 1.5,
  yellow: 1.6,
  wild: 5,
};

// ============================================================
// WIN LINES
// ============================================================

const WIN_LINES = [
  {
    name: "Horizontal 1",
    indexes: [0, 3, 6],
  },
  {
    name: "Horizontal 2",
    indexes: [1, 4, 7],
  },
  {
    name: "Horizontal 3",
    indexes: [2, 5, 8],
  },
  {
    name: "Diagonal 1",
    indexes: [0, 4, 8],
  },
  {
    name: "Diagonal 2",
    indexes: [2, 4, 6],
  },
] as const;

// ============================================================
// GENERATE GRID
// ============================================================

function generateGrid(): SymbolName[] {
  return Array.from(
    { length: 9 },
    () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  );
}

// ============================================================
// CALCULATE WINS
// ============================================================

function calculateWins(grid: SymbolName[], betAmount: number) {
  const wins: SlotWin[] = [];

  let totalPayout = 0;

  for (const winLine of WIN_LINES) {
    const [a, b, c] = winLine.indexes.map((index) => grid[index]);

    // --------------------------------------------
    // Three identical symbols
    // --------------------------------------------

    const sameSymbol = a === b && b === c;

    // --------------------------------------------
    // Wild handling
    // --------------------------------------------

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

    // --------------------------------------------
    // No win
    // --------------------------------------------

    if (!winningSymbol) {
      continue;
    }

    const multiplier = PAYOUTS[winningSymbol];

    const payout = betAmount * multiplier;

    totalPayout += payout;

    wins.push({
      line: winLine.name,
      symbol: winningSymbol,
      multiplier,
      payout,
    });
  }

  return {
    wins,
    totalPayout,
  };
}

// ============================================================
// RECORD TRANSACTION
// ============================================================

const recordSlotTransaction = async ({
  userId,
  type,
  amount,
  betAmount,
}: {
  userId: string;
  type: "win" | "lose";
  amount: number;
  betAmount: number;
}) => {
  try {
    const { error } = await supabase.from("transactions").insert({
      user_id: userId,

      type,

      amount,

      status: "completed",

      reference_id: `slots_${userId}_${randomUUID()}`,

      metadata: {
        game: "slots",
        bet_amount: betAmount,
        payout: type === "win" ? amount : 0,
      },
    });

    if (error) {
      console.error("Failed to record slot transaction:", error);
    }
  } catch (error) {
    console.error("Slot transaction error:", error);
  }
};

// ============================================================
// SAVE GAME HISTORY
// ============================================================

const saveSlotHistory = async ({
  userId,
  betAmount,
  gridState,
  wins,
  totalPayout,
}: {
  userId: string;
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
// BACKGROUND RECORDING
// ============================================================

const recordSlotActivity = async ({
  userId,
  betAmount,
  gridState,
  wins,
  totalPayout,
}: {
  userId: string;
  betAmount: number;
  gridState: SymbolName[];
  wins: SlotWin[];
  totalPayout: number;
}) => {
  await Promise.allSettled([
    // Game history
    saveSlotHistory({
      userId,
      betAmount,
      gridState,
      wins,
      totalPayout,
    }),

    // Transaction history
    recordSlotTransaction({
      userId,
      type: totalPayout > 0 ? "win" : "lose",
      amount: totalPayout > 0 ? totalPayout : betAmount,
      betAmount,
    }),

    // Wagering
    wageringService.recordWager(userId, betAmount, "Slot"),

    // Daily activity
    supabase.rpc("record_daily_activity", {
      p_user_id: userId,
      p_activity_type: "played",
    }),
  ]);
};

// ============================================================
// SPIN SLOT
// ============================================================

export const spinSlote = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // ========================================================
    // USER
    // ========================================================

    const userId = req.user?.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    // ========================================================
    // BET
    // ========================================================

    const betAmount = Number(req.body.betAmount);

    if (!Number.isFinite(betAmount) || !Number.isInteger(betAmount)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bet amount",
      });
    }

    if (betAmount < MIN_BET) {
      return res.status(400).json({
        success: false,
        message: `Minimum bet is ${MIN_BET}`,
      });
    }

    if (betAmount > MAX_BET) {
      return res.status(400).json({
        success: false,
        message: "Maximum bet is 50000",
      });
    }

    // ========================================================
    // GENERATE RESULT
    // ========================================================

    const gridState = generateGrid();

    const { wins, totalPayout } = calculateWins(gridState, betAmount);

    // ========================================================
    // SETTLE WALLET
    //
    // IMPORTANT:
    // The RPC must atomically:
    //
    // 1. Check balance
    // 2. Deduct bet
    // 3. Add payout
    // 4. Return resulting wallet
    //
    // Do NOT perform another wallet update here.
    // ========================================================

    const { data: settledWallet, error: settleError } = await supabase.rpc(
      "settle_slot_spin",
      {
        user_id_input: userId,

        bet_amount_input: betAmount,

        payout_input: totalPayout,
      },
    );

    // ========================================================
    // SETTLEMENT ERROR
    // ========================================================

    if (settleError) {
      console.error("Slot wallet settlement error:", settleError);

      const insufficient = settleError.message
        ?.toLowerCase()
        .includes("insufficient funds");

      return res.status(insufficient ? 400 : 500).json({
        success: false,
        message: insufficient ? "Insufficient funds" : "Failed to process spin",
      });
    }

    // ========================================================
    // CHECK RPC RESPONSE
    // ========================================================

    if (!settledWallet || settledWallet.length === 0) {
      console.error("settle_slot_spin returned no wallet");

      return res.status(500).json({
        success: false,
        message: "Failed to settle wallet",
      });
    }

    // ========================================================
    // WALLET RESULT
    // ========================================================

    const finalWallet = settledWallet[0];

    const newBalance = Number(finalWallet.balance ?? 0);

    const newWithdrawableBalance = Number(
      finalWallet.withdrawable_balance ?? 0,
    );

    // ========================================================
    // RESPONSE
    //
    // Send the important game result immediately.
    //
    // The frontend can now finish its 3-second animation
    // without waiting for:
    //
    // - game_history
    // - transactions
    // - wagering
    // - daily activity
    //
    // ========================================================

    const wallet = await walletService.getWallet(userId);
    const responseData = {
      success: true,

      userId,

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
    };

    res.status(200).json(responseData);

    // ========================================================
    // NON-CRITICAL WORK
    //
    // Do NOT await these before responding.
    //
    // They don't determine whether the spin itself succeeded.
    // ========================================================

    void recordSlotActivity({
      userId,
      betAmount,
      gridState,
      wins,
      totalPayout,
    });
  },
);

import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { randomUUID } from "crypto";
interface GameRequest extends Request {
  user: {
    userId: string;
  };
}
import { supabase } from "../config/supabase";

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
};

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
];

function generateGrid(): SymbolName[] {
  return Array.from(
    { length: 9 },
    () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  );
}

function calculateWins(grid: SymbolName[], betAmount: number) {
  const wins: {
    line: string;
    symbol: SymbolName;
    multiplier: number;
    payout: number;
  }[] = [];

  let totalPayout = 0;

  for (const winLine of WIN_LINES) {
    const [a, b, c] = winLine.indexes.map((index) => grid[index]);

    // Normal 3 matching symbols
    const sameSymbol = a === b && b === c;

    // Wild can complete a line
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

export const spinSlote = catchAsync(
  async (req: GameRequest, res: Response, next: NextFunction) => {
    const betAmount = Number(req.body.betAmount);
    const userId = req.user.userId;

    // -------------------------
    // VALIDATE BET
    // -------------------------

    if (
      !Number.isFinite(betAmount) ||
      betAmount <= 0 ||
      !Number.isInteger(betAmount)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid bet amount",
      });
    }

    if (betAmount > 50000) {
      return res.status(400).json({
        success: false,
        message: "Maximum bet is 50000",
      });
    }

    // -------------------------
    // GET USER WALLET
    // -------------------------

    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    const balance = Number(wallet.balance);

    if (balance < betAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient funds",
      });
    }

    // -------------------------
    // GENERATE RESULT
    // -------------------------

    const gridState = generateGrid();

    const { wins, totalPayout } = calculateWins(gridState, betAmount);

    // -------------------------
    // UPDATE BALANCE
    //
    // First remove bet:
    // balance - bet
    //
    // Then add winnings:
    // balance + payout
    // -------------------------

    const newBalance = balance - betAmount + totalPayout;

    const { error: updateError } = await supabase
      .from("wallets")
      .update({
        balance: newBalance,
      })
      .eq("id", wallet.id);

    if (updateError) {
      console.error("Wallet update error:", updateError);

      return res.status(500).json({
        success: false,
        message: "Failed to process spin",
      });
    }

    // -------------------------
    // SAVE GAME HISTORY
    // -------------------------

    const { error: gameError } = await supabase.from("game_history").insert({
      user_id: userId,
      game: "slots",
      bet_amount: betAmount,
      grid_state: gridState,
      spin_result: wins,
      total_payout: totalPayout,
    });

    if (gameError) {
      console.error("Game history error:", gameError);
    }

    await recordSlotTransaction({
      userId,
      type: totalPayout > 0 ? "win" : "lose",
      amount: totalPayout > 0 ? totalPayout : betAmount,
      betAmount,
    });

    // -------------------------
    // FRONTEND RESPONSE
    // -------------------------

    return res.status(200).json({
      success: true,

      userId,
      balance: newBalance,
      walletBalance: newBalance,

      betAmount,

      gridState,

      lastSpinResult: wins,

      totalPayout,

      newBalance,
    });
  },
);

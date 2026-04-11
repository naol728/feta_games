import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { supabase } from "../config/supabase";

interface WalletRequest extends Request {
  user: {
    userId: string;
    telegramId: number;
  };
}

export const deposit = catchAsync(async (req: Request, res: Response) => {
  const { amount, phonno, transactionno } = req.body;
  res.status(200).json({
    message: "Deposited Sucessfully",
  });
});

export const paymentMethod = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const { amount } = req.body;
    const user = req.user;

    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount < 10 || parsedAmount > 1000) {
      return next(new AppError("Amount must be between 10 and 1000 ETB", 400));
    }

    const { data: methods, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("type", "telebirr")
      .eq("is_active", true)
      .lte("min_amount", parsedAmount)
      .gte("max_amount", parsedAmount);

    if (error) {
      return next(new AppError("Failed to fetch payment methods", 500));
    }

    if (!methods || methods.length === 0) {
      return next(new AppError("No payment method available", 404));
    }

    const method = methods[Math.floor(Math.random() * methods.length)];

    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.userId,
        type: "deposit",
        amount: parsedAmount,
        status: "pending",
        metadata: {
          payment_method_id: method.id,
          account_number: method.account_number,
        },
      })
      .select()
      .single();

    if (txError) {
      return next(new AppError("Failed to create transaction", 500));
    }

    return res.json({
      transaction_id: tx.id,
      amount: parsedAmount,
      payment_method: {
        type: method.type,
        account_name: method.account_name,
        account_number: method.account_number,
      },
      instructions: [
        "Send the exact amount",
        "Use the account number above",
        "Submit transaction number for verification",
      ],
    });
  },
);

export const withDraw = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {},
);
export const getTransaction = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const { trxno } = req.params;
    const user = req.user;
    console.log(trxno);
    if (!trxno) {
      return next(new AppError("Transaction number is required", 400));
    }

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", trxno)
      .eq("user_id", user.userId)
      .single();
    if (error || !transaction) {
      return next(new AppError("Transaction not found", 404));
    }

    return res.json({
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        status: transaction.status,
        reference_id: transaction.reference_id,
        metadata: transaction.metadata,
        created_at: transaction.created_at,
      },
    });
  },
);
export const wallet = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {},
);
export const transactions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {},
);

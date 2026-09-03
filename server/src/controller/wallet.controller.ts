import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { supabase } from "../config/supabase";
import { walletService } from "../services/wallet.service";
import {
  paymentVerify,
  veritas,
} from "../services/payment/paymentvarify.service";

interface WalletRequest extends Request {
  user: {
    userId: string;
    telegramId: number;
  };
}

export const deposit = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { transactioID, trxno } = req.body;

    const result = await veritas<{
      success: boolean;
      data?: {
        payerName?: string;
        payerTelebirrNo?: string;
        creditedPartyName?: string;
        creditedPartyAccountNo?: string;
        transactionStatus?: string;
        receiptNo?: string;
        paymentDate?: string;
        settledAmount?: string;
        serviceFee?: string;
        serviceFeeVAT?: string;
        totalPaidAmount?: string;
        bankName?: string;
        customerNote?: string;
      };
    }>("/verify-telebirr", {
      method: "POST",
      body: JSON.stringify({ reference: transactioID }),
    });
    console.log(result);
    if (!result) {
      return next(new AppError("INVALID Transactio Id", 400));
    }

    const { data: trx, error: trxerr } = await supabase
      .from("transactions")
      .select(
        `
        *,
        payment_methods (
          id,
          account_number,
          account_name,
          type
        )
      `,
      )
      .eq("id", trxno)
      .single();

    if (trxerr || !trx) {
      return next(new AppError("Transaction not found", 404));
    }

    if (trx.status === "completed") {
      return next(new AppError("Transaction already completed", 400));
    }

    const { data: existingRef } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference_id", transactioID)
      .maybeSingle();

    if (existingRef) {
      return next(new AppError("Transaction already used", 400));
    }
    const verification = paymentVerify(
      result,
      Number(trx.amount),
      trx.payment_methods.account_name,
    );

    if (!verification.valid) {
      return next(new AppError(verification.message, 400));
    }

    const { error: depositError } = await supabase.from("deposits").upsert({
      transaction_id: trx.id,
      payment_method_id: trx.payment_method_id,
      bank_reference: transactioID,
      verified: true,
    });

    if (depositError) {
      return next(new AppError(depositError.message, 500));
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        reference_id: transactioID,
      })
      .eq("id", trx.id);

    if (updateError) {
      return next(new AppError(updateError.message, 500));
    }

    await walletService.addBalance(trx.user_id, trx.amount);

    return res.status(200).json({
      message: "Deposit successful",
    });
  },
);

export const paymentMethod = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const { amount } = req.body;
    const user = req.user;

    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount < 10 || parsedAmount > 5000) {
      return next(new AppError("Amount must be between 10 and 1000 ETB", 400));
    }

    const { data: methods, error } = await supabase
      .from("payment_methods")
      .select("*")
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
        payment_method_id: method.id,
        status: "pending",
        metadata: {
          account_number: method.account_number,
        },
      })
      .select()
      .single();

    if (txError) {
      return next(
        new AppError(txError.message || "Failed to create transaction", 500),
      );
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
export const getTransaction = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const { trxno } = req.params;
    const user = req.user;
    if (!trxno) {
      return next(new AppError("Transaction number is required", 400));
    }

    const { data: transaction, error } = await supabase
      .from("transactions")
      .select(
        `*,
         payment_method:payment_methods (
     id,
    type,
    account_name,
    account_number
  )
    )`,
      )
      .eq("id", trxno)
      .eq("user_id", user.userId)
      .single();
    if (error || !transaction) {
      return next(new AppError("Transaction not found", 404));
    }

    return res.json({
      transaction: transaction,
    });
  },
);

export const withDraw = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const { amount, destination_account, bank_name, account_holder_name } =
      req.body;

    if (
      !amount ||
      amount <= 100 ||
      !destination_account ||
      !account_holder_name
    ) {
      return next(new AppError("Invalid withdrawal data", 400));
    }

    const { data, error } = await supabase.rpc("process_withdrawal", {
      p_user_id: userId,
      p_amount: amount,
      p_destination: destination_account,
      p_bank: bank_name || null,
      p_account_holder_name: account_holder_name,
    });

    if (error) {
      return next(new AppError(error.message, 400));
    }

    return res.status(200).json({
      status: "success",
      message: "Withdrawal request submitted",
      withdrawalId: data,
    });
  },
);

export const wallet = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {},
);

export const transactions = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const userId = req.user.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    // =========================
    // PAGINATION
    // =========================
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // =========================
    // GET TRANSACTIONS
    // =========================
    const {
      data: transactionData,
      error,
      count,
    } = await supabase
      .from("transactions")
      .select(
        `
          *,
          payment_method:payment_methods (
            id,
            type,
            account_name,
            account_number
          )
        `,
        { count: "exact" },
      )
      .eq("user_id", userId)
      .in("type", ["deposit", "win", "lose"])
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return next(new AppError(error.message, 500));
    }

    // =========================
    // PAGINATION INFO
    // =========================
    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      data: transactionData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  },
);

export const getWithdraws = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return next(new AppError(error.message, 500));
    }
    res.json({
      data: data,
    });
  },
);

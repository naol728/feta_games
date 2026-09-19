import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { supabase } from "../config/supabase";
import { walletService } from "../services/wallet.service";
import {
  paymentVerify,
  verifyPayment,
} from "../services/payment/paymentvarify.service";
import { wageringService } from "../services/waggering.service";

interface WalletRequest extends Request {
  user: {
    userId: string;
    telegramId: number;
  };
}

export const deposit = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    // ========================================================
    // 1. GET REQUEST DATA
    // ========================================================

    const { transactioID, trxno } = req.body;

    if (!transactioID || !trxno) {
      return next(
        new AppError("Transaction ID and transaction number are required", 400),
      );
    }

    // ========================================================
    // 2. FIND INTERNAL TRANSACTION
    // ========================================================

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

    // ========================================================
    // 3. MAKE SURE THIS IS A DEPOSIT
    // ========================================================

    if (trx.type && trx.type !== "deposit") {
      return next(new AppError("Invalid transaction type", 400));
    }

    // ========================================================
    // 4. ALREADY COMPLETED?
    // ========================================================

    if (trx.status === "completed") {
      return next(new AppError("Transaction already completed", 400));
    }

    // ========================================================
    // 5. CHECK TRANSACTION USER
    // ========================================================

    if (!trx.user_id) {
      return next(new AppError("Transaction has no user", 400));
    }

    // ========================================================
    // 6. CHECK PAYMENT METHOD
    // ========================================================

    if (!trx.payment_methods) {
      return next(new AppError("Payment method not found", 400));
    }

    const paymentMethod = trx.payment_methods;

    if (!paymentMethod.account_name) {
      return next(new AppError("Payment account name is not configured", 400));
    }

    if (!paymentMethod.account_number) {
      return next(
        new AppError("Payment account number is not configured", 400),
      );
    }

    // ========================================================
    // 7. CHECK DUPLICATE REFERENCE
    // ========================================================

    const { data: existingRef, error: existingRefError } = await supabase
      .from("transactions")
      .select("id, user_id, status")
      .eq("reference_id", transactioID)
      .maybeSingle();

    if (existingRefError) {
      return next(new AppError("Unable to check transaction reference", 500));
    }

    if (existingRef) {
      return next(new AppError("Transaction already used", 400));
    }

    // ========================================================
    // 8. VERIFY WITH VERIFY.ET
    // ========================================================

    let verifyResult;

    try {
      verifyResult = await verifyPayment(
        transactioID,
        paymentMethod.account_number,
      );
    } catch (error) {
      console.error("Verify.ET error:", error);

      return next(
        new AppError(
          error instanceof Error
            ? error.message
            : "Payment verification service unavailable",
          502,
        ),
      );
    }

    // ========================================================
    // 9. VALIDATE PAYMENT
    // ========================================================

    const verification = paymentVerify(
      verifyResult,
      Number(trx.amount),
      paymentMethod.account_name,
      paymentMethod.account_number,
    );

    // ========================================================
    // 10. PAYMENT STILL PROCESSING
    // ========================================================

    if (verification.pending) {
      return res.status(202).json({
        success: false,
        pending: true,
        message: verification.message,
      });
    }

    // ========================================================
    // 11. PAYMENT INVALID
    // ========================================================

    if (!verification.valid) {
      return next(new AppError(verification.message, 400));
    }

    // ========================================================
    // 12. EXTRA SAFETY CHECK
    // ========================================================

    if (
      verification.settledAmount !== undefined &&
      Number(verification.settledAmount) !== Number(trx.amount)
    ) {
      return next(
        new AppError(
          "Verified payment amount does not match transaction amount",
          400,
        ),
      );
    }

    // ========================================================
    // 13. INSERT DEPOSIT
    // ========================================================

    const { data: depositRecord, error: depositError } = await supabase
      .from("deposits")
      .upsert(
        {
          transaction_id: trx.id,
          payment_method_id: trx.payment_method_id,
          bank_reference: transactioID,
          verified: true,
        },
        {
          onConflict: "transaction_id",
        },
      )
      .select()
      .single();

    if (depositError) {
      console.error("Deposit insert error:", depositError);

      return next(new AppError(depositError.message, 500));
    }

    // ========================================================
    // 14. UPDATE TRANSACTION
    // ========================================================

    const { data: updatedTransaction, error: updateError } = await supabase
      .from("transactions")
      .update({
        status: "completed",
        reference_id: transactioID,
      })
      .eq("id", trx.id)
      .neq("status", "completed")
      .select()
      .single();

    if (updateError || !updatedTransaction) {
      console.error("Transaction update error:", updateError);

      // Important:
      // Don't continue to wallet credit if the transaction
      // wasn't successfully marked completed.
      return next(
        new AppError(
          updateError?.message || "Unable to complete transaction",
          500,
        ),
      );
    }

    // ========================================================
    // 15. ADD WALLET BALANCE
    // ========================================================

    try {
      await walletService.addBalance(trx.user_id, trx.amount);
    } catch (error) {
      console.error("Wallet credit error:", error);

      return next(
        new AppError(
          "Deposit was verified but wallet credit failed. Please contact support.",
          500,
        ),
      );
    }

    // ========================================================
    // 16. CREATE DEPOSIT WAGERING REQUIREMENT
    // ========================================================

    try {
      await wageringService.addDepositRequirement(
        trx.user_id,
        trx.amount,
        1,
        trx.id,
      );
    } catch (error) {
      console.error("Wagering requirement error:", error);

      // Deposit is already credited.
      // Don't tell the user that the payment failed.
      // Log this for reconciliation/support.
    }

    // ========================================================
    // 17. RECORD DAILY ACTIVITY
    // ========================================================

    const { error: activityError } = await supabase.rpc(
      "record_daily_activity",
      {
        p_user_id: trx.user_id,
        p_activity_type: "deposited",
      },
    );

    if (activityError) {
      console.error("Daily activity error:", activityError);
    }

    // ========================================================
    // 18. SUCCESS RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      message: "Deposit successful",

      data: {
        transactionId: trx.id,
        amount: Number(trx.amount),

        reference: transactioID,

        receiptNo: verification.receiptNo || verification.referenceNumber,

        payerName: verification.payerName,

        receiverName: verification.creditedPartyName,

        verified: true,
      },
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

    // =========================
    // VALIDATE INPUT
    // =========================
    if (
      !amount ||
      Number(amount) < 50 ||
      !destination_account ||
      !account_holder_name
    ) {
      return next(new AppError("Invalid withdrawal data", 400));
    }

    const withdrawalAmount = Number(amount);

    // =========================
    // GET WALLET
    // =========================
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance, withdrawable_balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      return next(new AppError("Wallet not found", 404));
    }

    const withdrawableBalance = Number(wallet.withdrawable_balance ?? 0);

    // =========================
    // CHECK WITHDRAWABLE BALANCE
    // =========================
    if (withdrawalAmount > withdrawableBalance) {
      // Get active wagering requirements
      const { data: wagering, error: wageringError } = await supabase
        .from("wagering_requirements")
        .select(
          "id, type, required_amount, wagered_amount, remaining_amount, status",
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (wageringError) {
        return next(new AppError("Unable to check wagering requirement", 500));
      }

      // Total remaining wagering
      const totalWageringRequired = (wagering ?? []).reduce(
        (total, requirement) =>
          total + Number(requirement.remaining_amount ?? 0),
        0,
      );
      return res.status(400).json({
        status: "wagering_required",
        message: "You have not completed the required wagering.",
        requestedAmount: withdrawalAmount,
        withdrawableBalance,
        shortfall: Math.max(withdrawalAmount - withdrawableBalance, 0),
        wageringRequired: totalWageringRequired,
        wageringRequirements: wagering ?? [],
      });
    }

    // =========================
    // PROCESS WITHDRAWAL
    // =========================
    const { data, error } = await supabase.rpc("process_withdrawal", {
      p_user_id: userId,
      p_amount: withdrawalAmount,
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
      withdrawableBalance: withdrawableBalance - withdrawalAmount,
    });
  },
);

export const wallet = catchAsync(
  async (req: WalletRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return next(new AppError("unautorized", 401));
    }

    const { data, error } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      return next(new AppError(error.message, 500));
    }
    res.json({
      status: true,
      message: "wallet retrived sucessfully",
      wallet: data,
    });
  },
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

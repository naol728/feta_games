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

    const { transactioID, trxno, couponCode } = req.body;

    if (!transactioID || !trxno) {
      return next(
        new AppError("Transaction ID and transaction number are required", 400),
      );
    }

    const normalizedCouponCode = couponCode
      ? String(couponCode).trim().toUpperCase()
      : null;

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
    // 3. VALIDATE TRANSACTION TYPE
    // ========================================================

    if (trx.type && trx.type !== "deposit") {
      return next(new AppError("Invalid transaction type", 400));
    }

    // ========================================================
    // 4. CHECK TRANSACTION STATUS
    // ========================================================

    if (trx.status === "completed") {
      return next(new AppError("Transaction already completed", 400));
    }

    if (!trx.user_id) {
      return next(new AppError("Transaction has no user", 400));
    }

    const depositAmount = Number(trx.amount);

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return next(new AppError("Invalid deposit amount", 400));
    }

    // ========================================================
    // 5. CHECK PAYMENT METHOD
    // ========================================================

    if (!trx.payment_methods) {
      return next(new AppError("Payment method not found", 400));
    }

    const paymentMethod = trx.payment_methods;

    if (!paymentMethod.account_name || !paymentMethod.account_number) {
      return next(
        new AppError("Payment account name or number is not configured", 400),
      );
    }

    // ========================================================
    // 6. CHECK DUPLICATE PAYMENT REFERENCE
    // ========================================================

    const { data: existingRef, error: existingRefError } = await supabase
      .from("transactions")
      .select("id, user_id, status")
      .eq("reference_id", transactioID)
      .maybeSingle();

    if (existingRefError) {
      console.error("Reference lookup error:", existingRefError);

      return next(new AppError("Unable to check transaction reference", 500));
    }

    if (existingRef) {
      return next(new AppError("Transaction already used", 400));
    }

    // ========================================================
    // 7. VERIFY PAYMENT WITH VERIFY.ET
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
    // 8. VALIDATE VERIFIED PAYMENT
    // ========================================================

    const verification = paymentVerify(
      verifyResult,
      depositAmount,
      paymentMethod.account_name,
      paymentMethod.account_number,
    );

    if (verification.pending) {
      return res.status(202).json({
        success: false,
        pending: true,
        message: verification.message,
      });
    }

    if (!verification.valid) {
      return next(new AppError(verification.message, 400));
    }

    if (
      verification.settledAmount !== undefined &&
      Number(verification.settledAmount) !== depositAmount
    ) {
      return next(
        new AppError(
          "Verified payment amount does not match transaction amount",
          400,
        ),
      );
    }

    // ========================================================
    // 9. RECORD VERIFIED DEPOSIT
    // ========================================================

    const { error: depositError } = await supabase.from("deposits").upsert(
      {
        transaction_id: trx.id,
        payment_method_id: trx.payment_method_id,
        bank_reference: transactioID,
        verified: true,
      },
      {
        onConflict: "transaction_id",
      },
    );

    if (depositError) {
      console.error("Deposit insert error:", depositError);

      return next(new AppError(depositError.message, 500));
    }

    // ========================================================
    // 10. COMPLETE TRANSACTION
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
      .maybeSingle();

    if (updateError || !updatedTransaction) {
      console.error("Transaction update error:", updateError);

      return next(
        new AppError(
          updateError?.message ||
            "Transaction was already completed or could not be updated",
          409,
        ),
      );
    }

    // ========================================================
    // 11. CREDIT ORIGINAL DEPOSIT
    // ========================================================

    try {
      await walletService.addBalance(trx.user_id, depositAmount);
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
    // 12. ORIGINAL DEPOSIT WAGERING: 3X
    // ========================================================

    const depositWageringMultiplier = 3;

    const depositWageringRequirement =
      depositAmount * depositWageringMultiplier;

    try {
      await wageringService.addDepositRequirement(
        trx.user_id,
        depositAmount,
        depositWageringMultiplier,
        trx.id,
      );
    } catch (error) {
      console.error("Deposit wagering error:", error);
      // Deposit has already been credited.
      // Log for reconciliation.
    }

    // ========================================================
    // 13. AUTOMATIC 100% DEPOSIT BONUS
    // Deposits >= 1,000 ETB receive a 100% bonus.
    // Bonus wagering = 10X the bonus amount.
    // ========================================================

    let automaticDepositBonus = 0;
    let automaticBonusWageringRequirement = 0;
    let automaticBonusCredited = false;

    if (depositAmount >= 1000) {
      automaticDepositBonus = depositAmount;

      automaticBonusWageringRequirement = automaticDepositBonus * 10;

      try {
        await walletService.addBalance(trx.user_id, automaticDepositBonus);

        automaticBonusCredited = true;

        try {
          await wageringService.addDepositRequirement(
            trx.user_id,
            automaticDepositBonus,
            10,
            trx.id,
          );
        } catch (error) {
          console.error("Automatic bonus wagering error:", error);
          // Bonus was credited, but its wagering record failed.
          // Reconcile this before allowing bonus withdrawals.
        }
      } catch (error) {
        console.error("Automatic deposit bonus error:", error);

        // Preserve the verified original deposit.
        // The bonus can be reconciled separately.
        automaticDepositBonus = 0;
        automaticBonusWageringRequirement = 0;
      }
    }

    // ========================================================
    // 14. APPLY COUPON BONUS (OPTIONAL)
    // ========================================================

    let couponBonus = 0;
    let appliedCouponCode: string | null = null;
    let couponWageringRequirement = 0;
    let couponWageringMultiplier = 30;

    if (normalizedCouponCode) {
      try {
        // Find coupon
        const { data: coupon, error: couponError } = await supabase
          .from("coupons")
          .select(
            `
              id,
              code,
              bonus_multiplier,
              max_uses,
              used_count,
              is_active,
              expires_at,
              bonus_amount,
              min_deposit_amount
            `,
          )
          .eq("code", normalizedCouponCode)
          .maybeSingle();

        if (couponError) {
          console.error("Coupon lookup error:", couponError);

          return next(new AppError("Unable to validate coupon", 500));
        }

        if (!coupon) {
          return next(new AppError("Invalid coupon code", 400));
        }

        if (!coupon.is_active) {
          return next(new AppError("This coupon is no longer active", 400));
        }

        if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) {
          return next(new AppError("This coupon has expired", 400));
        }

        if (
          coupon.max_uses !== null &&
          Number(coupon.used_count || 0) >= Number(coupon.max_uses)
        ) {
          return next(
            new AppError(
              "This coupon has reached its maximum usage limit",
              400,
            ),
          );
        }

        const minDeposit = Number(coupon.min_deposit_amount || 0);

        if (minDeposit > 0 && depositAmount < minDeposit) {
          return next(
            new AppError(
              `Minimum deposit for this coupon is ${minDeposit} ETB`,
              400,
            ),
          );
        }

        // Check whether this user already used the coupon
        const { data: existingUserCoupon, error: existingUserCouponError } =
          await supabase
            .from("user_coupons")
            .select("id")
            .eq("user_id", trx.user_id)
            .eq("coupon_id", coupon.id)
            .maybeSingle();

        if (existingUserCouponError) {
          console.error("User coupon lookup error:", existingUserCouponError);

          return next(new AppError("Unable to check coupon usage", 500));
        }

        if (existingUserCoupon) {
          return next(new AppError("You have already used this coupon", 400));
        }

        couponBonus = Number(coupon.bonus_amount || 0);

        if (!Number.isFinite(couponBonus) || couponBonus <= 0) {
          return next(
            new AppError("This coupon does not have a valid bonus", 400),
          );
        }

        // Credit coupon bonus
        await walletService.addBalance(trx.user_id, couponBonus);

        // Record coupon usage
        const { error: userCouponError } = await supabase
          .from("user_coupons")
          .insert({
            user_id: trx.user_id,
            coupon_id: coupon.id,
          });

        if (userCouponError) {
          console.error("User coupon insert error:", userCouponError);

          return next(
            new AppError(
              "Coupon bonus was credited but could not be recorded. Please contact support.",
              500,
            ),
          );
        }

        // Increment usage count
        const { error: updateCouponError } = await supabase
          .from("coupons")
          .update({
            used_count: Number(coupon.used_count || 0) + 1,
          })
          .eq("id", coupon.id);

        if (updateCouponError) {
          console.error("Coupon usage update error:", updateCouponError);
        }

        // Preserve your existing 30X coupon wagering rule.
        // Change to 20 if that is your intended coupon policy.
        couponWageringMultiplier = 30;

        couponWageringRequirement = couponBonus * couponWageringMultiplier;

        try {
          await wageringService.addDepositRequirement(
            trx.user_id,
            couponBonus,
            couponWageringMultiplier,
            trx.id,
          );
        } catch (error) {
          console.error("Coupon wagering requirement error:", error);
        }

        appliedCouponCode = coupon.code;
      } catch (error) {
        console.error("Coupon processing error:", error);

        return next(
          new AppError(
            error instanceof Error ? error.message : "Unable to apply coupon",
            500,
          ),
        );
      }
    }

    // ========================================================
    // 15. RECORD DAILY ACTIVITY
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
    // 16. CALCULATE FINAL TOTALS
    // ========================================================

    const totalCredited =
      depositAmount +
      (automaticBonusCredited ? automaticDepositBonus : 0) +
      couponBonus;

    const totalWageringRequirement =
      depositWageringRequirement +
      (automaticBonusCredited ? automaticBonusWageringRequirement : 0) +
      couponWageringRequirement;

    // ========================================================
    // 17. SUCCESS RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      message: automaticBonusCredited
        ? "Deposit successful! Your 100% deposit bonus has been applied."
        : couponBonus > 0
          ? "Deposit successful and coupon bonus applied"
          : "Deposit successful",

      data: {
        transactionId: trx.id,

        // Original verified deposit
        amount: depositAmount,

        // Automatic 100% deposit bonus
        automaticDepositBonus: {
          eligible: depositAmount >= 1000,
          bonus: automaticBonusCredited ? automaticDepositBonus : 0,
          wageringMultiplier: 10,
          wageringRequirement: automaticBonusCredited
            ? automaticBonusWageringRequirement
            : 0,
        },

        // Existing coupon bonus
        coupon: appliedCouponCode
          ? {
              code: appliedCouponCode,
              bonus: couponBonus,
              wageringMultiplier: couponWageringMultiplier,
              wageringRequirement: couponWageringRequirement,
            }
          : null,

        // Original deposit + successfully credited bonuses
        totalCredited,

        // Deposit wagering: 3X
        depositWageringMultiplier,
        depositWageringRequirement,

        // Combined wagering for all credited amounts
        totalWageringRequirement,

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

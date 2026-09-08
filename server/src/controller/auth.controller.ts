import { NextFunction, Request, Response } from "express";
import { validateTelegramData } from "../utils/telegram";
import { env } from "../config/env";
import { supabase } from "../config/supabase";
import jwt from "jsonwebtoken";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";

export const telegramAuth = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // =========================================================
    // Helper: Fetch complete user data
    // =========================================================
    const fetchUserData = async (userId: string) => {
      // -----------------------------
      // User + Wallet
      // -----------------------------
      const { data: user, error: userError } = await supabase
        .from("users")
        .select(
          `*,
            wallets (
              balance,
              locked_balance,
              withdrawable_balance,
              available_balance
            )`,
        )
        .eq("id", userId)
        .single();

      if (userError || !user) {
        throw new AppError("User not found", 401);
      }

      // -----------------------------
      // Level Progress
      // -----------------------------
      const { data: progress, error: progressError } = await supabase.rpc(
        "get_user_level_progress",
        {
          p_user_id: userId,
        },
      );

      if (progressError) {
        throw new AppError(
          `Failed to fetch user progress: ${progressError.message}`,
          500,
        );
      }

      // -----------------------------
      // Wagering Requirements
      // -----------------------------
      const { data: wagering, error: wageringError } = await supabase
        .from("wagering_requirements")
        .select(
          `
            id,
            type,
            source_amount,
            wagering_multiplier,
            required_amount,
            wagered_amount,
            remaining_amount,
            status,
            reference_id,
            created_at,
            completed_at,
            expires_at
          `,
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (wageringError) {
        throw new AppError(
          `Failed to fetch wagering requirement: ${wageringError.message}`,
          500,
        );
      }

      // -----------------------------
      // Final User Object
      // -----------------------------
      const userWithProgress = {
        ...user,
        progress: progress?.[0] ?? null,
      };

      return {
        user: userWithProgress,
        wagering: wagering ?? [],
      };
    };

    // =========================================================
    // 1. JWT Authentication
    // =========================================================
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as {
          userId: string;
          telegramId?: number;
        };

        const { user, wagering } = await fetchUserData(payload.userId);

        return res.json({
          access_token: token,
          user,
          wagering,
        });
      } catch (err: any) {
        if (err instanceof AppError) {
          return next(err);
        }

        if (err.name === "JsonWebTokenError") {
          return next(new AppError("Invalid token", 401));
        }

        if (err.name === "TokenExpiredError") {
          return next(new AppError("Token expired", 401));
        }

        console.error("JWT authentication error:", err);

        return next(new AppError("Authentication failed", 401));
      }
    }

    // =========================================================
    // 2. Telegram Authentication
    // =========================================================

    const { initData } = req.body;

    if (!initData) {
      return next(new AppError("initData is required", 400));
    }

    // -----------------------------
    // Validate Telegram initData
    // -----------------------------
    let tgUser;

    try {
      tgUser = validateTelegramData(env.BOT_TOKEN, initData);
    } catch (err) {
      console.error("Telegram validation error:", err);

      return next(new AppError("Invalid Telegram data", 401));
    }

    if (!tgUser?.user?.id) {
      return next(new AppError("Telegram user not found", 401));
    }

    // =========================================================
    // Create / Fetch User
    // =========================================================

    const { data: user, error: userError } = await supabase
      .from("users")
      .upsert(
        {
          telegram_id: tgUser.user.id,
          username: tgUser.user.username ?? null,
          Fname: tgUser.user.first_name ?? null,
          Lname: tgUser.user.last_name ?? null,
        },
        {
          onConflict: "telegram_id",
        },
      )
      .select()
      .single();

    if (userError || !user) {
      console.error("User upsert error:", userError);

      return next(new AppError("Failed to create or fetch user", 500));
    }

    // =========================================================
    // Create JWT
    // =========================================================

    const token = jwt.sign(
      {
        userId: user.id,
        telegramId: user.telegram_id,
      },
      env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    // =========================================================
    // Fetch Complete User Data
    // =========================================================

    try {
      const { user: userWithProgress, wagering } = await fetchUserData(user.id);

      // =======================================================
      // SAME RESPONSE STRUCTURE AS JWT FLOW
      // =======================================================

      return res.json({
        access_token: token,
        user: userWithProgress,
        wagering,
      });
    } catch (err) {
      return next(err);
    }
  },
);

interface AuthRequest extends Request {
  user: {
    userId: string;
    telegramId: number;
  };
}

export const me = catchAsync(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user.userId;
    const { data } = await supabase
      .from("users")
      .select(
        `*,wallets (
        balance,
        locked_balance
      )`,
      )
      .eq("id", userId)
      .single();
    // const data=await supabase
    if (!data) {
      return next(new AppError("User not Found", 404));
    }
    res.json(data);
  },
);

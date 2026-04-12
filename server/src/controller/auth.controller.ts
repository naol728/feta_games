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

    // =========================
    // 1. Try JWT Authentication
    // =========================
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      try {
        const payload = jwt.verify(token, env.JWT_SECRET) as any;

        const { data: user, error } = await supabase
          .from("users")
          .select(
            `*,wallets (
        balance,
        locked_balance
         )
          `,
          )
          .eq("id", payload.userId)
          .single();

        if (error || !user) {
          return next(new AppError("User not found", 404));
        }

        return res.json({
          access_token: token,
          user,
        });
      } catch (err: any) {
        if (err.name === "JsonWebTokenError") {
          return next(new AppError("Invalid token", 401));
        }

        if (err.name === "TokenExpiredError") {
          return next(new AppError("Token expired", 401));
        }

        // Unknown error
        return next(new AppError("Authentication failed", 401));
      }
    }

    // =========================
    // 2. Telegram Auth Flow
    // =========================
    const { initData } = req.body;

    if (!initData) {
      return next(new AppError("initData is required", 400));
    }

    let tgUser;
    try {
      tgUser = validateTelegramData(env.BOT_TOKEN, initData);
    } catch (err) {
      return next(new AppError("Invalid Telegram data", 401));
    }

    const { data: user, error } = await supabase
      .from("users")
      .upsert(
        {
          telegram_id: tgUser.user.id,
          username: tgUser.user.username,
          Fname: tgUser.user.first_name,
          Lname: tgUser.user.last_name,
        },
        { onConflict: "telegram_id" },
      )
      .select()
      .single();

    if (error || !user) {
      return next(new AppError("Failed to create or fetch user", 500));
    }

    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegram_id },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    const { data: userdata, error: userdataerr } = await supabase
      .from("users")
      .select(
        `*,wallets (
        balance,
        locked_balance
         )
          `,
      )
      .eq("id", user.id)
      .single();

    return res.json({
      access_token: token,
      user: userdata,
    });
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
    if (!data) {
      return next(new AppError("User not Found", 404));
    }
    res.json(data);
  },
);

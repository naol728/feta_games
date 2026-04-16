import { NextFunction, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { supabase } from "../config/supabase";

interface InviteRequest extends Request {
  user: {
    userId: string;
    telegramId: number;
  };
}

export const getInviteData = catchAsync(
  async (req: InviteRequest, res: Response, next: NextFunction) => {
    const userId = req.user.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const { data, error } = await supabase.rpc("get_user_referral_stats", {
      p_user_id: userId,
    });

    if (error) {
      console.error("RPC ERROR:", error);
      return next(new AppError("Failed to fetch invite data", 500));
    }

    return res.status(200).json({
      success: true,
      data,
    });
  },
);

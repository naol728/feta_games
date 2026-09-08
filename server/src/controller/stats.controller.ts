import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { supabase } from "../config/supabase";
import { AppError } from "../utils/AppError";
export const dailyActivity = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    const endDate = new Date();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    const formatDate = (date: Date) => {
      return date.toISOString().split("T")[0];
    };

    const p_start_date = formatDate(startDate);
    const p_end_date = formatDate(endDate);

    const { data, error } = await supabase.rpc("get_daily_activity", {
      p_user_id: userId,
      p_start_date,
      p_end_date,
    });

    if (error) {
      return next(new AppError(error.message, 500));
    }

    res.json({
      status: true,
      message: "Daily activity retrieved successfully",
      data,
    });
  },
);

export const getDailyLeaderboard = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.query;

    const leaderboardDate =
      typeof date === "string"
        ? date
        : new Date().toLocaleDateString("en-CA", {
            timeZone: "Africa/Addis_Ababa",
          });

    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(leaderboardDate)) {
      return next(new AppError("Invalid date. Use YYYY-MM-DD format.", 400));
    }

    const { data, error } = await supabase.rpc("get_daily_leaderboard", {
      p_date: leaderboardDate,
    });

    if (error) {
      return next(new AppError(error.message, 500));
    }

    // Hide 4 numbers in the middle of the phone number
    const leaderboard = (data || []).map((user: any) => {
      let maskedPhone = user.phone;

      if (user.phone) {
        const phone = String(user.phone);

        if (phone.length > 8) {
          const middle = Math.floor(phone.length / 2);

          maskedPhone =
            phone.slice(0, middle - 0) + "****" + phone.slice(middle + 5);
        } else {
          // For short phone numbers
          maskedPhone = "****";
        }
      }

      return {
        ...user,
        phone: maskedPhone,
      };
    });

    return res.status(200).json({
      success: true,
      date: leaderboardDate,
      leaderboard,
    });
  },
);

export const getSupport = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { data, error } = await supabase.rpc("get_support_rules");

    if (error) {
      return next(new AppError("Failed to fetch support information", 500));
    }

    res.status(200).json({
      success: true,
      data,
    });
  },
);

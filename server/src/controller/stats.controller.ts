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

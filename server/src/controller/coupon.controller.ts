import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { supabase } from "../config/supabase";

export const redeemCoupon = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId;
    const { coupon } = req.body;

    if (!userId) {
      return next(new AppError("Authentication required", 401));
    }

    if (!coupon) {
      return next(new AppError("Coupon code is required", 400));
    }

    const couponCode = coupon.trim();

    if (!couponCode) {
      return next(new AppError("Coupon code is required", 400));
    }

    const { data, error } = await supabase.rpc("redeem_coupon", {
      p_user_id: userId,
      p_coupon_code: couponCode,
    });

    if (error) {
      return next(
        new AppError(`Failed to redeem coupon: ${error.message}`, 500),
      );
    }

    if (!data) {
      return next(
        new AppError("No response received from coupon redemption", 500),
      );
    }

    if (data.success === false) {
      return res.status(400).json(data);
    }

    return res.status(200).json(data);
  },
);

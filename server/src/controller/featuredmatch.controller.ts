import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { supabase } from "../config/supabase";
export const getMatches = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { data, error } = await supabase.rpc("get_featured_match");

    if (error) {
      return next(new AppError(error.message, 500));
    }

    return res.status(200).json(data);
  },
);
export const placefeaturematchbet = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const { matchId, predictionId, stake } = req.body;

    // --------------------------------------------------
    // Validate request
    // --------------------------------------------------

    if (!matchId) {
      return next(new AppError("Match ID is required", 400));
    }

    if (!predictionId) {
      return next(new AppError("Prediction ID is required", 400));
    }

    if (stake === undefined || stake === null || stake === "") {
      return next(new AppError("Bet amount is required", 400));
    }

    const betAmount = Number(stake);

    if (!Number.isFinite(betAmount)) {
      return next(new AppError("Invalid bet amount", 400));
    }

    if (betAmount <= 0) {
      return next(new AppError("Bet amount must be greater than 0", 400));
    }

    if (Math.round(betAmount * 100) / 100 !== betAmount) {
      return next(
        new AppError("Bet amount can have at most 2 decimal places", 400),
      );
    }

    const { data, error } = await supabase.rpc("place_featured_match_bet", {
      p_user_id: userId,
      p_match_id: matchId,
      p_prediction_id: predictionId,
      p_stake: betAmount,
    });

    if (error) {
      console.error("place_featured_match_bet RPC error:", error);

      return next(
        new AppError(
          error.message || "Failed to place featured match bet",
          400,
        ),
      );
    }

    return res.status(200).json(data);
  },
);

export const getmyfeaturematchbet = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const { matchId } = req.query;

    if (!matchId || typeof matchId !== "string") {
      return next(new AppError("Match ID is required", 400));
    }

    const { data, error } = await supabase
      .from("featured_match_bets")
      .select(
        `
        id,
        match_id,
        prediction_id,
        stake,
        odds,
        potential_payout,
        payout,
        status,
        settled_at,
        created_at,
        prediction:featured_match_predictions (
          id,
          home_score,
          away_score,
          odds
        )
      `,
      )
      .eq("user_id", userId)
      .eq("match_id", matchId)
      .in("status", ["pending", "won", "lost"])
      .maybeSingle();

    if (error) {
      return next(new AppError("Failed to fetch your bet", 500));
    }

    return res.status(200).json({
      success: true,
      data,
    });
  },
);

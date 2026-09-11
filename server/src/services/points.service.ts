import { supabase } from "../config/supabase";

export const pointsService = {
  /**
   * Award gameplay points based on the amount wagered.
   *
   * 4 ETB wagered = 1 point
   * 100 ETB wagered = 25 points
   */
  async addGameplayPoints(userId: string, amount: number) {
    if (!userId) {
      throw new Error("User ID is required");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid gameplay amount");
    }

    const { data, error } = await supabase.rpc("add_gameplay_points", {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) {
      console.error("Failed to add gameplay points:", error);
      throw error;
    }

    return data?.[0] ?? null;
  },
};

import { supabase } from "../config/supabase";
import { redis } from "../config/radis";
import { io } from "../app";

async function emitBalance(userId: string) {
  const socketId = await redis.get(`player:${userId}`);

  if (!socketId) return;

  const { data: wallet, error } = await supabase
    .from("wallets")
    .select("balance, locked_balance, withdrawable_balance")
    .eq("user_id", userId)
    .single();

  if (error || !wallet) return;

  io.to(socketId).emit("balance:update", wallet);
}

export const wageringService = {
  async recordWager(
    userId: string,
    betAmount: number,
    gameType: string,
    gameRoundId?: string | null,
  ) {
    if (betAmount <= 0) {
      throw new Error("Bet amount must be greater than 0");
    }

    const { data, error } = await supabase.rpc("record_wagering", {
      p_user_id: userId,
      p_bet_amount: betAmount,
      p_game_type: gameType,
      p_game_round_id: gameRoundId ?? null,
    });

    if (error) {
      console.error("WAGERING ERROR:", error);
      throw error;
    }

    await emitBalance(userId);

    return data[0];
  },
  async addDepositRequirement(
    userId: string,
    depositAmount: number,
    multiplier: number = 3,
    referenceId?: string,
  ) {
    if (depositAmount <= 0) {
      throw new Error("Deposit amount must be greater than 0");
    }

    if (multiplier <= 0) {
      throw new Error("Wagering multiplier must be greater than 0");
    }

    const requiredAmount = depositAmount * multiplier;

    const { data, error } = await supabase
      .from("wagering_requirements")
      .insert({
        user_id: userId,
        type: "deposit",
        source_amount: depositAmount,
        wagering_multiplier: multiplier,
        required_amount: requiredAmount,
        wagered_amount: 0,
        status: "active",
        reference_id: referenceId ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("ADD DEPOSIT WAGERING ERROR:", error);
      throw error;
    }

    return data;
  },
  async getWageringStatus(userId: string) {
    const { data, error } = await supabase
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
      status
    `,
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("remaining_amount", 0)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    const requirements = data ?? [];

    const remaining = requirements.reduce(
      (sum, item) => sum + Number(item.remaining_amount),
      0,
    );

    return {
      completed: requirements.length === 0,
      remaining,
      requirements,
    };
  },
};

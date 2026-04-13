import { supabase } from "../config/supabase";
import { redis } from "../config/radis";
import { io } from "../app";

async function emitBalance(userId: string) {
  const socketId = await redis.get(`player:${userId}`);
  if (!socketId) return;

  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance, locked_balance")
    .eq("user_id", userId)
    .single();

  if (!wallet) return;

  io.to(socketId).emit("balance:update", wallet);
}

export const walletService = {
  async addBalance(userId: string, amount: number) {
    await supabase.rpc("increment_wallet_balance", {
      user_id_input: userId,
      amount_input: amount,
    });

    await emitBalance(userId);
  },

  async lockBalance(userId: string, amount: number) {
    await supabase.rpc("lock_wallet_balance", {
      user_id_input: userId,
      amount_input: amount,
    });

    await emitBalance(userId);
  },

  async unlockBalance(userId: string, amount: number) {
    await supabase.rpc("unlock_wallet_balance", {
      user_id_input: userId,
      amount_input: amount,
    });

    await emitBalance(userId);
  },

  async resolveMatch(
    winnerId: string,
    loserId: string,
    betAmount: number,
    gamesource: string,
  ) {
    await supabase.rpc("resolve_match", {
      winner_id: winnerId,
      loser_id: loserId,
      bet_amount: betAmount,
      game_source: gamesource,
    });

    await Promise.all([emitBalance(winnerId), emitBalance(loserId)]);
  },
};

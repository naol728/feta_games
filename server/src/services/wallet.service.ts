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
  async lockandchcekBalance(userId: string, bet: number) {
    const { data, error } = await supabase.rpc("lock_and_check_balance", {
      user_id_input: userId,
      amount_input: bet,
    });
    if (error) throw error;
    await emitBalance(userId);
    return data;
  },
  async settleCrashWin(
    userId: string,
    payout: number,
    betAmount: number,
  ): Promise<{
    balance: number;
    locked_balance: number;
    withdrawable_balance: number;
  }> {
    const { data, error } = await supabase.rpc("settle_crash_win", {
      user_id_input: userId,
      payout_input: payout,
      bet_amount_input: betAmount,
    });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error("Failed to settle crash win");
    }

    return data[0];
  },

  async lockBalance(userId: string, amount: number) {
    await supabase.rpc("lock_wallet_balance", {
      user_id_input: userId,
      amount_input: amount,
    });

    await emitBalance(userId);
  },

  async unlockBalance(userId: string) {
    const { error } = await supabase.rpc("unlock_wallet_balance", {
      p_user_id: userId,
    });
    if (error) {
      console.log(error);
      throw error;
    }

    await emitBalance(userId);
  },
  async getWallet(userId: string) {
    const { error, data } = await supabase
      .from("wallets")
      .select("balance,locked_balance,available_balance,withdrawable_balance")
      .eq("user_id", userId)
      .single();
    if (error) {
      console.log(error);
      throw error;
    }
    return data;
  },
  async consumeLockedBalance(
    userId: string,
    amount: number,
  ): Promise<Array<{ balance: number; locked_balance: number }>> {
    const { data: wallet, error: fetchError } = await supabase
      .from("wallets")
      .select("balance, locked_balance,withdrawable_balance")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      console.log(fetchError);
      throw fetchError;
    }

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (wallet.locked_balance < amount) {
      throw new Error("Insufficient locked balance");
    }

    const newLockedBalance = wallet.locked_balance - amount;

    const { data, error } = await supabase
      .from("wallets")
      .update({
        locked_balance: newLockedBalance,
      })
      .eq("user_id", userId)
      .select("balance, locked_balance");

    if (error) {
      console.log(error);
      throw error;
    }

    return (data ?? []) as Array<{
      balance: number;
      locked_balance: number;
    }>;
  },
  async resolveMatch(
    winnerId: string,
    loserId: string,
    betAmount: number,
    gamesource: string,
  ) {
    const { error } = await supabase.rpc("resolve_match", {
      winner_id: winnerId,
      loser_id: loserId,
      bet_amount: betAmount,
      game_source: gamesource,
    });
    if (error) {
      console.log(error);
      throw error;
    }
    // ✅ MARK BOTH PLAYERS AS PLAYED
    const { error: markError } = await supabase.rpc("mark_game_played", {
      p_user_ids: [winnerId, loserId],
    });

    if (markError) {
      console.error("MARK PLAYED ERROR:", markError);
      // ❗ don't throw → not critical for match result
    }
    await Promise.allSettled([emitBalance(winnerId), emitBalance(loserId)]);
  },
  async checkBalance(playerId: string, bet: number) {
    const { data, error } = await supabase.rpc("check_balance", {
      user_id_input: playerId,
      amount_input: bet,
    });
    if (error) throw error;
    await emitBalance(playerId);
    return data;
  },
};

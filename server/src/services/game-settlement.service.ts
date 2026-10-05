import { supabase } from "../config/supabase";

export interface WalletSnapshot {
  balance: number;
  locked_balance: number;
  withdrawable_balance: number;
  available_balance: number;
}

export interface SettleEntry {
  userId: string;
  bet: number;
  payout: number; // 0 = loss, >0 = total payout (not profit)
  metadata?: Record<string, unknown>;
}

export interface SettleResult {
  user_id: string;
  status: "ok" | "duplicate" | "error";
  message?: string;
  wallet?: WalletSnapshot;
}

// Keeps each DB call short and the PostgREST pool from being flooded.
const CHUNK_SIZE = 250;

async function callBatch(
  game: string,
  roundId: string,
  chunk: Array<Record<string, unknown>>,
): Promise<SettleResult[]> {
  const { data, error } = await supabase.rpc("settle_games_batch", {
    p_game: game,
    p_round_id: roundId,
    p_entries: chunk,
  });
  if (error) throw error;
  return (data ?? []) as SettleResult[];
}

/**
 * Settle every entry of a round with a handful of DB calls instead of
 * one-per-player. Safe to retry: settle_game is idempotent per
 * (game, round, user).
 */
export async function settleGameBatch(
  game: string,
  roundId: string,
  entries: SettleEntry[],
): Promise<SettleResult[]> {
  const results: SettleResult[] = [];

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE).map((e) => ({
      user_id: e.userId,
      bet: e.bet,
      payout: e.payout,
      metadata: e.metadata ?? {},
    }));

    try {
      results.push(...(await callBatch(game, roundId, chunk)));
    } catch (firstErr) {
      console.error(`[${game}] settle chunk failed, retrying once:`, firstErr);
      try {
        results.push(...(await callBatch(game, roundId, chunk)));
      } catch (secondErr) {
        console.error(`[${game}] settle chunk failed twice:`, secondErr);
        results.push(
          ...chunk.map((c) => ({
            user_id: c.user_id as string,
            status: "error" as const,
            message: "settlement failed",
          })),
        );
      }
    }
  }

  const failed = results.filter((r) => r.status === "error");
  if (failed.length) {
    // Money is still safely locked; re-run settleGameBatch for these.
    console.error(
      `[${game}] ${failed.length} entries failed in round ${roundId}`,
    );
  }

  return results;
}

/** Bet path: lock funds and get the fresh wallet back in ONE call. */
export async function lockBet(
  userId: string,
  amount: number,
): Promise<WalletSnapshot | null> {
  const { data, error } = await supabase.rpc("lock_bet", {
    p_user_id: userId,
    p_bet: amount,
  });
  if (error) throw error;
  return (data as WalletSnapshot | null) ?? null;
}

/**
 * Settle a single bet (e.g. a crash cash-out that happens outside a
 * fixed round). Goes through the batch RPC so there is only one SQL path.
 */
export async function settleOne(
  game: string,
  roundId: string,
  entry: SettleEntry,
): Promise<SettleResult> {
  const [res] = await settleGameBatch(game, roundId, [entry]);
  return res;
}

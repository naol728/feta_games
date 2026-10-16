/* eslint-disable */

import { randomUUID, randomInt } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import { supabase } from "../../config/supabase";
import { wageringService } from "../../services/waggering.service";
import { pointsService } from "../../services/points.service";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

// ============================================================
// WHY THIS IS STATELESS (LIKE SLOTS, NOT LIKE MINES/KENO)
// ============================================================

const ROWS = 16;
const MIN_BET = 1;
const MAX_BET = 50_000;

// ============================================================
// RTP -- EXACTLY 95%, DERIVED NOT GUESSED
// ============================================================

const PLINKO_MULTIPLIERS: number[] = [
  959.8244, 124.7772, 24.9554, 8.6384, 3.8393, 1.9196, 0.192, 0.192, 0.192,
  0.192, 0.192, 1.9196, 3.8393, 8.6384, 24.9554, 124.7772, 959.8244,
];

if (PLINKO_MULTIPLIERS.length !== ROWS + 1) {
  throw new Error(
    `PLINKO_MULTIPLIERS must have ${ROWS + 1} entries for ${ROWS} rows, got ${PLINKO_MULTIPLIERS.length}`,
  );
}

// ============================================================
// ODDS TABLE
// ============================================================

const TOTAL_OUTCOMES = Math.pow(2, ROWS);

function binomialCoefficient(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return Math.round(result);
}

const PLINKO_ODDS = PLINKO_MULTIPLIERS.map((multiplier, bin) => {
  const ways = binomialCoefficient(ROWS, bin);
  const chance = ways / TOTAL_OUTCOMES;
  return {
    bin,
    multiplier,
    ways,
    chance,
    oneIn: Math.round(1 / chance),
  };
});

const PLINKO_RTP = PLINKO_ODDS.reduce(
  (sum, o) => sum + o.chance * o.multiplier,
  0,
);

const PLINKO_CONFIG = {
  rows: ROWS,
  minBet: MIN_BET,
  maxBet: MAX_BET,
  bins: PLINKO_ODDS,
  rtp: PLINKO_RTP,
  currency: "ETB",
};

function generatePath(): { path: number[]; bin: number } {
  const path: number[] = [];
  let bin = 0;

  for (let i = 0; i < ROWS; i++) {
    const bounce = randomInt(2);
    path.push(bounce);
    bin += bounce;
  }

  return { path, bin };
}

// ============================================================
// TRANSACTION RECORDING
// ============================================================

const recordPlinkoTransaction = async ({
  userId,
  type,
  amount,
  roundId,
  bin,
  multiplier,
}: {
  userId: string;
  type: "win" | "lose";
  amount: number;
  roundId: string;
  bin: number;
  multiplier: number;
}): Promise<void> => {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount,
    status: "completed",
    reference_id: `${roundId}_${userId}`,
    metadata: { game: "plinko", round_id: roundId, bin, multiplier },
  });

  if (error) {
    console.error("Failed to record plinko transaction:", error);
  }
};

// ============================================================
// SOCKET HANDLER
// ============================================================

export default function Plinko(io: Server, socket: CustomSocket) {
  const userId = socket.user.userId;

  let requestInFlight = false;

  // ------------------------------------------------------------
  // plinko:config
  //
  // Some socket.io versions silently drop the ack when only two args
  // (event, ack) are passed. This handler scans the args for any
  // function and uses that as the ack. If none is found it pushes
  // the config as an event instead, so the client still gets it.
  // ------------------------------------------------------------
  socket.on("plinko:config", (...args: any[]) => {
    const callback = args.find((a) => typeof a === "function");

    if (typeof callback === "function") {
      try {
        callback({ ok: true, config: PLINKO_CONFIG });
      } catch (err) {
        console.error("[plinko] config ack error:", err);
      }
      return;
    }

    // Fallback push so the client can subscribe to it.
    socket.emit("plinko:config:push", { ok: true, config: PLINKO_CONFIG });
  });

  // ------------------------------------------------------------
  // plinko:drop
  //
  // Design notes:
  //  - releaseAllLocks runs first (best-effort, never blocks)
  //  - lockAndCheck moves the stake to locked_balance
  //  - settleCrashWin moves (stake - payout) appropriately and
  //    is where the wallet math is finalised
  //  - the four side-effect writes (tx, wagering, points,
  //    daily activity) run in parallel, fired-and-forgotten
  //  - getWallet is only awaited so the ack can carry fresh
  //    numbers; if it fails we still reply ok:true
  // ------------------------------------------------------------
  socket.on(
    "plinko:drop",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        try {
          if (typeof callback === "function") callback(result);
        } catch (err) {
          console.error("[plinko] drop ack error:", err);
        }
      };

      if (requestInFlight) {
        return reply({ ok: false, error: "Previous drop still processing" });
      }

      requestInFlight = true;

      let lockedAmount = 0;

      try {
        if (!userId) {
          return reply({ ok: false, error: "You must be logged in" });
        }

        const body =
          typeof payload === "object" && payload !== null
            ? (payload as { betAmount?: unknown })
            : {};

        const betAmount = Number(body.betAmount);

        if (
          !Number.isFinite(betAmount) ||
          betAmount < MIN_BET ||
          betAmount > MAX_BET
        ) {
          return reply({
            ok: false,
            error: `Bet must be between ${MIN_BET} and ${MAX_BET} ETB`,
          });
        }

        // -- Best-effort stale-lock release ----------------------
        // Guards on the helper existing at runtime so a missing
        // method on the running build can't abort the drop.
        if (typeof (walletService as any).releaseAllLocks === "function") {
          try {
            await (walletService as any).releaseAllLocks(userId);
          } catch (e) {
            console.warn("[plinko] releaseAllLocks failed (non-fatal):", e);
          }
        }

        // -- Lock the stake --------------------------------------
        const locked = await walletService.lockandchcekBalance(
          userId,
          betAmount,
        );
        if (!locked) {
          return reply({ ok: false, error: "Insufficient funds" });
        }
        lockedAmount = betAmount;

        // -- Decide the outcome ---------------------------------
        const { path, bin } = generatePath();
        const multiplier = PLINKO_MULTIPLIERS[bin];
        const odds = PLINKO_ODDS[bin];
        const payout = Math.round(betAmount * multiplier * 100) / 100;
        const profit = Math.round((payout - betAmount) * 100) / 100;
        const roundId = `plinko_${Date.now()}_${randomUUID().slice(0, 8)}`;

        // -- Settle the wallet ----------------------------------
        await walletService.settleCrashWin(userId, payout, betAmount);
        lockedAmount = 0; // settled -- nothing left to refund on error

        // -- Side effects, in parallel, fire-and-forget ---------
        void Promise.allSettled([
          recordPlinkoTransaction({
            userId,
            type: payout >= betAmount ? "win" : "lose",
            amount: payout,
            roundId,
            bin,
            multiplier,
          }),
          wageringService.recordWager(userId, betAmount, "Plinko", roundId),
          pointsService.addGameplayPoints(userId, betAmount),
          supabase.rpc("record_daily_activity", {
            p_user_id: userId,
            p_activity_type: "played",
          }),
        ]);

        // -- Fresh wallet for the ack (best effort) -------------
        let wallet: any = null;
        try {
          wallet = await walletService.getWallet(userId);
        } catch (walletErr) {
          console.warn("[plinko] getWallet after settle failed:", walletErr);
        }

        reply({
          ok: true,
          roundId,
          path,
          bin,
          multiplier,
          payout,
          profit,
          betAmount,
          chance: odds.chance,
          oneIn: odds.oneIn,
          ways: odds.ways,
          totalOutcomes: TOTAL_OUTCOMES,
          wallet,
        });
      } catch (error) {
        console.error("Plinko drop error:", error);

        // If we died between locking and settling, give the stake
        // back rather than silently swallowing it.
        if (lockedAmount > 0) {
          try {
            await walletService.settleCrashWin(
              userId,
              lockedAmount,
              lockedAmount,
            );
          } catch (refundError) {
            console.error("Plinko refund failed:", refundError, { userId });
          }
        }

        reply({ ok: false, error: "Could not drop the ball" });
      } finally {
        requestInFlight = false;
      }
    },
  );
}

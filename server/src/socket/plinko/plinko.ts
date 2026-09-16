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
// A Plinko drop is fully decided the instant it starts: 16 independent
// coin flips determine which bin the ball lands in, and there's
// nothing secret that has to survive across multiple round trips (no
// hidden board, no "reveal one tile at a time"). So this is one
// atomic request/response, exactly like a slot spin -- no Redis
// needed, no per-user persisted game, no leader election. The client
// gets the server's actual path back and just animates a ball
// following it; the outcome was already decided before any pixel
// moves.
// ============================================================

const ROWS = 16;
const MIN_BET = 1;
const MAX_BET = 50_000;

// ============================================================
// RTP -- EXACTLY 95%, DERIVED NOT GUESSED
// ============================================================
//
// Each peg is a fair 50/50 bounce (this is NOT rigged toward the
// house by biasing the coin -- that would make the game provably
// unfair, not just house-edged). With 16 fair bounces, the
// probability of landing in bin k (0..16) is the exact binomial:
//
//   P(k) = C(16, k) / 2^16
//
// The original payout table [1000, 130, 26, 9, 4, 2, 0.2, ...,
// 2, 4, 9, 26, 130, 1000] has an exact expected value (computed from
// the binomial distribution above, no simulation needed) of
// 0.989764... -- i.e. that table alone pays out 98.98% RTP, not a
// chosen number. To hit exactly 95%, every multiplier was scaled by
// the same constant (0.95 / 0.989764... = 0.959824...), which
// preserves the table's shape (rare outer bins still pay far more
// than the common center bins) while making the overall expectation
// exactly 0.95 * bet. Verified by recomputing the expectation with
// the rounded table below: 0.950021 (95.0021%).
const PLINKO_MULTIPLIERS: number[] = [
  959.8244, 124.7772, 24.9554, 8.6384, 3.8393, 1.9196, 0.192, 0.192, 0.192,
  0.192, 0.192, 1.9196, 3.8393, 8.6384, 24.9554, 124.7772, 959.8244,
];
// length must be ROWS + 1 (17 bins for 16 rows) -- checked at load so
// a future edit to ROWS or the table can't silently misalign them.
if (PLINKO_MULTIPLIERS.length !== ROWS + 1) {
  throw new Error(
    `PLINKO_MULTIPLIERS must have ${ROWS + 1} entries for ${ROWS} rows, got ${PLINKO_MULTIPLIERS.length}`,
  );
}

// ============================================================
// ODDS TABLE -- SO THE UI CAN TELL THE PLAYER THE TRUTH
// ============================================================
// The client should never hardcode these: if ROWS or the payout
// table ever changes, the numbers shown to the player have to change
// with it. Computed once at load from the same binomial the game
// actually uses.
//
//   chance   = P(k) = C(16, k) / 2^16      (e.g. 0.0000152587890625)
//   oneIn    = 1 / P(k)                    (e.g. 65536 -> "1 in 65,536")
//
// "1 in N" is the form most players actually understand; the raw
// probability is sent too so the UI can show a percentage as well.
const TOTAL_OUTCOMES = Math.pow(2, ROWS); // 65,536 equally likely paths

function binomialCoefficient(n: number, k: number): number {
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return Math.round(result);
}

const PLINKO_ODDS = PLINKO_MULTIPLIERS.map((multiplier, bin) => {
  const ways = binomialCoefficient(ROWS, bin); // paths that land here
  const chance = ways / TOTAL_OUTCOMES;
  return {
    bin,
    multiplier,
    ways,
    chance,
    oneIn: Math.round(1 / chance),
  };
});

// The exact RTP of the live table, sent to the client so the payout
// info panel can never drift from the real number.
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

// Fair coin flips -- returns the path (0 = left, 1 = right) and the
// resulting bin (just the count of right-bounces, same math as the
// original client-side path.reduce((a,b) => a+b, 0)).
//
// randomInt (CSPRNG) instead of Math.random: Math.random is a seeded
// PRNG whose internal state is predictable from enough observed
// outputs, and every drop hands the player the full path -- which is
// exactly the observation an attacker needs. Same distribution, same
// speed at this volume, no predictability.
function generatePath(): { path: number[]; bin: number } {
  const path: number[] = [];
  let bin = 0;

  for (let i = 0; i < ROWS; i++) {
    const bounce = randomInt(2); // 0 or 1, uniformly
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
    // roundId already starts with "plinko_", so no second prefix here.
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
// No shared state, no singleton -- every drop is independent, so
// this just wires a listener directly onto each connecting socket
// (same shape as the slots handler).

export default function Plinko(io: Server, socket: CustomSocket) {
  const userId = socket.user.userId;

  // Guards against a client accidentally double-firing the same
  // click; NOT a correctness mechanism for the wallet (the atomic
  // wallet RPC/lock calls are what actually protect balance).
  let requestInFlight = false;

  // The UI asks for this once on mount and builds its payout ladder,
  // odds column and bet limits from it -- nothing about the maths is
  // duplicated on the client.
  socket.on("plinko:config", (callback?: (result: any) => void) => {
    if (typeof callback === "function") {
      callback({ ok: true, config: PLINKO_CONFIG });
    }
  });

  socket.on(
    "plinko:drop",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      if (requestInFlight) {
        return reply({ ok: false, error: "Previous drop still processing" });
      }

      requestInFlight = true;

      // Tracked so a crash *after* the bet is locked can release it
      // instead of leaving the player's money stuck.
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

        const locked = await walletService.lockandchcekBalance(
          userId,
          betAmount,
        );
        if (!locked) {
          return reply({ ok: false, error: "Insufficient funds" });
        }
        lockedAmount = betAmount;

        const { path, bin } = generatePath();
        const multiplier = PLINKO_MULTIPLIERS[bin];
        const odds = PLINKO_ODDS[bin];
        const payout = Math.round(betAmount * multiplier * 100) / 100;
        const profit = Math.round((payout - betAmount) * 100) / 100;
        const roundId = `plinko_${Date.now()}_${randomUUID().slice(0, 8)}`;

        // Plinko always pays SOMETHING (the smallest multiplier is
        // 0.192x, never 0) -- so every drop settles as a "win" from the
        // wallet's point of view (funds move back in), even though a
        // payout under the bet amount is a loss in profit terms. The
        // transaction record below reflects that distinction for
        // reporting even though the wallet call is uniform.
        await walletService.settleCrashWin(userId, payout, betAmount);
        lockedAmount = 0; // settled -- nothing left to release

        await recordPlinkoTransaction({
          userId,
          type: payout >= betAmount ? "win" : "lose",
          amount: payout,
          roundId,
          bin,
          multiplier,
        });

        void wageringService.recordWager(userId, betAmount, "Plinko", roundId);
        void pointsService.addGameplayPoints(userId, betAmount);
        void supabase.rpc("record_daily_activity", {
          p_user_id: userId,
          p_activity_type: "played",
        });

        const wallet = await walletService.getWallet(userId);

        reply({
          ok: true,
          roundId,
          path,
          bin,
          multiplier,
          payout,
          profit, // + means the player is up on this drop, - means down
          betAmount,
          // Everything the "you hit 24.96x" line needs, straight from
          // the server's own odds table.
          chance: odds.chance, // 0.0000152... (fraction)
          oneIn: odds.oneIn, // 65536 -> "1 in 65,536"
          ways: odds.ways, // paths that reach this bin
          totalOutcomes: TOTAL_OUTCOMES,
          wallet,
        });
      } catch (error) {
        console.error("Plinko drop error:", error);

        // If we died between locking the bet and settling it, give the
        // stake back rather than silently swallowing it. Confirm this
        // matches your wallet service's semantics for a zero payout.
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

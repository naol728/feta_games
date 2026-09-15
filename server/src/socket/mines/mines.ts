/* eslint-disable */

import { randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { redis } from "../../config/radis";
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
// WHY THIS NEEDS PER-USER SERVER STATE (UNLIKE SLOTS, LIKE KENO)
// ============================================================
// A slot spin is one atomic request/response. Mines is not: the
// mine positions have to stay secret on the server across MULTIPLE
// round trips (start -> reveal -> reveal -> ... -> cashout/hit),
// otherwise a client that can see its own network traffic could just
// read the mine layout out of the first response and never lose.
// So each user's in-progress game lives in Redis (works across
// horizontally scaled instances, same as crash/keno), and every
// reveal is an atomic check-and-update against it via Lua -- a
// double-click or a duplicate event can't reveal the same tile twice
// or reveal after the game already ended.
//
// Unlike crash/keno this is NOT a shared round -- every user has
// their own independent game and their own independent clock (there
// isn't one), so there's no leader election here at all.
// ============================================================

const BOARD_SIZE = 25;
const MIN_MINES = 1;
const MAX_MINES = 24; // must leave at least 1 safe tile
const MIN_BET = 1;
const MAX_BET = 50_000;

const gameKey = (userId: string) => `mines:game:${userId}`;

// ============================================================
// RTP -- EXACTLY 95%, BY CONSTRUCTION
// ============================================================
//
// For k safe reveals out of 25 tiles with M mines, the probability
// of surviving all k picks is the exact combinatorial:
//
//   P(survive k) = product_{i=0}^{k-1} (25-M-i) / (25-i)
//
// The "fair" multiplier -- the one that makes committing to reveal
// exactly k tiles and then stopping have an expected payout equal to
// the bet -- is 1/P(survive k). This code computes exactly that
// product, then scales the whole thing by a constant HOUSE_EDGE_FACTOR.
//
// That constant is the entire RTP lever, and it's not just true "on
// average" for one fixed k -- it's true for ANY stopping strategy,
// including one where the player decides adaptively after seeing
// each multiplier. That's because bet * HOUSE_EDGE_FACTOR *
// multiplier(k) is a martingale under the true survival
// probabilities (multiplying a fair martingale by a constant is
// still a martingale), and the number of reveals is always a
// bounded stopping time (capped at 25-M). By the optional stopping
// theorem, E[payout] = HOUSE_EDGE_FACTOR * bet regardless of when or
// how the player chooses to stop. So RTP = HOUSE_EDGE_FACTOR exactly,
// no simulation needed to verify it -- unlike keno/slots, this game's
// payout structure makes the constant BE the RTP.
const HOUSE_EDGE_FACTOR = 0.95;

function getMultiplier(minesCount: number, safeRevealed: number): number {
  let multiplier = HOUSE_EDGE_FACTOR;
  for (let i = 0; i < safeRevealed; i++) {
    multiplier *= (BOARD_SIZE - i) / (BOARD_SIZE - i - minesCount);
  }
  return multiplier;
}

// ============================================================
// LUA: START
// ============================================================
// Refuses to start a second game while one is already active for
// this user (matches the UX: finish your current game first).

const START_SCRIPT = `
local key = KEYS[1]
local active = redis.call('HGET', key, 'active')
if active == '1' then
  return cjson.encode({status='ALREADY_ACTIVE'})
end

redis.call('HSET', key,
  'active', '1',
  'minesCount', ARGV[1],
  'betAmount', ARGV[2],
  'mineIndices', ARGV[3],
  'revealed', '[]',
  'roundId', ARGV[4]
)
return cjson.encode({status='OK'})
`;

// ============================================================
// LUA: REVEAL
// ============================================================
// Atomically: verify the game is active, the tile hasn't already
// been revealed, then check it against the (secret, server-only)
// mine list. On a mine, ends the game and returns every mine
// position so the client can show the full board. On a safe tile,
// appends it to the revealed list and flags an auto-clear if every
// remaining safe tile has now been found.

const REVEAL_SCRIPT = `
local key = KEYS[1]
local indexArg = tonumber(ARGV[1])

local active = redis.call('HGET', key, 'active')
if active ~= '1' then
  return cjson.encode({error='INACTIVE'})
end

local revealed = cjson.decode(redis.call('HGET', key, 'revealed'))
for _, v in ipairs(revealed) do
  if v == indexArg then
    return cjson.encode({error='ALREADY_REVEALED'})
  end
end

local mines = cjson.decode(redis.call('HGET', key, 'mineIndices'))
local isMine = false
for _, v in ipairs(mines) do
  if v == indexArg then isMine = true end
end

local minesCount = tonumber(redis.call('HGET', key, 'minesCount'))
local betAmount = tonumber(redis.call('HGET', key, 'betAmount'))

if isMine then
  redis.call('HSET', key, 'active', '0')
  return cjson.encode({
    isMine = true,
    mineIndices = mines,
    revealed = revealed,
    minesCount = minesCount,
    betAmount = betAmount,
  })
end

table.insert(revealed, indexArg)
redis.call('HSET', key, 'revealed', cjson.encode(revealed))

local maxSafe = 25 - minesCount
local isFullClear = (#revealed >= maxSafe)

if isFullClear then
  redis.call('HSET', key, 'active', '0')
end

return cjson.encode({
  isMine = false,
  revealed = revealed,
  isFullClear = isFullClear,
  minesCount = minesCount,
  betAmount = betAmount,
})
`;

// ============================================================
// LUA: CASHOUT
// ============================================================

const CASHOUT_SCRIPT = `
local key = KEYS[1]

local active = redis.call('HGET', key, 'active')
if active ~= '1' then
  return cjson.encode({error='INACTIVE'})
end

local revealed = cjson.decode(redis.call('HGET', key, 'revealed'))
local minesCount = tonumber(redis.call('HGET', key, 'minesCount'))
local betAmount = tonumber(redis.call('HGET', key, 'betAmount'))

redis.call('HSET', key, 'active', '0')

return cjson.encode({
  revealed = revealed,
  minesCount = minesCount,
  betAmount = betAmount,
})
`;

async function evalScript(
  script: string,
  keys: string[],
  args: (string | number)[],
) {
  const result = await redis.eval(
    script,
    keys.length,
    ...keys,
    ...args.map(String),
  );
  return JSON.parse(result as string);
}

async function getActiveGame(userId: string) {
  const raw = await redis.hgetall(gameKey(userId));
  if (!raw || raw.active !== "1") return null;

  return {
    minesCount: Number(raw.minesCount),
    betAmount: Number(raw.betAmount),
    revealed: JSON.parse(raw.revealed || "[]") as number[],
    roundId: raw.roundId as string | null,
  };
}

// ============================================================
// TRANSACTION RECORDING
// ============================================================

const recordMinesTransaction = async ({
  userId,
  type,
  amount,
  roundId,
  minesCount,
  revealedCount,
}: {
  userId: string;
  type: "win" | "lose";
  amount: number;
  roundId: string | null;
  minesCount: number;
  revealedCount: number;
}): Promise<void> => {
  const { error } = await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount,
    status: "completed",
    reference_id: `mines_${roundId ?? "unknown"}_${userId}_${type}`,
    metadata: {
      game: "mines",
      round_id: roundId,
      mines_count: minesCount,
      revealed_count: revealedCount,
    },
  });

  if (error) {
    console.error("Failed to record mines transaction:", error);
  }
};

const finishSettlement = async (userId: string) => {
  await supabase.rpc("record_daily_activity", {
    p_user_id: userId,
    p_activity_type: "played",
  });
  await redis.del(gameKey(userId));
};

// ============================================================
// SOCKET HANDLER
// ============================================================
// No shared round, no leader election -- every user's game is
// independent, so (like slots) this just wires listeners directly
// onto each connecting socket.

export default function Mines(io: Server, socket: CustomSocket) {
  const userId = socket.user.userId;

  let requestInFlight = false;

  const guard = async (
    handler: () => Promise<void>,
    reply: (result: any) => void,
    errorMessage: string,
  ) => {
    if (requestInFlight) {
      return reply({ ok: false, error: "Previous request still processing" });
    }

    requestInFlight = true;
    try {
      await handler();
    } catch (error) {
      console.error(errorMessage, error);
      reply({ ok: false, error: errorMessage });
    } finally {
      requestInFlight = false;
    }
  };

  // ==========================================================
  // REQUEST STATE (reconnect support)
  // ==========================================================

  socket.on(
    "mines:requestState",
    async (_payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      const game = await getActiveGame(userId);

      if (!game) {
        return reply({ active: false });
      }

      reply({
        active: true,
        minesCount: game.minesCount,
        betAmount: game.betAmount,
        revealed: game.revealed,
        multiplier: getMultiplier(game.minesCount, game.revealed.length),
      });
    },
  );

  // ==========================================================
  // START
  // ==========================================================

  socket.on(
    "mines:start",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      await guard(
        async () => {
          if (!userId)
            return reply({ ok: false, error: "You must be logged in" });

          const body =
            typeof payload === "object" && payload !== null
              ? (payload as { betAmount?: unknown; minesCount?: unknown })
              : {};

          const betAmount = Number(body.betAmount);
          const minesCount = Number(body.minesCount);

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

          if (
            !Number.isInteger(minesCount) ||
            minesCount < MIN_MINES ||
            minesCount > MAX_MINES
          ) {
            return reply({
              ok: false,
              error: `Mines must be between ${MIN_MINES} and ${MAX_MINES}`,
            });
          }

          const locked = await walletService.lockandchcekBalance(
            userId,
            betAmount,
          );
          if (!locked) return reply({ ok: false, error: "Insufficient funds" });

          // Fisher-Yates: pick `minesCount` unique positions out of 25.
          const pool = Array.from({ length: BOARD_SIZE }, (_, i) => i);
          for (let i = 0; i < minesCount; i++) {
            const j = i + Math.floor(Math.random() * (pool.length - i));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          const mineIndices = pool.slice(0, minesCount);

          const roundId = `mines_${Date.now()}_${randomUUID().slice(0, 8)}`;

          const claim = await evalScript(
            START_SCRIPT,
            [gameKey(userId)],
            [minesCount, betAmount, JSON.stringify(mineIndices), roundId],
          );

          if (claim.status === "ALREADY_ACTIVE") {
            await walletService.unlockBalance(userId);
            return reply({
              ok: false,
              error: "You already have a game in progress",
            });
          }

          void wageringService.recordWager(userId, betAmount, "Mines", roundId);
          void pointsService.addGameplayPoints(userId, betAmount);

          const wallet = await walletService.getWallet(userId);

          reply({ ok: true, minesCount, betAmount, wallet });
        },
        reply,
        "Could not start the game",
      );
    },
  );

  // ==========================================================
  // REVEAL
  // ==========================================================

  socket.on(
    "mines:reveal",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      await guard(
        async () => {
          if (!userId)
            return reply({ ok: false, error: "You must be logged in" });

          const body =
            typeof payload === "object" && payload !== null
              ? (payload as { index?: unknown })
              : {};
          const index = Number(body.index);

          if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
            return reply({ ok: false, error: "Invalid tile" });
          }

          const result = await evalScript(
            REVEAL_SCRIPT,
            [gameKey(userId)],
            [index],
          );

          if (result.error) {
            return reply({
              ok: false,
              error:
                result.error === "INACTIVE"
                  ? "No active game"
                  : "Tile already revealed",
            });
          }

          const game = await getActiveGame(userId); // null now if this call ended the game
          const roundId = (await redis.hget(gameKey(userId), "roundId")) as
            | string
            | null;

          // ------------------------------------------------
          // HIT A MINE -- game over, lose the locked bet.
          // ------------------------------------------------
          if (result.isMine) {
            await walletService.consumeLockedBalance(userId, result.betAmount);
            await recordMinesTransaction({
              userId,
              type: "lose",
              amount: result.betAmount,
              roundId,
              minesCount: result.minesCount,
              revealedCount: result.revealed.length,
            });
            await finishSettlement(userId);

            const wallet = await walletService.getWallet(userId);

            return reply({
              ok: true,
              isMine: true,
              mineIndices: result.mineIndices,
              revealed: result.revealed,
              wallet,
            });
          }

          // ------------------------------------------------
          // SAFE TILE
          // ------------------------------------------------
          const multiplier = getMultiplier(
            result.minesCount,
            result.revealed.length,
          );

          if (result.isFullClear) {
            const payout =
              Math.round(result.betAmount * multiplier * 100) / 100;

            await walletService.settleCrashWin(
              userId,
              payout,
              result.betAmount,
            );
            await recordMinesTransaction({
              userId,
              type: "win",
              amount: payout,
              roundId,
              minesCount: result.minesCount,
              revealedCount: result.revealed.length,
            });
            await finishSettlement(userId);

            const wallet = await walletService.getWallet(userId);

            return reply({
              ok: true,
              isMine: false,
              isFullClear: true,
              revealed: result.revealed,
              multiplier,
              payout,
              wallet,
            });
          }

          // Game continues -- no wallet movement yet, funds stay locked.
          reply({
            ok: true,
            isMine: false,
            isFullClear: false,
            revealed: result.revealed,
            multiplier,
          });
        },
        reply,
        "Could not reveal the tile",
      );
    },
  );

  // ==========================================================
  // CASHOUT
  // ==========================================================

  socket.on(
    "mines:cashout",
    async (_payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        if (typeof callback === "function") callback(result);
      };

      await guard(
        async () => {
          if (!userId)
            return reply({ ok: false, error: "You must be logged in" });

          const roundId = (await redis.hget(gameKey(userId), "roundId")) as
            | string
            | null;
          const result = await evalScript(
            CASHOUT_SCRIPT,
            [gameKey(userId)],
            [],
          );

          if (result.error) {
            return reply({ ok: false, error: "No active game" });
          }

          const multiplier = getMultiplier(
            result.minesCount,
            result.revealed.length,
          );
          const payout = Math.round(result.betAmount * multiplier * 100) / 100;

          await walletService.settleCrashWin(userId, payout, result.betAmount);
          await recordMinesTransaction({
            userId,
            type: "win",
            amount: payout,
            roundId,
            minesCount: result.minesCount,
            revealedCount: result.revealed.length,
          });
          await finishSettlement(userId);

          const wallet = await walletService.getWallet(userId);

          reply({ ok: true, multiplier, payout, wallet });
        },
        reply,
        "Could not cash out",
      );
    },
  );
}

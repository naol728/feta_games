/* eslint-disable */

import { redis } from "../../config/radis";

// ============================================================
// WHY REDIS
// ============================================================
//
// The original engine kept `players`, `userToPlayer`, `autoCashouts`,
// `pendingBets`, `pendingCashouts` as in-process Maps/Sets. That only works
// if there is exactly one Node process handling every socket. At 10,000
// concurrent players you don't want one process holding 10,000 sockets --
// you want to run several Node instances behind a load balancer with the
// Socket.IO Redis adapter fanning io.emit()/rooms out across all of them.
// The moment you do that, in-memory state is wrong: a bet placed on
// instance A is invisible to instance B. Redis becomes the single source
// of truth for *round* state (who's in, who cashed out, what's the target),
// while wallet balances stay in Postgres/Supabase as they already do --
// Redis here is fast, ephemeral, per-round state, not money.
//
// All read-then-write decisions that matter for correctness (claiming a
// player slot, claiming a cashout) are done with Lua scripts so they're
// atomic even with many processes hitting Redis at once.
// ============================================================

const KEYS = {
  state: "crash:state",
  players: "crash:players",
  userToPlayer: "crash:u2p",
  autoCashouts: "crash:autocashouts",
  pendingBets: "crash:pendingBets",
  pendingCashouts: "crash:pendingCashouts",
  playerSeq: "crash:playerSeq",
  roundSeq: "crash:roundSeq",
  leaderLock: "crash:leaderLock",
} as const;

export type Phase = 0 | 1 | 2;

export interface StoredPlayer {
  playerId: number;
  userId: string;
  username: string;
  betAmount: number;
  payout: number | null;
}

export interface StateSnapshot {
  phase: Phase;
  roundNumber: number;
  roundId: string | null;
  gameStartTime: number | null;
  crashPoint: number;
}

// ============================================================
// LUA SCRIPTS
// ============================================================
// Loaded once; ioredis-compatible `.eval` is used directly so this file
// doesn't depend on which redis client wrapper is used.

// Atomically: verify phase is still "betting" and the user has no existing
// bet this round, then mint a playerId and store the player + optional
// auto-cashout target. Returns the new playerId, or a string error code.
const CLAIM_BET_SCRIPT = `
local u2p = KEYS[1]
local players = KEYS[2]
local autoCashouts = KEYS[3]
local stateKey = KEYS[4]
local playerSeq = KEYS[5]

local userId = ARGV[1]
local username = ARGV[2]
local betAmount = ARGV[3]
local autoCashoutAt = ARGV[4] -- '' if none

local phase = redis.call('HGET', stateKey, 'phase')
if phase ~= '0' then
  return 'PHASE_CLOSED'
end

if redis.call('HEXISTS', u2p, userId) == 1 then
  return 'ALREADY_BET'
end

local playerId = redis.call('INCR', playerSeq)

redis.call('HSET', u2p, userId, playerId)
redis.call('HSET', players, playerId,
  cjson.encode({
    playerId = playerId,
    userId = userId,
    username = username,
    betAmount = tonumber(betAmount),
    payout = -1 -- sentinel for null, cjson has no reliable null round-trip via HSET
  })
)

if autoCashoutAt ~= '' then
  redis.call('ZADD', autoCashouts, tonumber(autoCashoutAt), playerId)
end

return tostring(playerId)
`;

// Atomically: verify the player exists, hasn't cashed out, and isn't already
// mid-cashout, then mark it pending and drop any auto-cashout order.
// Returns "betAmount" as a string, or an error code.
const CLAIM_CASHOUT_SCRIPT = `
local u2p = KEYS[1]
local players = KEYS[2]
local autoCashouts = KEYS[3]
local pendingCashouts = KEYS[4]

local userId = ARGV[1]

local playerId = redis.call('HGET', u2p, userId)
if not playerId then
  return 'NO_BET'
end

local raw = redis.call('HGET', players, playerId)
if not raw then
  return 'NO_BET'
end

local player = cjson.decode(raw)
if player.payout ~= -1 then
  return 'ALREADY_CASHED'
end

if redis.call('SISMEMBER', pendingCashouts, userId) == 1 then
  return 'PENDING'
end

redis.call('SADD', pendingCashouts, userId)
redis.call('ZREM', autoCashouts, playerId)

return playerId .. ':' .. tostring(player.betAmount)
`;

// Atomically record the final payout multiplier on a player and release the
// pending lock. Idempotent-ish: no-ops if already set.
const FINALIZE_CASHOUT_SCRIPT = `
local players = KEYS[1]
local pendingCashouts = KEYS[2]

local playerId = ARGV[1]
local userId = ARGV[2]
local multiplier = ARGV[3]

local raw = redis.call('HGET', players, playerId)
if raw then
  local player = cjson.decode(raw)
  player.payout = tonumber(multiplier)
  redis.call('HSET', players, playerId, cjson.encode(player))
end

redis.call('SREM', pendingCashouts, userId)
return 1
`;

// Pop (read + remove) every auto-cashout order whose target has been reached.
const POP_DUE_AUTOCASHOUTS_SCRIPT = `
local autoCashouts = KEYS[1]
local currentMultiplier = ARGV[1]

local ids = redis.call('ZRANGEBYSCORE', autoCashouts, '-inf', currentMultiplier)
if #ids > 0 then
  redis.call('ZREM', autoCashouts, unpack(ids))
end
return ids
`;

async function evalScript(
  script: string,
  keys: string[],
  args: (string | number)[],
) {
  return redis.eval(script, keys.length, ...keys, ...args.map(String));
}

// ============================================================
// ROUND LIFECYCLE
// ============================================================

export async function resetRound(
  crashPoint: number,
): Promise<{ roundNumber: number; roundId: string }> {
  const roundNumber = await redis.incr(KEYS.roundSeq);
  const roundId = `crash_${Date.now()}`;

  const pipeline = redis.pipeline();
  pipeline.del(
    KEYS.players,
    KEYS.userToPlayer,
    KEYS.autoCashouts,
    KEYS.pendingBets,
    KEYS.pendingCashouts,
  );
  pipeline.set(KEYS.playerSeq, "0");
  pipeline.hset(KEYS.state, {
    phase: "0",
    roundNumber: String(roundNumber),
    roundId,
    gameStartTime: "",
    crashPoint: String(crashPoint),
  });
  await pipeline.exec();

  return { roundNumber, roundId };
}

export async function setPhaseRunning(gameStartTime: number): Promise<void> {
  await redis.hset(KEYS.state, {
    phase: "1",
    gameStartTime: String(gameStartTime),
  });
}

export async function setPhaseCrashed(): Promise<void> {
  await redis.hset(KEYS.state, { phase: "2" });
}

export async function getState(): Promise<StateSnapshot> {
  const raw = await redis.hgetall(KEYS.state);

  return {
    phase: (Number(raw.phase ?? 0) as Phase) || 0,
    roundNumber: Number(raw.roundNumber ?? 0),
    roundId: raw.roundId || null,
    gameStartTime: raw.gameStartTime ? Number(raw.gameStartTime) : null,
    crashPoint: Number(raw.crashPoint ?? 1.01),
  };
}

// ============================================================
// BETS
// ============================================================

export async function claimBet(params: {
  userId: string;
  username: string;
  betAmount: number;
  autoCashoutAt: number | null;
}): Promise<
  | { ok: true; playerId: number }
  | { ok: false; error: "PHASE_CLOSED" | "ALREADY_BET" }
> {
  const result = (await evalScript(
    CLAIM_BET_SCRIPT,
    [
      KEYS.userToPlayer,
      KEYS.players,
      KEYS.autoCashouts,
      KEYS.state,
      KEYS.playerSeq,
    ],
    [
      params.userId,
      params.username,
      params.betAmount,
      params.autoCashoutAt ?? "",
    ],
  )) as string;

  if (result === "PHASE_CLOSED" || result === "ALREADY_BET") {
    return { ok: false, error: result };
  }

  return { ok: true, playerId: Number(result) };
}

// Simple per-instance-visible dedupe guard for requests currently in flight
// (wallet lock call is async I/O, so two rapid clicks could race before the
// Lua claim above even runs). Backed by Redis SET NX so it works cluster-wide.
export async function tryLockPendingBet(userId: string): Promise<boolean> {
  const result = await redis.set(
    `${KEYS.pendingBets}:${userId}`,
    "1",
    "PX",
    5000,
    "NX",
  );
  return result === "OK";
}

export async function unlockPendingBet(userId: string): Promise<void> {
  await redis.del(`${KEYS.pendingBets}:${userId}`);
}

// ============================================================
// CASHOUTS
// ============================================================

export async function claimCashout(
  userId: string,
): Promise<
  | { ok: true; playerId: number; betAmount: number }
  | { ok: false; error: "NO_BET" | "ALREADY_CASHED" | "PENDING" }
> {
  const result = (await evalScript(
    CLAIM_CASHOUT_SCRIPT,
    [KEYS.userToPlayer, KEYS.players, KEYS.autoCashouts, KEYS.pendingCashouts],
    [userId],
  )) as string;

  if (
    result === "NO_BET" ||
    result === "ALREADY_CASHED" ||
    result === "PENDING"
  ) {
    return { ok: false, error: result };
  }

  const [playerId, betAmount] = result.split(":");
  return { ok: true, playerId: Number(playerId), betAmount: Number(betAmount) };
}

export async function finalizeCashout(
  playerId: number,
  userId: string,
  multiplier: number,
): Promise<void> {
  await evalScript(
    FINALIZE_CASHOUT_SCRIPT,
    [KEYS.players, KEYS.pendingCashouts],
    [playerId, userId, multiplier],
  );
}

export async function releaseCashoutLock(userId: string): Promise<void> {
  await redis.srem(KEYS.pendingCashouts, userId);
}

export async function popDueAutoCashouts(
  currentMultiplier: number,
): Promise<number[]> {
  const ids = (await evalScript(
    POP_DUE_AUTOCASHOUTS_SCRIPT,
    [KEYS.autoCashouts],
    [currentMultiplier],
  )) as string[];
  return ids.map(Number);
}

// ============================================================
// PLAYERS
// ============================================================

export async function getPlayer(
  playerId: number,
): Promise<StoredPlayer | null> {
  const raw = await redis.hget(KEYS.players, String(playerId));
  if (!raw) return null;

  const parsed = JSON.parse(raw);
  return { ...parsed, payout: parsed.payout === -1 ? null : parsed.payout };
}

// Used once, at crash time, to settle every losing bet. HSCAN in batches
// instead of HGETALL so a 10k-player round never blocks Redis with one huge
// reply -- this streams ~500 entries at a time.
export async function* iterateAllPlayers(): AsyncGenerator<StoredPlayer> {
  let cursor = "0";
  do {
    const [nextCursor, entries] = (await redis.hscan(
      KEYS.players,
      cursor,
      "COUNT",
      500,
    )) as [string, string[]];
    cursor = nextCursor;

    for (let i = 1; i < entries.length; i += 2) {
      const parsed = JSON.parse(entries[i]);
      yield { ...parsed, payout: parsed.payout === -1 ? null : parsed.payout };
    }
  } while (cursor !== "0");
}

// ============================================================
// LEADER ELECTION
// ============================================================
// Only ONE process should run the round timer (openBetting -> runRound ->
// tick loop). Every process can still register sockets and handle bets /
// cashouts, since those are now stateless (all state lives in Redis).

export async function tryAcquireLeadership(
  instanceId: string,
  ttlMs: number,
): Promise<boolean> {
  const result = await redis.set(
    KEYS.leaderLock,
    instanceId,
    "PX",
    ttlMs,
    "NX",
  );
  return result === "OK";
}

// Extend the lease, but only if we still hold it (compare-and-set via Lua
// so a stale/slow instance can't accidentally renew after losing leadership).
const RENEW_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`;

export async function renewLeadership(
  instanceId: string,
  ttlMs: number,
): Promise<boolean> {
  const result = await evalScript(
    RENEW_LOCK_SCRIPT,
    [KEYS.leaderLock],
    [instanceId, ttlMs],
  );
  return result === 1;
}

export async function releaseLeadership(instanceId: string): Promise<void> {
  const RELEASE_SCRIPT = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    end
    return 0
  `;
  await evalScript(RELEASE_SCRIPT, [KEYS.leaderLock], [instanceId]);
}

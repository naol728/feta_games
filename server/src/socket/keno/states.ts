/* eslint-disable */

import { redis } from "../../config/radis";

// ============================================================
// WHY THIS NEEDS SHARED STATE (UNLIKE SLOTS)
// ============================================================
// Keno is a shared-round game like crash: everyone who bets during one
// betting window is playing against the SAME draw of 10 numbers out of
// 40. That draw, and the countdown clock around it, has to be identical
// for every connected client regardless of which server process they're
// attached to -- so round state lives in Redis, and only one process
// (the "leader") drives the round clock. Every process can still accept
// bets, since a bet is just an atomic write into that shared state.
// ============================================================

const KEYS = {
  state: "keno:state",
  entries: "keno:entries",
  roundSeq: "keno:roundSeq",
  leaderLock: "keno:leaderLock",
} as const;

export type Phase = 0 | 1 | 2; // 0 betting, 1 drawing, 2 result

export interface KenoEntry {
  userId: string;
  numbers: number[];
  amount: number;
}

export interface StateSnapshot {
  phase: Phase;
  roundNumber: number;
  roundId: string | null;
  phaseEndsAt: number | null;
  drawn: number[];
}

const CLAIM_BET_SCRIPT = `
local stateKey = KEYS[1]
local entries = KEYS[2]

local userId = ARGV[1]
local entryJson = ARGV[2]

local phase = redis.call('HGET', stateKey, 'phase')
if phase ~= '0' then
  return 'PHASE_CLOSED'
end

local set = redis.call('HSETNX', entries, userId, entryJson)
if set == 0 then
  return 'ALREADY_BET'
end

return 'OK'
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

export async function resetRound(): Promise<{
  roundNumber: number;
  roundId: string;
}> {
  const roundNumber = await redis.incr(KEYS.roundSeq);
  const roundId = `keno_${Date.now()}`;

  const pipeline = redis.pipeline();
  pipeline.del(KEYS.entries);
  pipeline.hset(KEYS.state, {
    phase: "0",
    roundNumber: String(roundNumber),
    roundId,
    phaseEndsAt: "",
    drawn: "[]",
  });
  await pipeline.exec();

  return { roundNumber, roundId };
}

export async function setPhase(
  phase: Phase,
  phaseEndsAt: number,
): Promise<void> {
  await redis.hset(KEYS.state, {
    phase: String(phase),
    phaseEndsAt: String(phaseEndsAt),
  });
}

export async function setDrawn(drawn: number[]): Promise<void> {
  await redis.hset(KEYS.state, { drawn: JSON.stringify(drawn) });
}

export async function getState(): Promise<StateSnapshot> {
  const raw = await redis.hgetall(KEYS.state);

  return {
    phase: (Number(raw.phase ?? 0) as Phase) || 0,
    roundNumber: Number(raw.roundNumber ?? 0),
    roundId: raw.roundId || null,
    phaseEndsAt: raw.phaseEndsAt ? Number(raw.phaseEndsAt) : null,
    drawn: raw.drawn ? JSON.parse(raw.drawn) : [],
  };
}

// ============================================================
// BETS
// ============================================================

export async function claimBet(
  entry: KenoEntry,
): Promise<
  { ok: true } | { ok: false; error: "PHASE_CLOSED" | "ALREADY_BET" }
> {
  const result = (await evalScript(
    CLAIM_BET_SCRIPT,
    [KEYS.state, KEYS.entries],
    [entry.userId, JSON.stringify(entry)],
  )) as string;

  if (result === "PHASE_CLOSED" || result === "ALREADY_BET") {
    return { ok: false, error: result };
  }

  return { ok: true };
}

export async function getEntry(userId: string): Promise<KenoEntry | null> {
  const raw = await redis.hget(KEYS.entries, userId);
  return raw ? JSON.parse(raw) : null;
}

// Streamed in pages of 500 so a 10k-entry round never sends one giant
// reply to Redis (same reasoning as crash's iterateAllPlayers).
export async function* iterateAllEntries(): AsyncGenerator<KenoEntry> {
  let cursor = "0";
  do {
    const [nextCursor, entries] = (await redis.hscan(
      KEYS.entries,
      cursor,
      "COUNT",
      500,
    )) as [string, string[]];
    cursor = nextCursor;

    for (let i = 1; i < entries.length; i += 2) {
      yield JSON.parse(entries[i]);
    }
  } while (cursor !== "0");
}

// ============================================================
// LEADER ELECTION (same mechanism as crash, separate lock key --
// a process can independently be the crash leader, the keno leader,
// both, or neither)
// ============================================================

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

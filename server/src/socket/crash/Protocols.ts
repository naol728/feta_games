/* eslint-disable */

// ============================================================
// BINARY PROTOCOL v2
// ============================================================
//
// byte 0 = message type
//
// 1 = SYNC              14 bytes  (unchanged)
// 2 = ROUND_START        13 bytes  (unchanged)
// 3 = BET_BATCH          3 + 8*n bytes   <-- was 9 bytes PER bet, now batched
// 4 = CASHOUT_BATCH      3 + 10*n bytes  <-- was 11 bytes PER cashout, now batched
// 5 = CRASH               3 bytes  (unchanged)
// 6 = MULTIPLIER_TICK     3 bytes  <-- was a raw JS number over socket.io (JSON
//                                      encoded, ~20+ bytes with envelope, and a
//                                      full V8->JSON->string round trip per tick
//                                      per socket). Now a fixed 3-byte frame.
//
// Why batching matters at 10k concurrent users:
// If 3,000 people bet inside the same 12s betting window, the old protocol
// emitted 3,000 separate "crash:bet" frames to every one of the 10,000
// connected sockets = 30,000,000 writes for one round. Batching bets/cashouts
// that land inside the same ~150ms tick window into ONE frame turns that into
// (bettingMs / batchIntervalMs) frames, ~80 frames per round regardless of
// how many people bet, each one write per socket instead of one per bet.
//
// Amounts: ETB * 100 (cents) as uint32 (max ~42.9M ETB, fine for this range,
// validated at the 1,000,000 ETB bet cap anyway).
// Multipliers: x100 as uint16 (max 655.35x) -- our crash point is capped at
// 1000x, so encode clamps to avoid wraparound instead of silently corrupting.
// ============================================================

export const PACKET = {
  SYNC: 1,
  ROUND_START: 2,
  BET_BATCH: 3,
  CASHOUT_BATCH: 4,
  CRASH: 5,
  MULTIPLIER_TICK: 6,
} as const;

const MAX_U16 = 65535; // 655.35x

export const encodeAmount = (amount: number): number =>
  Math.round(amount * 100);
export const decodeAmount = (value: number): number => value / 100;

export const encodeMultiplier = (multiplier: number): number =>
  Math.min(Math.round(multiplier * 100), MAX_U16);
export const decodeMultiplier = (value: number): number => value / 100;

export interface GameStateSnapshot {
  phase: 0 | 1 | 2;
  roundNumber: number;
  gameStartTime: number | null;
}

export function encodeSync(state: GameStateSnapshot): Buffer {
  const buffer = Buffer.allocUnsafe(14);

  buffer.writeUInt8(PACKET.SYNC, 0);
  buffer.writeUInt8(state.phase, 1);
  buffer.writeUInt32LE(state.roundNumber >>> 0, 2);
  buffer.writeDoubleLE(state.gameStartTime ?? 0, 6);

  return buffer;
}

export function encodeRoundStart(
  roundNumber: number,
  startTime: number,
): Buffer {
  const buffer = Buffer.allocUnsafe(13);

  buffer.writeUInt8(PACKET.ROUND_START, 0);
  buffer.writeUInt32LE(roundNumber >>> 0, 1);
  buffer.writeDoubleLE(startTime, 5);

  return buffer;
}

export interface BetBatchEntry {
  playerId: number;
  amount: number;
}

export function encodeBetBatch(entries: BetBatchEntry[]): Buffer {
  const buffer = Buffer.allocUnsafe(3 + entries.length * 8);

  buffer.writeUInt8(PACKET.BET_BATCH, 0);
  buffer.writeUInt16LE(entries.length, 1);

  let offset = 3;
  for (const entry of entries) {
    buffer.writeUInt32LE(entry.playerId >>> 0, offset);
    buffer.writeUInt32LE(encodeAmount(entry.amount), offset + 4);
    offset += 8;
  }

  return buffer;
}

export interface CashoutBatchEntry {
  playerId: number;
  multiplier: number;
  payout: number;
}

export function encodeCashoutBatch(entries: CashoutBatchEntry[]): Buffer {
  const buffer = Buffer.allocUnsafe(3 + entries.length * 10);

  buffer.writeUInt8(PACKET.CASHOUT_BATCH, 0);
  buffer.writeUInt16LE(entries.length, 1);

  let offset = 3;
  for (const entry of entries) {
    buffer.writeUInt32LE(entry.playerId >>> 0, offset);
    buffer.writeUInt16LE(encodeMultiplier(entry.multiplier), offset + 4);
    buffer.writeUInt32LE(encodeAmount(entry.payout), offset + 6);
    offset += 10;
  }

  return buffer;
}

export function encodeCrash(crashPoint: number): Buffer {
  const buffer = Buffer.allocUnsafe(3);

  buffer.writeUInt8(PACKET.CRASH, 0);
  buffer.writeUInt16LE(encodeMultiplier(crashPoint), 1);

  return buffer;
}

export function encodeMultiplierTick(multiplier: number): Buffer {
  const buffer = Buffer.allocUnsafe(3);

  buffer.writeUInt8(PACKET.MULTIPLIER_TICK, 0);
  buffer.writeUInt16LE(encodeMultiplier(multiplier), 1);

  return buffer;
}

/*eslint-disable*/
import {
  PACKET,
  type BetBatchEntry,
  type CashoutBatchEntry,
  type DecodedRoundStart,
  type DecodedSync,
} from "../types/crash";

function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  return null;
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** byte0=type, byte1=phase, bytes2-5=round, bytes6-13=timestamp (14 bytes) */
export function decodeSync(data: unknown): DecodedSync | null {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength < 14) return null;

  const view = viewOf(bytes);
  if (view.getUint8(0) !== PACKET.SYNC) return null;

  const phaseCode = view.getUint8(1);
  const phase =
    phaseCode === 0 ? "betting" : phaseCode === 1 ? "running" : "crashed";
  const timestamp = view.getFloat64(6, true);

  return {
    phase,
    roundNumber: view.getUint32(2, true),
    gameStartTime: timestamp > 0 ? timestamp : null,
  };
}

/** byte0=type, bytes1-4=round, bytes5-12=timestamp (13 bytes) */
export function decodeRoundStart(data: unknown): DecodedRoundStart | null {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength < 13) return null;

  const view = viewOf(bytes);
  if (view.getUint8(0) !== PACKET.ROUND_START) return null;

  return {
    roundNumber: view.getUint32(1, true),
    gameStartTime: view.getFloat64(5, true),
  };
}

/** byte0=type, bytes1-2=count(u16), then 8 bytes/entry: playerId(u32) + amountCents(u32) */
export function decodeBetBatch(data: unknown): BetBatchEntry[] | null {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength < 3) return null;

  const view = viewOf(bytes);
  if (view.getUint8(0) !== PACKET.BET_BATCH) return null;

  const count = view.getUint16(1, true);
  const entries: BetBatchEntry[] = new Array(count);
  let offset = 3;
  let written = 0;

  for (let i = 0; i < count; i++) {
    if (offset + 8 > bytes.byteLength) break;
    entries[written++] = {
      playerId: view.getUint32(offset, true),
      amount: view.getUint32(offset + 4, true) / 100,
    };
    offset += 8;
  }

  entries.length = written;
  return entries;
}

/** byte0=type, bytes1-2=count(u16), then 10 bytes/entry: playerId(u32)+mult(u16)+payoutCents(u32) */
export function decodeCashoutBatch(data: unknown): CashoutBatchEntry[] | null {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength < 3) return null;

  const view = viewOf(bytes);
  if (view.getUint8(0) !== PACKET.CASHOUT_BATCH) return null;

  const count = view.getUint16(1, true);
  const entries: CashoutBatchEntry[] = new Array(count);
  let offset = 3;
  let written = 0;

  for (let i = 0; i < count; i++) {
    if (offset + 10 > bytes.byteLength) break;
    entries[written++] = {
      playerId: view.getUint32(offset, true),
      multiplier: view.getUint16(offset + 4, true) / 100,
      payout: view.getUint32(offset + 6, true) / 100,
    };
    offset += 10;
  }

  entries.length = written;
  return entries;
}

/** byte0=type, bytes1-2=multiplier*100 (3 bytes) */
export function decodeCrash(data: unknown): number | null {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength < 3) return null;
  const view = viewOf(bytes);
  if (view.getUint8(0) !== PACKET.CRASH) return null;
  return view.getUint16(1, true) / 100;
}

/** byte0=type, bytes1-2=multiplier*100 (3 bytes) */
export function decodeMultiplierTick(data: unknown): number | null {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength < 3) return null;
  const view = viewOf(bytes);
  if (view.getUint8(0) !== PACKET.MULTIPLIER_TICK) return null;
  return view.getUint16(1, true) / 100;
}

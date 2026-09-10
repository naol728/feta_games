// types/crash.ts

export interface Wallet {
  balance: number;
  locked_balance: number;
  withdrawable_balance: number;
  available_balance: number;
}

export type GamePhase = "betting" | "running" | "crashed";

export interface CrashPlayer {
  playerId: number;
  userId: string;
  username: string;
  payout: number | null;
  betAmount: number;
}

export interface GameHistoryEntry {
  crashPoint: number;
}

export interface CrashGameState {
  players: Record<number, CrashPlayer>;
  userToPlayer: Record<string, number>;
  gameStartTime: number | null;
  crashPoint: number | null;
  roundNumber: number;
  phase: GamePhase;
}

export interface BetPayload {
  amount: number;
  autoCashoutAt: number | null;
}

export interface CrashBetResult {
  ok?: boolean;
  roundId?: string | null;
  playerId?: number;
  wallet?: Wallet;
  error?: string;
}

export interface CrashCashoutResult {
  ok?: boolean;
  multiplier?: number;
  wallet?: Wallet;
  payout?: number;
  error?: string;
}

// ----- Typed socket event map -----
// Wire up your socket.io client generics as:
//   Socket<ServerToClientEvents, ClientToServerEvents>
export interface ServerToClientEvents {
  "crash:sync": (data: ArrayBuffer | Uint8Array) => void;
  "crash:start": (data: ArrayBuffer | Uint8Array) => void;
  "crash:bets": (data: ArrayBuffer | Uint8Array) => void;
  "crash:cashouts": (data: ArrayBuffer | Uint8Array) => void;
  "crash:crash": (data: ArrayBuffer | Uint8Array) => void;
  "crash:multiplier": (data: ArrayBuffer | Uint8Array) => void;
  "crash:wallet": (wallet: Wallet) => void;
}

export interface ClientToServerEvents {
  "crash:requestState": () => void;
  "crash:bet": (
    payload: BetPayload,
    callback: (result: CrashBetResult) => void,
  ) => void;
  "crash:cashout": (callback: (result: CrashCashoutResult) => void) => void;
}

// ----- Binary packet types (mirror backend/crash/protocol.ts) -----
export const PACKET = {
  SYNC: 1,
  ROUND_START: 2,
  BET_BATCH: 3,
  CASHOUT_BATCH: 4,
  CRASH: 5,
  MULTIPLIER_TICK: 6,
} as const;

export type PacketType = (typeof PACKET)[keyof typeof PACKET];

export interface DecodedSync {
  phase: GamePhase;
  roundNumber: number;
  gameStartTime: number | null;
}

export interface DecodedRoundStart {
  roundNumber: number;
  gameStartTime: number;
}

export interface BetBatchEntry {
  playerId: number;
  amount: number;
}

export interface CashoutBatchEntry {
  playerId: number;
  multiplier: number;
  payout: number;
}

// ----- Action state (discriminated union — no more string-key lookups) -----
export type ActionVariant = "bet" | "cashout" | "queued" | "disabled";

export interface ActionState {
  type: ActionVariant;
  disabled: boolean;
  title: string;
  subtitle: string;
}

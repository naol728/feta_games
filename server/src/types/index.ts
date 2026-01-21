export interface User {
  id: string;
  username: string;
  score: number;
  socket: any; // Socket type from socket.io
}

export interface Player {
  id: string;
  symbol: 'X' | 'O';
}

export interface Game {
  id: string;
  players: Player[];
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  status: 'waiting' | 'active' | 'finished';
  moves: Move[];
  createdAt: Date;
  rematchRequests?: string[];
}

export interface Move {
  player: string;
  cellIndex: number;
  symbol: 'X' | 'O';
}

export interface GameData {
  id: string;
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  players: PlayerInfo[];
}

export interface PlayerInfo {
  id: string;
  username?: string;
  symbol: 'X' | 'O';
  score?: number;
}

export interface GameUpdateData {
  gameId: string;
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  winner: string | null;
  players: PlayerInfo[];
}

export interface SocketData {
  userId?: string;
  username?: string;
}

export interface InviteData {
  from: string;
  fromUsername: string;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  id: string;
}
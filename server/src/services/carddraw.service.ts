import { Server, Socket } from "socket.io";
import { redis } from "../config/radis";
import { walletService } from "./wallet.service";

function shuffleDeck() {
  const values: (number | string)[] = [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    "J",
    "Q",
    "K",
  ];
  const deck = values.map((v) => ({ value: v, revealed: false }));

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
type QueueEntry = {
  playerId: string;
  socketId: string;
  queueId: string;
};
interface JwtPayload {
  userId: string;
  telegramId: number;
}
interface CustomSocket extends Socket {
  user: JwtPayload;
  queueKey?: string | null;
  queueEntry?: string | null;
  roomId?: string;
}
export async function createMatch(
  io: Server,
  socket: CustomSocket,
  opponent: QueueEntry,
  playerId: string,
  bet: number,
) {
  const roomId = `cd_${Date.now()}`;

  const opponentSocket = io.sockets.sockets.get(opponent.socketId);
  if (!opponentSocket) {
    socket.emit("error", "Opponent disconnected");
    return;
  }

  const ok1 = await walletService.lockandchcekBalance(playerId, bet);
  const ok2 = await walletService.lockandchcekBalance(opponent.playerId, bet);

  if (!ok1 || !ok2) {
    if (ok1) await walletService.unlockBalance(playerId);
    if (ok2) await walletService.unlockBalance(opponent.playerId);

    socket.emit("error", "Insufficient balance");
    opponentSocket.emit("error", "Opponent insufficient balance");

    return;
  }

  const match = {
    matchId: roomId,
    players: [
      {
        id: opponent.playerId,
        socketId: opponent.socketId,
        picks: [],
        total: 0,
      },
      {
        id: playerId,
        socketId: socket.id,
        picks: [],
        total: 0,
      },
    ],
    betAmount: bet,
    status: "playing",
    winner: null,
    deck: shuffleDeck(),
    pickedIndices: [],
    turn: playerId,
    round: 1,
    maxRounds: 6,
    resolved: false,
  };

  await redis.set(`room:carddraw:${roomId}`, JSON.stringify(match));

  socket.join(roomId);
  socket.roomId = roomId;

  opponentSocket.join(roomId);
  (opponentSocket as CustomSocket).roomId = roomId;

  io.to(opponent.socketId).emit("carddraw:matched", { roomId });
  socket.emit("carddraw:matched", { roomId });

  io.emit("carddraw:queue:update");
}

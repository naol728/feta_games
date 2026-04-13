import { Server, Socket } from "socket.io";
import { redis } from "../config/radis";
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
export function createMatch(
  io: Server,
  socket: CustomSocket,
  opponent: QueueEntry,
  playerId: string,
  bet: number,
) {
  const roomId = `cd_${Date.now()}`;

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
    maxRounds: 3,
  };

  redis.set(`room:carddraw:${roomId}`, JSON.stringify(match));
  socket.join(roomId);
  socket.roomId = roomId;

  const opponentSocket = io.sockets.sockets.get(opponent.socketId);
  if (opponentSocket) {
    opponentSocket.join(roomId);
    (opponentSocket as CustomSocket).roomId = roomId;
  }

  io.to(opponent.socketId).emit("carddraw:matched", { roomId });
  socket.emit("carddraw:matched", { roomId });

  io.emit("carddraw:queue:update");
}

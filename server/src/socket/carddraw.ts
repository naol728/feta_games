import { Server, Socket } from "socket.io";
import { redis } from "../config/radis";

const QUEUE_KEY = (bet: number) => `queue:carddraw:${bet}`;

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
};
interface CustomSocket extends Socket {
  playerId?: string;
  queueKey?: string | null;
  queueEntry?: string | null;
  roomId?: string;
}
export default function CardDrawSocket(io: Server, socket: CustomSocket) {
  socket.on(
    "carddraw:queue",
    async (data: { playerId: string; bet: number }) => {
      const { playerId, bet } = data;
      const allowedBets = [10, 50, 100];

      if (!allowedBets.includes(bet)) {
        socket.emit("error", "Invalid bet amount");
        return;
      }

      const queueKey = QUEUE_KEY(bet);

      // remove old entry
      if (socket.queueKey && socket.queueEntry) {
        await redis.lrem(socket.queueKey, 1, socket.queueEntry);
      }

      const entry: string = JSON.stringify({
        playerId,
        socketId: socket.id,
      });

      socket.queueKey = queueKey;
      socket.queueEntry = entry;
      // safe matchmaking
      let opponentData: QueueEntry | null = null;

      while (true) {
        const opponent = await redis.rpop(queueKey);
        if (!opponent) break;

        const parsed: QueueEntry = JSON.parse(opponent);
        const isAlive = io.sockets.sockets.get(parsed.socketId);

        if (isAlive) {
          opponentData = parsed;
          break;
        }
      }
      if (!opponentData) {
        await redis.lpush(queueKey, entry);
        socket.emit("carddraw:waiting");
        return;
      }
      socket.queueKey = null;
      socket.queueEntry = null;

      const roomId = `cd_${Date.now()}`;
      const match = {
        matchId: roomId,
        players: [
          { id: opponentData.playerId, socketId: opponentData.socketId },
          { id: playerId, socketId: socket.id },
        ],
        betAmount: bet,
        status: "playing",
        winner: null,
        deck: shuffleDeck(),
      };
      await redis.set(`room:carddraw:${roomId}`, JSON.stringify(match));
      io.to(opponentData.socketId).emit("carddraw:matched", { roomId });
      io.to(socket.id).emit("carddraw:matched", { roomId });
    },
  );

  socket.on("carddraw:join", async ({ roomId }: { roomId: string }) => {
    const roomRaw = await redis.get(`room:carddraw:${roomId}`);
    if (!roomRaw) {
      socket.emit("carddraw:not_found");
      return;
    }
    const room = JSON.parse(roomRaw);

    socket.join(roomId);
    socket.roomId = roomId;

    socket.emit("carddraw:start", room);
  });
}

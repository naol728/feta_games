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
          {
            id: opponentData.playerId,
            socketId: opponentData.socketId,
            picks: [], // cards picked across rounds
            total: 0, // accumulated score
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

        turn: playerId, // whose turn
        round: 1,
        maxRounds: 3, // configurable
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
  socket.on("carddraw:card-pick", async (data) => {
    const {
      roomId,
      cardindex,
      playerId,
    }: { roomId: string; cardindex: number; playerId: string } = data;

    const key = `room:carddraw:${roomId}`;
    const raw = await redis.get(key);
    if (!raw) return;

    const match = JSON.parse(raw);

    // ❌ invalid state
    if (match.status !== "playing") return;

    // ❌ not player's turn
    if (match.turn !== playerId) return;

    // ❌ already picked card
    if (match.pickedIndices.includes(cardindex)) return;

    const player = match.players.find((p) => p.id === playerId);
    const opponent = match.players.find((p) => p.id !== playerId);
    if (!player || !opponent) return;

    const card = match.deck[cardindex];
    if (!card) return;

    // ✅ assign card
    player.picks.push(card);

    // convert value
    let value = card.value;
    if (value === "J") value = 11;
    if (value === "Q") value = 12;
    if (value === "K") value = 13;

    player.total += value;

    // mark revealed
    match.deck[cardindex].revealed = true;
    match.pickedIndices.push(cardindex);

    // switch turn
    match.turn = opponent.id;

    // check round completion (2 picks = 1 round)
    const totalPicks =
      match.players[0].picks.length + match.players[1].picks.length;

    if (totalPicks % 2 === 0) {
      match.round += 1;
    }

    // check game end
    if (match.round > match.maxRounds) {
      const [p1, p2] = match.players;

      if (p1.total > p2.total) match.winner = p1.id;
      else if (p2.total > p1.total) match.winner = p2.id;
      else match.winner = Math.random() > 0.5 ? p1.id : p2.id;

      match.status = "finished";
    }

    // save back
    await redis.set(key, JSON.stringify(match));

    // 🔥 emit updates to room
    io.to(roomId).emit("carddraw:update", {
      match,
      lastPick: {
        playerId,
        cardindex,
        card,
      },
    });

    // 🔥 if finished → emit result
    if (match.status === "finished") {
      io.to(roomId).emit("carddraw:result", match);
    }
  });
}

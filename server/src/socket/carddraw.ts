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
  socket.on("carddraw:queue", async ({ playerId, bet }) => {
    console.log(playerId)
    const allowedBets = [10, 50, 100];
    if (!allowedBets.includes(bet)) {
      socket.emit("error", "Invalid bet amount");
      return;
    }

    const queueKey = QUEUE_KEY(bet);

    // remove old queue entry
    if (socket.queueKey && socket.queueEntry) {
      await redis.lrem(socket.queueKey, 1, socket.queueEntry);
    }

    const entry: QueueEntry = {
      playerId,
      socketId: socket.id,
    };

    socket.queueKey = queueKey;
    socket.queueEntry = JSON.stringify(entry);
    await redis.lpush(queueKey, JSON.stringify(entry));

    io.emit("carddraw:queue:update"); // 🔥 broadcast
    // 🔥 try get opponent
    let opponent: QueueEntry | null = null;

    const raw = await redis.rpop(queueKey);

    if (raw) {
      const parsed: QueueEntry = JSON.parse(raw);
      const isAlive = io.sockets.sockets.get(parsed.socketId);

      if (isAlive && parsed.playerId !== playerId) {
        opponent = parsed;
      }
    }

    // ❌ no opponent → queue
    if (!opponent) {
      await redis.lpush(queueKey, JSON.stringify(entry));
      socket.emit("carddraw:waiting", { bet });
      return;
    }

    // ✅ MATCH FOUND
    socket.queueKey = null;
    socket.queueEntry = null;

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

    await redis.set(`room:carddraw:${roomId}`, JSON.stringify(match));

    // 🔥 JOIN ROOM (IMPORTANT FIX)
    socket.join(roomId);
    io.sockets.sockets.get(opponent.socketId)?.join(roomId);

    // notify both
    io.to(opponent.socketId).emit("carddraw:matched", { roomId });
    socket.emit("carddraw:matched", { roomId });
    io.emit("carddraw:queue:update");
  });

  socket.on("carddraw:cancel", async () => {
    if (socket.queueKey && socket.queueEntry) {
      await redis.lrem(socket.queueKey, 1, socket.queueEntry);

      socket.queueKey = null;
      socket.queueEntry = null;

      socket.emit("carddraw:cancelled");

      io.emit("carddraw:queue:update");
    }
  });

  socket.on("disconnect", async () => {
    if (socket.queueKey && socket.queueEntry) {
      await redis.lrem(socket.queueKey, 1, socket.queueEntry);

      io.emit("carddraw:queue:update"); // 🔥 cleanup update
    }
  });
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
  const ALLOWED_BETS = [10, 50, 100];

  socket.on("carddraw:queue:list", async () => {
    const result = [];

    for (const bet of ALLOWED_BETS) {
      const queueKey = `queue:carddraw:${bet}`;

      const rawList = await redis.lrange(queueKey, 0, -1);

      const players = rawList
        .map((item) => {
          try {
            return JSON.parse(item);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      result.push({
        bet,
        players, // [{ playerId, socketId }]
        count: players.length,
      });
    }

    socket.emit("carddraw:queue:list", result);
  });
}

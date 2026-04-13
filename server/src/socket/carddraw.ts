import { Server, Socket } from "socket.io";
import { redis } from "../config/radis";
import { safeSocket } from "./safeSocket";
import { createMatch } from "./../services/carddraw.service";
import { SocketError } from "../utils/SocketError";
import { walletService } from "../services/wallet.service";

const QUEUE_KEY = (bet: number) => `queue:carddraw:${bet}`;

type QueueEntry = {
  playerId: string;
  socketId: string;
  queueId: string; // ✅ REQUIRED
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

const ALLOWED_BETS = [10, 50, 100];

export default function CardDrawSocket(io: Server, socket: CustomSocket) {
  socket.on(
    "carddraw:queue",
    safeSocket(socket, async ({ bet }: { bet: number }) => {
      const playerId = socket.user.userId;

      if (!ALLOWED_BETS.includes(bet)) {
        socket.emit("error", "Invalid bet ");
        return;
      }
      const ok = await walletService.lockandchcekBalance(playerId, bet);
      if (!ok) {
        socket.emit("error", "Inseficent Balance");
        return;
      }

      const queueKey = QUEUE_KEY(bet);

      if (socket.queueKey && socket.queueEntry) {
        await redis.lrem(socket.queueKey, 1, socket.queueEntry);
      }

      const entry: QueueEntry = {
        playerId,
        socketId: socket.id,
        queueId: `q_${Date.now()}_${Math.random()}`,
      };

      const entryStr = JSON.stringify(entry);

      let opponent: QueueEntry | null = null;
      let opponentRaw: string | null = null;

      while (true) {
        const raw = await redis.rpop(queueKey);
        if (!raw) break;

        const parsed: QueueEntry = JSON.parse(raw);
        const isAlive = io.sockets.sockets.get(parsed.socketId);

        if (!isAlive || parsed.playerId === playerId) continue;

        opponent = parsed;
        opponentRaw = raw;
        break;
      }

      // no opponent
      if (!opponent) {
        await redis.lpush(queueKey, entryStr);
        await redis.expire(queueKey, 60);

        socket.queueKey = queueKey;
        socket.queueEntry = entryStr;

        socket.emit("carddraw:waiting", { bet });
        io.emit("carddraw:queue:update");
        return;
      }

      socket.queueKey = null;
      socket.queueEntry = null;

      createMatch(io, socket, opponent, playerId, bet);
    }),
  );

  socket.on(
    "carddraw:queue:join",
    safeSocket(socket, async ({ queueId, bet }) => {
      const playerId = socket.user.userId;
      const ok = await walletService.lockandchcekBalance(
        socket.user.userId,
        bet,
      );

      if (!ok) {
        socket.emit("error", "Inseficent Balance");
        return;
      }
      const queueKey = QUEUE_KEY(bet);

      const rawList = await redis.lrange(queueKey, 0, -1);

      let target: QueueEntry | null = null;
      let targetRaw: string | null = null;

      for (const item of rawList) {
        const parsed: QueueEntry = JSON.parse(item);

        if (parsed.queueId === queueId) {
          target = parsed;
          targetRaw = item;
          break;
        }
      }

      if (!target || !targetRaw) {
        socket.emit("error", "Queue not found");
        return;
      }

      if (target.playerId === playerId) {
        socket.emit("error", "You can't join yourself");
        return;
      }

      const isAlive = io.sockets.sockets.get(target.socketId);
      if (!isAlive) {
        await redis.lrem(queueKey, 1, targetRaw);
        socket.emit("error", "Player offline");
        return;
      }

      // remove exact raw string ✅
      await redis.lrem(queueKey, 1, targetRaw);

      createMatch(io, socket, target, playerId, bet);
    }),
  );

  socket.on(
    "carddraw:cancel",
    safeSocket(socket, async () => {
      if (socket.queueKey && socket.queueEntry) {
        await redis.lrem(socket.queueKey, 1, socket.queueEntry);
        await walletService.unlockBalance(socket.user.userId);
        socket.queueKey = null;
        socket.queueEntry = null;

        socket.emit("carddraw:cancelled");
        io.emit("carddraw:queue:update");
      }
    }),
  );
  socket.on(
    "carddraw:join",
    safeSocket(socket, async ({ roomId }) => {
      try {
        const key = `room:carddraw:${roomId}`;
        const raw = await redis.get(key);

        if (!raw) {
          socket.emit("carddraw:not_found");
          return;
        }

        const match = JSON.parse(raw);

        socket.join(roomId);
        socket.roomId = roomId;

        // ✅ ALWAYS send current match state
        socket.emit("carddraw:start", match);
      } catch (err) {
        console.error("error:", err);
      }
    }),
  );

  socket.on(
    "carddraw:card-pick",
    safeSocket(socket, async (data) => {
      const { roomId, cardindex } = data;
      const playerId = socket.user.userId;

      const key = `room:carddraw:${roomId}`;
      const raw = await redis.get(key);
      if (!raw) return;

      const match = JSON.parse(raw);

      if (
        match.status !== "playing" ||
        match.turn !== playerId ||
        match.pickedIndices.includes(cardindex)
      )
        return;

      const player = match.players.find((p) => p.id === playerId);
      const opponent = match.players.find((p) => p.id !== playerId);
      if (!player || !opponent) return;

      const card = match.deck[cardindex];
      if (!card) return;

      player.picks.push(card);

      let value = card.value;
      if (value === "J") value = 11;
      if (value === "Q") value = 12;
      if (value === "K") value = 13;

      player.total += value;

      match.deck[cardindex].revealed = true;
      match.pickedIndices.push(cardindex);
      match.turn = opponent.id;

      const totalPicks =
        match.players[0].picks.length + match.players[1].picks.length;

      if (totalPicks % 2 === 0) match.round++;

      if (match.round > match.maxRounds) {
        const [p1, p2] = match.players;

        if (p1.total > p2.total) match.winner = p1.id;
        else if (p2.total > p1.total) match.winner = p2.id;
        else match.winner = Math.random() > 0.5 ? p1.id : p2.id;

        match.status = "finished";
      }

      await redis.set(key, JSON.stringify(match));

      io.to(roomId).emit("carddraw:update", {
        match,
        lastPick: { playerId, cardindex, card },
      });

      if (match.status === "finished") {
        const [p1, p2] = match.players;

        const winnerId = match.winner;
        const loserId = p1.id === winnerId ? p2.id : p1.id;

        const betAmount = match.betAmount;

        await walletService.resolveMatch(
          winnerId,
          loserId,
          betAmount,
          "carddraw",
        );

        io.to(roomId).emit("carddraw:result", match);

        await redis.expire(key, 30);
      }
    }),
  );

  socket.on(
    "carddraw:queue:list",
    safeSocket(socket, async () => {
      const result = [];

      for (const bet of ALLOWED_BETS) {
        const queueKey = QUEUE_KEY(bet);
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
          players,
          count: players.length,
        });
      }

      socket.emit("carddraw:queue:list", result);
    }),
  );

  socket.on(
    "disconnect",
    safeSocket(socket, async () => {
      if (socket.queueKey && socket.queueEntry) {
        await redis.lrem(socket.queueKey, 1, socket.queueEntry);
        io.emit("carddraw:queue:update");
      }

      if (socket.roomId) {
        const key = `room:carddraw:${socket.roomId}`;
        const raw = await redis.get(key);
        if (!raw) return;

        const match = JSON.parse(raw);
        if (match.status !== "playing") return;

        const opponent = match.players.find((p) => p.socketId !== socket.id);

        if (!opponent) return;

        match.status = "finished";
        match.winner = opponent.id;
        match.reason = "opponent_left";

        await redis.set(key, JSON.stringify(match));

        io.to(opponent.socketId).emit("carddraw:opponent-left");
        io.to(opponent.socketId).emit("carddraw:result", match);

        await redis.expire(key, 30);
      }
    }),
  );
}

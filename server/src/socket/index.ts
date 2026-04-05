import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { redis } from "../config/radis";
import { env } from "../config/env";
import connectFourSocket from "./connectfour.socket";
import CardDrawSocket from "./carddraw";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
  playerId?: string;
  queueKey?: string | null;
  queueEntry?: string | null;
  roomId?: string;
}

/* =========================
   INIT SOCKET
========================= */

export default function initSocket(io: Server) {
  // 🔐 AUTH MIDDLEWARE
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("Unauthorized"));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      (socket as CustomSocket).user = payload;
      (socket as CustomSocket).playerId = payload.userId;

      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  /* =========================
     CONNECTION
  ========================= */

  io.on("connection", async (socket: Socket) => {
    const s = socket as CustomSocket;

    console.log("user connected:", s.user.telegramId);

    await redis.set(`player:${s.user.telegramId}`, s.id);

    socket.on("disconnect", async () => {
      await redis.del(`player:${s.user.userId}`);
    });

    connectFourSocket(io, s);
    CardDrawSocket(io, s);
  });
}

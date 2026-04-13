import { Server, Socket } from "socket.io";
import { redis } from "../config/radis";
import connectFourSocket from "./connectfour.socket";
import CardDrawSocket from "./carddraw";
import { SocketError } from "../utils/SocketError";
import { verifyAccessToken } from "../services/token.service";
import { safeConnection } from "./safeConnection";

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

export default function initSocket(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new SocketError("Unauthorized", "NO_TOKEN", 401));
      }

      const payload = verifyAccessToken(token);

      (socket as CustomSocket).user = payload;
      (socket as CustomSocket).playerId = payload.userId;

      next();
    } catch (err) {
      next(new SocketError("Invalid token", "INVALID_TOKEN", 401));
    }
  });

  io.on(
    "connection",
    safeConnection(async (socket: Socket) => {
      const s = socket as CustomSocket;
      console.log("user connected:", s.user.userId);
      await redis.set(`player:${s.user.userId}`, s.id);
      socket.on("disconnect", async () => {
        try {
          await redis.del(`player:${s.user.telegramId}`);
        } catch (err) {
          console.error("Redis cleanup failed:", err);
        }
      });

      connectFourSocket(io, s);
      CardDrawSocket(io, s);
    }),
  );
}

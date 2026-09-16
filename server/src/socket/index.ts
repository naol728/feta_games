import { Server, Socket } from "socket.io";
import { redis } from "../config/radis";
import connectFourSocket from "./connectfour.socket";
import CardDrawSocket from "./carddraw";
import { SocketError } from "../utils/SocketError";
import { verifyAccessToken } from "../services/token.service";
import { safeConnection } from "./safeConnection";
import Crash from "./crash/crash";
import Slots from "./slot/Slot.socket";
import Keno from "./keno/keno";
import Mines from "./mines/mines";
import Plinko from "./plinko/plinko";

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

type GameRegistrar = (io: Server, socket: CustomSocket) => void;

// Table-driven: adding a new game is a one-line addition here instead of
// touching the connection handler itself.
const GAME_REGISTRARS: { name: string; register: GameRegistrar }[] = [
  { name: "connectFour", register: connectFourSocket },
  { name: "cardDraw", register: CardDrawSocket },
  { name: "crash", register: Crash },
  { name: "slots", register: Slots },
  { name: "keno", register: Keno },
  { name: "mines", register: Mines },
  { name: "plinko", register: Plinko },
];

const presenceKey = (userId: string) => `player:${userId}`;

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

      try {
        await redis.set(presenceKey(s.user.userId), s.id);
      } catch (err) {
        // Presence tracking failing shouldn't block the connection itself.
        console.error("Redis presence set failed:", err);
      }

      socket.on("disconnect", async () => {
        try {
          // Only clear the presence key if it still points at THIS socket.
          // Without this check, a user who reconnects on a new socket
          // before the old one times out would have their fresh
          // presence key deleted by the stale connection's disconnect event.
          const current = await redis.get(presenceKey(s.user.userId));
          if (current === s.id) {
            await redis.del(presenceKey(s.user.userId));
          }
        } catch (err) {
          console.error("Redis cleanup failed:", err);
        }
      });

      for (const { name, register } of GAME_REGISTRARS) {
        try {
          register(io, s);
        } catch (err) {
          // One game's registration blowing up (bad handler setup, etc.)
          // shouldn't prevent the rest of the games from wiring up for
          // this socket.
          console.error(`Failed to register game "${name}":`, err);
        }
      }
    }),
  );
}

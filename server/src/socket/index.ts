import { Socket } from "socket.io";
import connectFourSocket from "./connectfour.socket";
import CardDrawSocket from "./carddraw";
import { redis } from "../config/radis";

interface CustomSocket extends Socket {
  playerId?: string;
  queueKey?: string | null;
  queueEntry?: string | null;
  roomId?: string;
}

export default function initSocket(io: any) {
  io.on("connection", (socket: CustomSocket) => {
    socket.on("player:register", async ({ playerId }) => {
      console.log(playerId + "player registerd");
      socket.playerId = playerId;
      await redis.set(`player:${playerId}`, socket.id);
    });

    console.log("user connected", socket.id);
    connectFourSocket(io, socket);
    CardDrawSocket(io, socket);
  });
}

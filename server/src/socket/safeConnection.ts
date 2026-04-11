import { Socket } from "socket.io";
import { handleSocketError } from "./socketErrorHandler";

export const safeConnection =
  (handler: (socket: Socket) => Promise<void>) => async (socket: Socket) => {
    try {
      await handler(socket);
    } catch (err) {
      handleSocketError(socket, err);
    }
  };

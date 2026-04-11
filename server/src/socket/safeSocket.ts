import { Socket } from "socket.io";
import { handleSocketError } from "./socketErrorHandler";

export const safeSocket =
  <T = any>(
    socket: Socket,
    handler: (data: T, callback?: Function) => Promise<void>,
  ) =>
  async (data: T, callback?: Function) => {
    try {
      await handler(data, callback);
    } catch (err) {
      handleSocketError(socket, err);
      callback?.({ success: false });
    }
  };

import express from "express";
import cors from "cors";
import http from "http";
import authRoute from "./routes/auth.route";
import walletRoute from "./routes/wallet.route";
import { Server } from "socket.io";
import initSocket from "./socket";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { AppError } from "./utils/AppError";

const app = express();
const corsConfig = {
  origin: (origin: any, cb: any) => cb(null, true),
  credentials: true,
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));
app.set("trust proxy", 1);
const server = http.createServer(app);

const io = new Server(server, {
  path: "/socket.io",
  cors: corsConfig,
  transports: ["websocket", "polling"],
});
app.use(express.json({ limit: "1mb" }));
app.use("/auth", authRoute);
app.use("/wallet", walletRoute);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

initSocket(io);

app.use(globalErrorHandler);

export default server;

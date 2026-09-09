import express from "express";
import cors from "cors";

import authRoute from "./routes/auth.route";
import inviteRoute from "./routes/invite.route";
import walletRoute from "./routes/wallet.route";
import couponRoute from "./routes/coupon.route";
import GameRoute from "./routes/game.route";
import statRoute from "./routes/stats.route";

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

app.use(express.json({ limit: "1mb" }));

app.use("/auth", authRoute);
app.use("/wallet", walletRoute);
app.use("/games", GameRoute);
app.use("/invites", inviteRoute);
app.use("/stats", statRoute);
app.use("/coupon", couponRoute);

app.all("*", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

export default app;

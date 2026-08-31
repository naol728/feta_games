import express from "express";
import { spinSlote } from "../controller/game.controller";
import { requireAuth } from "../middleware/auth";
const GameRoute = express.Router();
GameRoute.post("/slots", requireAuth, spinSlote);
export default GameRoute;

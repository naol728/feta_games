import express from "express";
import {
  dailyActivity,
  getDailyLeaderboard,
} from "../controller/stats.controller";
import { requireAuth } from "../middleware/auth";
const statRoute = express.Router();

statRoute.get("/dailyactivity", requireAuth, dailyActivity);
statRoute.get("/leaderboard", requireAuth, getDailyLeaderboard);
export default statRoute;

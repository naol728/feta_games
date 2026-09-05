import express from "express"
import { dailyActivity } from "../controller/stats.controller"
import { requireAuth } from "../middleware/auth"
const statRoute = express.Router()

statRoute.get("/dailyactivity", requireAuth, dailyActivity)
export default statRoute
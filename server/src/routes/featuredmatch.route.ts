import express from "express";
import {
  getMatches,
  getmyfeaturematchbet,
  placefeaturematchbet,
} from "../controller/featuredmatch.controller";
import { requireAuth } from "../middleware/auth";
const FeatureMatch = express.Router();
FeatureMatch.get("/match", requireAuth, getMatches);
FeatureMatch.post("/bet", requireAuth, placefeaturematchbet);
FeatureMatch.get("/bet", requireAuth, getmyfeaturematchbet);

export default FeatureMatch;

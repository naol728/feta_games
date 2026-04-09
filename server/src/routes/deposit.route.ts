import express from "express";
import { deposit } from "../controller/deposit.controller";
const route = express.Router();
route.post("/", deposit);
export default route;

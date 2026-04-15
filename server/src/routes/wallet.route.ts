import express from "express";
import {
  deposit,
  wallet,
  paymentMethod,
  withDraw,
  transactions,
  getTransaction,
  getWithdraws,
} from "../controller/wallet.controller";
import { requireAuth } from "../middleware/auth";
const route = express.Router();
route.use(requireAuth);
route.get("/", wallet);
route.post("/paymentmethod", paymentMethod);
route.post("/deposit", deposit);
route.post("/withdraw", withDraw);
route.get("/withdraw", getWithdraws);
route.get("/transactions", transactions);
route.get("/gettransaction/:trxno", getTransaction);

export default route;

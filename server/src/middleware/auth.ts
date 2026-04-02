// middleware/auth.ts
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { NextFunction, Request, Response } from "express";

interface CutomRequest extends Request {
  user: unknown;
}

export function authMiddleware(
  req: CutomRequest,
  res: Response,
  next: NextFunction,
) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token" });
  }
  const token = auth.split(" ")[1];
  console.log(token);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

import { Request, Response } from "express";
import { verifyTelegram } from "../utils/telegram";
import { env } from "../config/env";
import { supabase } from "../config/supabase";
import jwt from "jsonwebtoken";
export const telegramAuth = async (req: Request, res: Response) => {
  try {
    const { initData } = req.body;
    console.log(initData);
    // const tgUser = verifyTelegram(initData, env.BOT_TOKEN);

    const { data: user } = await supabase
      .from("users")
      .upsert(
        {
          telegram_id: initData.from?.id,
          username: initData.from?.username,
        },
        { onConflict: "telegram_id" },
      )
      .select()
      .single();

    // 🔐 create JWT
    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegram_id },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      access_token: token,
      user: {
        id: user.id,
        balance: user.balance,
        locked_balance: user.locked_balance,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "Auth failed" });
  }
};
// interface CustomRequest extends Request {
//   user: {
//     userId: string;
//   };
// }
export const me = async (req: Request, res: Response) => {
  const { user } = req;
  const userId = user.userId;
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  res.json(data);
};

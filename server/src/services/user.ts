import TelegramBot from "node-telegram-bot-api";
import { supabase } from "./../config/supabase";

export async function upsertTelegramUser(msg: TelegramBot.Message) {
  const tg = msg.from;
  if (!tg) throw new Error("No telegram user");

  const payload = {
    telegram_id: tg.id,
    username: tg.username ?? null,
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, {
      onConflict: "telegram_id",
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

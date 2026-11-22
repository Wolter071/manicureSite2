// Бот работает через long polling: публичный адрес и домен не нужны, подходит для домашнего ПК.
import { pool } from "../lib/db";
import { getSchedule } from "../lib/schedule";
import { bookingText, tg } from "../lib/telegram";
import { formatLocal } from "../lib/time";

type Update = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; from: { id: number }; data?: string;
    message?: { chat: { id: number }; message_id: number } };
};

const master = Number(process.env.MASTER_CHAT_ID || 0);

async function handle(u: Update) {
  if (u.message?.text?.startsWith("/start")) {
    const id = u.message.chat.id;
    await tg("sendMessage", { chat_id: id, text: master === id
      ? "Бот подключён. Новые заявки будут приходить сюда."
      : `Ваш chat id: ${id}\nВставьте его в .env.local как MASTER_CHAT_ID и перезапустите бота.` });
    return;
  }
  const cb = u.callback_query;
  if (!cb?.data || !cb.message) return;
  if (cb.from.id !== master) { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Нет доступа" }); return; }

  const [action, idStr] = cb.data.split(":");
  const status = action === "c" ? "confirmed" : action === "r" ? "rejected" : null;
  if (!status) return;
  const upd = await pool.query(
    `UPDATE bookings SET status=$1, updated_at=now() WHERE id=$2 AND status='new' RETURNING id`,
    [status, Number(idStr)]);
  if (!upd.rows[0]) { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Заявка уже обработана" }); return; }

  const { rows } = await pool.query(
    `SELECT b.*, s.name AS service FROM bookings b JOIN services s ON s.id=b.service_id WHERE b.id=$1`, [Number(idStr)]);
  const b = rows[0]; const tz = (await getSchedule()).tz;
  await tg("editMessageText", {
    chat_id: cb.message.chat.id, message_id: cb.message.message_id, parse_mode: "HTML",
    text: bookingText({ id: b.id, name: b.name, phone: b.phone, telegram: b.telegram, service: b.service,
      color: b.color, when: formatLocal(new Date(b.starts_at), tz), comment: b.comment },
      status === "confirmed" ? "✅ Подтверждена" : "❌ Отклонена"),
  });
  await tg("answerCallbackQuery", { callback_query_id: cb.id, text: status === "confirmed" ? "Подтверждено" : "Отклонено" });
}

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("Не задан TELEGRAM_BOT_TOKEN в .env.local");
  await tg("deleteWebhook", {});
  console.log("Бот запущен. Нажмите Ctrl+C для остановки.");
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg<Update[]>("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      for (const u of updates) {
        offset = u.update_id + 1;
        try { await handle(u); } catch (e) { console.error("Ошибка обработки:", e); }
      }
    } catch (e) {
      console.error("Ошибка связи с Telegram, повтор через 5 с:", (e as Error).message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

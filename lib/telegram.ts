const api = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;

export async function tg<T = unknown>(method: string, body: object): Promise<T> {
  const r = await fetch(api(method), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result as T;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type BookingView = {
  id: number; name: string; phone: string; telegram: string | null; service: string;
  color: string | null; when: string; comment: string | null;
};

export function bookingText(b: BookingView, status?: string): string {
  const lines = [
    `<b>Заявка №${b.id}</b>`,
    `Услуга: ${esc(b.service)}`,
    `Когда: ${esc(b.when)}`,
    `Клиент: ${esc(b.name)}, ${esc(b.phone)}${b.telegram ? ", " + esc(b.telegram) : ""}`,
  ];
  if (b.color) lines.push(`Цвет: ${esc(b.color)}`);
  if (b.comment) lines.push(`Пожелания: ${esc(b.comment)}`);
  if (status) lines.push("", `<b>${esc(status)}</b>`);
  return lines.join("\n");
}

export async function notifyMaster(b: BookingView) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.MASTER_CHAT_ID) return;
  await tg("sendMessage", {
    chat_id: process.env.MASTER_CHAT_ID, parse_mode: "HTML", text: bookingText(b),
    reply_markup: { inline_keyboard: [[
      { text: "✅ Подтвердить", callback_data: `c:${b.id}` },
      { text: "❌ Отклонить", callback_data: `r:${b.id}` },
    ]] },
  });
}

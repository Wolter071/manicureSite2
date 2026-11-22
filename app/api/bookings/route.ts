import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { allow } from "@/lib/ratelimit";
import { freeSlots, getSchedule } from "@/lib/schedule";
import { formatLocal, zonedToUtc } from "@/lib/time";
import { notifyMaster } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const body = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(60),
  phone: z.string().trim().refine((v) => { const n = v.replace(/\D/g, ""); return n.length >= 10 && n.length <= 15; }, "Проверьте номер телефона"),
  telegram: z.string().trim().regex(/^@?[A-Za-z0-9_]{5,32}$/, "Проверьте Telegram").optional().or(z.literal("")),
  serviceId: z.coerce.number().int().positive(),
  color: z.string().trim().max(60).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  comment: z.string().trim().max(500).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Нужно согласие на обработку данных" }) }),
  website: z.string().optional(), // ловушка для ботов: настоящие клиенты это поле не видят
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (!allow(`b:${ip}`, 5, 10 * 60_000))
    return NextResponse.json({ error: "Слишком много заявок. Попробуйте позже." }, { status: 429 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "Неверный запрос" }, { status: 400 }); }
  const p = body.safeParse(json);
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
  const d = p.data;
  if (d.website) return NextResponse.json({ ok: true }); // бот: делаем вид, что всё принято

  try {
    const svc = await pool.query("SELECT name, duration_min FROM services WHERE id=$1 AND active", [d.serviceId]);
    if (!svc.rows[0]) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    const { name: service, duration_min } = svc.rows[0];

    if (!(await freeSlots(d.date, duration_min)).includes(d.time))
      return NextResponse.json({ error: "Это время недоступно. Выберите другое." }, { status: 409 });

    const phoneDigits = d.phone.replace(/\D/g, "");
    const dup = await pool.query(
      `SELECT count(*)::int AS n FROM bookings
       WHERE regexp_replace(phone,'\\D','','g') = $1 AND status IN ('new','confirmed') AND starts_at > now()`,
      [phoneDigits]);
    if (dup.rows[0].n >= 2)
      return NextResponse.json({ error: "У вас уже есть две активные записи. Дождитесь ответа мастера." }, { status: 429 });

    const tz = (await getSchedule()).tz;
    const start = zonedToUtc(d.date, d.time, tz);
    const end = new Date(start.getTime() + duration_min * 60_000);
    const tgName = d.telegram ? (d.telegram.startsWith("@") ? d.telegram : "@" + d.telegram) : null;

    let id: number;
    try {
      const r = await pool.query(
        `INSERT INTO bookings(name, phone, telegram, service_id, color, starts_at, ends_at, comment, consent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()) RETURNING id`,
        [d.name, d.phone, tgName, d.serviceId, d.color || null, start, end, d.comment || null]);
      id = r.rows[0].id;
    } catch (e) {
      if ((e as { code?: string }).code === "23P01")
        return NextResponse.json({ error: "Это время только что заняли. Выберите другое." }, { status: 409 });
      throw e;
    }

    notifyMaster({ id, name: d.name, phone: d.phone, telegram: tgName, service, color: d.color || null,
      when: formatLocal(start, tz), comment: d.comment || null })
      .catch((e) => console.error("Telegram:", e));

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не удалось отправить заявку. Попробуйте ещё раз." }, { status: 500 });
  }
}

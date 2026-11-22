import { pool } from "./db";
import { fromMin, toMin, weekday, zonedToUtc } from "./time";

export type Schedule = {
  tz: string; stepMin: number; minNoticeHours: number; maxDaysAhead: number;
  days: Record<string, { start: string; end: string }>;
  breaks: { start: string; end: string }[];
};

export async function getSchedule(): Promise<Schedule> {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'schedule'");
  if (!rows[0]) throw new Error("Расписание не настроено. Выполните npm run migrate.");
  return rows[0].value as Schedule;
}

/** Свободные времена начала для услуги длительностью durationMin в указанный день. */
export async function freeSlots(date: string, durationMin: number): Promise<string[]> {
  const s = await getSchedule();
  const day = s.days[String(weekday(date))];
  if (!day) return [];
  const now = Date.now();
  const earliest = now + s.minNoticeHours * 3600_000;
  const latest = now + s.maxDaysAhead * 86400_000;

  const dayStart = zonedToUtc(date, "00:00", s.tz);
  const dayEnd = new Date(dayStart.getTime() + 36 * 3600_000);
  const { rows } = await pool.query(
    `SELECT starts_at, ends_at FROM bookings
     WHERE status IN ('new','confirmed') AND ends_at > $1 AND starts_at < $2`,
    [dayStart, dayEnd]);
  const busy = rows.map((r) => [new Date(r.starts_at).getTime(), new Date(r.ends_at).getTime()]);

  const out: string[] = [];
  for (let t = toMin(day.start); t + durationMin <= toMin(day.end); t += s.stepMin) {
    const end = t + durationMin;
    if (s.breaks.some((b) => t < toMin(b.end) && end > toMin(b.start))) continue;
    const time = fromMin(t);
    const from = zonedToUtc(date, time, s.tz).getTime();
    const to = from + durationMin * 60_000;
    if (from < earliest || from > latest) continue;
    if (busy.some(([a, b]) => from < b && to > a)) continue;
    out.push(time);
  }
  return out;
}

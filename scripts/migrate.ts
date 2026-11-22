import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const DEFAULT_SCHEDULE = {
  tz: "Europe/Moscow",
  stepMin: 30,
  minNoticeHours: 3,
  maxDaysAhead: 60,
  // 0 = воскресенье … 6 = суббота. Нет ключа — выходной.
  days: {
    "1": { start: "10:00", end: "19:00" }, "2": { start: "10:00", end: "19:00" },
    "3": { start: "10:00", end: "19:00" }, "4": { start: "10:00", end: "19:00" },
    "5": { start: "10:00", end: "19:00" }, "6": { start: "11:00", end: "17:00" },
  },
  breaks: [{ start: "14:00", end: "15:00" }],
};

const DEMO_SERVICES: [string, string, number, number, number][] = [
  ["Маникюр с покрытием гель-лаком", "Обработка, выравнивание, покрытие в 2 слоя", 3500, 150, 1],
  ["Маникюр без покрытия", "Аппаратный или комбинированный", 2200, 90, 2],
  ["Укрепление гелем", "База, укрепление, покрытие", 4200, 165, 3],
  ["Дизайн (1 ноготь)", "Френч, втирка, рисунок", 250, 30, 4],
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(readFileSync(join(process.cwd(), "db/schema.sql"), "utf8"));
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM services");
  if (rows[0].n === 0) {
    for (const s of DEMO_SERVICES) {
      await pool.query(
        "INSERT INTO services(name, description, price_rub, duration_min, sort) VALUES ($1,$2,$3,$4,$5)", s);
    }
    console.log("Добавлены демонстрационные услуги");
  }
  await pool.query(
    "INSERT INTO settings(key, value) VALUES ('schedule', $1) ON CONFLICT (key) DO NOTHING",
    [JSON.stringify(DEFAULT_SCHEDULE)]);
  console.log("База данных готова");
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, price_rub, duration_min
       FROM services WHERE active ORDER BY sort, id`);
    return NextResponse.json({ services: rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не удалось загрузить услуги" }, { status: 500 });
  }
}

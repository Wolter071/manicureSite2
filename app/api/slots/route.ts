import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { freeSlots } from "@/lib/schedule";

export const dynamic = "force-dynamic";
const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), service_id: z.coerce.number().int().positive() });

export async function GET(req: NextRequest) {
  const p = q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) return NextResponse.json({ error: "Неверные параметры" }, { status: 400 });
  try {
    const { rows } = await pool.query("SELECT duration_min FROM services WHERE id=$1 AND active", [p.data.service_id]);
    if (!rows[0]) return NextResponse.json({ error: "Услуга не найдена" }, { status: 404 });
    return NextResponse.json({ slots: await freeSlots(p.data.date, rows[0].duration_min) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не удалось загрузить время" }, { status: 500 });
  }
}

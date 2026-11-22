import { Pool } from "pg";

const g = globalThis as unknown as { __pool?: Pool };
export const pool: Pool = g.__pool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") g.__pool = pool;

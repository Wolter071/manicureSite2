function tzOffsetMs(at: Date, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** «2026-12-01» + «14:30» в часовом поясе мастера → момент времени UTC. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMs(new Date(guess), tz);
  utc = guess - tzOffsetMs(new Date(utc), tz);
  return new Date(utc);
}

export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatLocal(d: Date, tz: string): string {
  return d.toLocaleString("ru-RU", {
    timeZone: tz, weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const fromMin = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

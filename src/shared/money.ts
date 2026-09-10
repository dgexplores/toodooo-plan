/** Money display + IST day math. Pure, tested. No FX network calls by design:
 *  the rate is user-set (Settings) and cached — offline-first, free forever. */

/** USD → INR at a user-set rate. Null rate = show USD only (no guessing). */
export function usdToInr(usd: number, rate: number | null | undefined): number | null {
  if (!isFinite(usd) || usd < 0) return null;
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;
  return usd * rate;
}

export function formatInr(usd: number, rate: number | null | undefined): string | null {
  const v = usdToInr(usd, rate);
  if (v === null) return null;
  if (v < 1) return `<₹1`;
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** IST midnight (ms epoch) containing `now`. Fixed +5:30 — India has no DST,
 *  so unlike every other timezone this arithmetic is exact forever. */
export function istDayStart(now: number): number {
  const IST_OFFSET_MS = 5.5 * 3_600_000;
  const DAY_MS = 86_400_000;
  return Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

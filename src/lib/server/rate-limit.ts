import "server-only";
import { HttpError } from "./http";

const buckets = new Map<string, { count: number; reset: number }>();

/**
 * Fixed-window limiter kept in memory. Good enough for one instance; behind
 * several instances, move this to Redis or the database.
 */
export function limit(key: string, max: number, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { count: 1, reset: now + windowMs }); return; }
  if (++b.count > max) throw new HttpError(429, "יותר מדי ניסיונות. חכו רגע ונסו שוב.");
}
export function resetLimitsForTests() { buckets.clear(); }

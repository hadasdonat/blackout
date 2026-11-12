import { z } from "zod";
import { ADMIN_COOKIE, ADMIN_PASSWORD_MIN, adminToken, checkAdminPassword } from "@/lib/server/auth";
import { guardAttempts, recordFailure } from "@/lib/server/game";
import { body, clientIp, cookie, HttpError, json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";

const Schema = z.object({ password: z.string().min(1).max(200) });

/**
 * Admin sign-in. Failures are counted in the database per network and for the
 * whole site, so guessing the password is slow even across many servers.
 */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  limit(`admin:${ip}`, 5, 60_000);
  const real = process.env.ADMIN_PASSWORD;
  if (!real) throw new HttpError(503, "עוד לא הוגדרה סיסמת מנהלת. הוסיפו ADMIN_PASSWORD ב-Vercel.");
  if (real.length < ADMIN_PASSWORD_MIN) throw new HttpError(503, `סיסמת המנהלת קצרה מדי. הגדירו ב-Vercel סיסמה של ${ADMIN_PASSWORD_MIN} תווים לפחות.`);
  await guardAttempts([
    { key: `admin:${ip}`, max: 5, message: "יותר מדי ניסיונות. נסו שוב בעוד 15 דקות." },
    { key: "admin:*", max: 30, message: "הכניסה למנהלת נעולה זמנית בגלל הרבה ניסיונות. נסו שוב בעוד 15 דקות." },
  ]);
  const { password } = await body(req, Schema);
  if (!checkAdminPassword(password)) {
    await recordFailure(`admin:${ip}`, "admin:*");
    throw new HttpError(401, "הסיסמה לא נכונה");
  }
  return json({ ok: true }, { cookies: [cookie(ADMIN_COOKIE, adminToken(), 12 * 60 * 60)] });
});

import { z } from "zod";
import { ADMIN_COOKIE, adminToken, checkAdminPassword } from "@/lib/server/auth";
import { body, clientIp, cookie, HttpError, json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";

const Schema = z.object({ password: z.string().min(1).max(200) });
export const POST = route(async (req: Request) => {
  limit(`admin:${clientIp(req)}`, 5, 60_000);
  if (!process.env.ADMIN_PASSWORD) throw new HttpError(503, "ADMIN_PASSWORD is not configured");
  const { password } = await body(req, Schema);
  if (!checkAdminPassword(password)) throw new HttpError(401, "הסיסמה לא נכונה");
  return json({ ok: true }, { cookies: [cookie(ADMIN_COOKIE, adminToken(), 12 * 60 * 60)] });
});

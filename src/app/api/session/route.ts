import { z } from "zod";
import { PLAYER_COOKIE, playerToken } from "@/lib/server/auth";
import { login, me, register, sessionVersion } from "@/lib/server/game";
import { body, clientIp, cookie, json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";
import { MODE_IDS, type ModeId } from "@/lib/game/modes";
import { PASSWORD_MAX } from "@/lib/game/password";

const Schema = z.object({
  mode: z.enum(["register", "login"]),
  nickname: z.string().trim().min(2, "השם צריך להיות באורך 2 תווים לפחות").max(24, "השם ארוך מדי").regex(/^[\p{L}\p{N} ._-]+$/u, "בשם אפשר להשתמש רק באותיות, ספרות, רווח, נקודה ומקף"),
  password: z.string().min(1, "כתבו סיסמה").max(PASSWORD_MAX, "הסיסמה ארוכה מדי"),
  level: z.enum(MODE_IDS as [string, ...string[]]).optional(),
});

const SESSION_DAYS = 60;

/** Registers a new player or signs an existing one in, then sets the session cookie. */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  limit(`session:${ip}`, 10, 60_000);
  const { mode, nickname, password, level } = await body(req, Schema);
  const id = mode === "register" ? await register(nickname, password, (level ?? "beginner") as ModeId) : await login(nickname, password, ip);
  return json(await me(id), { cookies: [cookie(PLAYER_COOKIE, playerToken(id, await sessionVersion(id)), SESSION_DAYS * 24 * 60 * 60)] });
});

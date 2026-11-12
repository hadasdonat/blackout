import { z } from "zod";
import { PLAYER_COOKIE, playerToken } from "@/lib/server/auth";
import { login, me, register } from "@/lib/server/game";
import { body, clientIp, cookie, json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";

const Schema = z.object({
  mode: z.enum(["register", "login"]),
  nickname: z.string().trim().min(2, "השם צריך להיות באורך 2 תווים לפחות").max(24, "השם ארוך מדי").regex(/^[\p{L}\p{N} ._-]+$/u, "בשם אפשר להשתמש רק באותיות, ספרות, רווח, נקודה ומקף"),
  pin: z.string().regex(/^\d{4}$/, "הקוד צריך להיות 4 ספרות"),
});

/** Registers a new player or signs an existing one in, then sets the session cookie. */
export const POST = route(async (req: Request) => {
  const { mode, nickname, pin } = await body(req, Schema);
  limit(`session:${clientIp(req)}`, 10, 60_000);
  const id = mode === "register" ? await register(nickname, pin) : await login(nickname, pin);
  return json(await me(id), { cookies: [cookie(PLAYER_COOKIE, playerToken(id), 60 * 60 * 24 * 180)] });
});

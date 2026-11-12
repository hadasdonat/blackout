import { z } from "zod";
import { PLAYER_COOKIE, playerToken } from "@/lib/server/auth";
import { changePassword } from "@/lib/server/game";
import { body, cookie, json, requirePlayer, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";
import { PASSWORD_MAX } from "@/lib/game/password";

const Schema = z.object({ current: z.string().min(1).max(PASSWORD_MAX), next: z.string().min(1).max(PASSWORD_MAX) });

/** Changes the password, signs out every other device, and keeps this one signed in. */
export const POST = route(async (req: Request) => {
  const id = await requirePlayer(req);
  limit(`password:${id}`, 5, 60_000);
  const { current, next } = await body(req, Schema);
  const version = await changePassword(id, current, next);
  return json({ ok: true }, { cookies: [cookie(PLAYER_COOKIE, playerToken(id, version), 60 * 24 * 60 * 60)] });
});

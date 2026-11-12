import { z } from "zod";
import { askTutor } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";
import { levelNumber, type LevelParams } from "../params";

const Msg = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1500) });
const Schema = z.object({
  messages: z.array(Msg).min(1).max(16).refine((m) => m.at(-1)?.role === "user", "השאלה האחרונה חייבת להיות שלכם"),
  terminal: z.string().max(2500).optional(),
});

export const POST = route(async (req: Request, ctx: LevelParams) => {
  const player = requirePlayer(req);
  limit(`ask:${player}`, 12, 5 * 60_000);
  const { messages, terminal } = await body(req, Schema);
  if (messages.at(-1)!.content.length > 800) return json({ error: "השאלה ארוכה מדי. נסו לקצר אותה." }, { status: 400 });
  return json(await askTutor(player, await levelNumber(ctx), messages, terminal));
});

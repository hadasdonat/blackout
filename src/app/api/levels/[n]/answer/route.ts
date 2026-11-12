import { z } from "zod";
import { submitAnswer } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";
import { limit } from "@/lib/server/rate-limit";
import { levelNumber, type LevelParams } from "../params";

const Schema = z.object({
  attemptId: z.uuid(),
  answer: z.union([z.string().max(200), z.tuple([z.string().max(200), z.string().max(200)])]),
});

/** Answers are checked here, on the server. The browser never has the answer key. */
export const POST = route(async (req: Request, ctx: LevelParams) => {
  const id = requirePlayer(req);
  limit(`answer:${id}`, 30, 60_000);
  const { attemptId, answer } = await body(req, Schema);
  return json(await submitAnswer(id, await levelNumber(ctx), attemptId, answer));
});

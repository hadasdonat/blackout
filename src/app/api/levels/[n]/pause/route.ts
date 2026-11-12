import { z } from "zod";
import { setPaused } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";
import { levelNumber, type LevelParams } from "../params";

const Schema = z.object({ attemptId: z.uuid(), pause: z.boolean() });
export const POST = route(async (req: Request, ctx: LevelParams) => {
  const { attemptId, pause } = await body(req, Schema);
  return json(await setPaused(requirePlayer(req), await levelNumber(ctx), attemptId, pause));
});

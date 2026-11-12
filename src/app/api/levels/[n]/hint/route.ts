import { z } from "zod";
import { useHint } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";
import { levelNumber, type LevelParams } from "../params";

const Schema = z.object({ attemptId: z.uuid() });
export const POST = route(async (req: Request, ctx: LevelParams) => {
  const { attemptId } = await body(req, Schema);
  return json(await useHint(requirePlayer(req), await levelNumber(ctx), attemptId));
});

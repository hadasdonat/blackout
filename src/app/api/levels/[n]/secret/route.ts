import { z } from "zod";
import { claimSecret } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";
import { levelNumber, type LevelParams } from "../params";

const Schema = z.object({ attemptId: z.uuid(), file: z.string().max(40) });
export const POST = route(async (req: Request, ctx: LevelParams) => {
  const { attemptId, file } = await body(req, Schema);
  return json(await claimSecret(requirePlayer(req), await levelNumber(ctx), attemptId, file));
});

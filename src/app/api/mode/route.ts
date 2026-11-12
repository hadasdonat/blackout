import { z } from "zod";
import { setMode } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";
import { MODE_IDS, type ModeId } from "@/lib/game/modes";

const Schema = z.object({ mode: z.enum(MODE_IDS as [ModeId, ...ModeId[]]) });

/** Switches the player's difficulty. Each mode keeps its own progress. */
export const POST = route(async (req: Request) => {
  const id = await requirePlayer(req);
  const { mode } = await body(req, Schema);
  return json(await setMode(id, mode));
});

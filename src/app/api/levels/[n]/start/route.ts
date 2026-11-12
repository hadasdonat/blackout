import { startLevel } from "@/lib/server/game";
import { json, requirePlayer, route } from "@/lib/server/http";
import { levelNumber, type LevelParams } from "../params";

export const POST = route(async (req: Request, ctx: LevelParams) => json(await startLevel(await requirePlayer(req), await levelNumber(ctx))));

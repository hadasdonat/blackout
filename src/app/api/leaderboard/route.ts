import { leaderboard } from "@/lib/server/game";
import { json, route } from "@/lib/server/http";
import { isMode } from "@/lib/game/modes";

export const dynamic = "force-dynamic";
export const GET = route(async (req: Request) => {
  const mode = new URL(req.url).searchParams.get("mode");
  return json(await leaderboard(isMode(mode) ? mode : "intermediate"));
});

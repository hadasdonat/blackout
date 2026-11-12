import { leaderboard } from "@/lib/server/game";
import { json, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const GET = route(async () => json(await leaderboard()));

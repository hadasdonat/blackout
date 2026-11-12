import { me } from "@/lib/server/game";
import { json, requirePlayer, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const GET = route(async (req: Request) => json(await me(await requirePlayer(req))));

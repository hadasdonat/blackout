import { adminOverview } from "@/lib/server/game";
import { json, requireAdmin, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const GET = route(async (req: Request) => { requireAdmin(req); return json(await adminOverview()); });

import { z } from "zod";
import { touch } from "@/lib/server/game";
import { body, json, requirePlayer, route } from "@/lib/server/http";

const Schema = z.object({ where: z.string().max(40) });
export const POST = route(async (req: Request) => {
  const id = await requirePlayer(req);
  await touch(id, (await body(req, Schema)).where);
  return json({ ok: true });
});

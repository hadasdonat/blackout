import { ADMIN_COOKIE } from "@/lib/server/auth";
import { cookie, json, route } from "@/lib/server/http";

export const POST = route(async () => json({ ok: true }, { cookies: [cookie(ADMIN_COOKIE, "", 0)] }));

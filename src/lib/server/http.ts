import "server-only";
import { z } from "zod";
import { ADMIN_COOKIE, PLAYER_COOKIE, readAdminToken, readPlayerToken } from "./auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, init: ResponseInit & { cookies?: string[] } = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  for (const c of init.cookies ?? []) headers.append("set-cookie", c);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookie(name: string, value: string, maxAgeS: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeS}${secure}`;
}

const MAX_BODY = 32 * 1024;

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) throw new HttpError(413, "הבקשה גדולה מדי");
  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) throw new HttpError(413, "הבקשה גדולה מדי");
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* reported below */ }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  return parsed.data;
}

/** Checks the signed session cookie and that it was not revoked by a password change. */
export async function requirePlayer(req: Request): Promise<string> {
  const token = readPlayerToken(cookies(req)[PLAYER_COOKIE]);
  if (!token) throw new HttpError(401, "צריך להתחבר כדי לשחק");
  const { getDb } = await import("./db");
  const [row] = await (await getDb()).query<{ session_version: number }>("SELECT session_version FROM players WHERE id = $1", [token.id]);
  if (!row || row.session_version !== token.version) throw new HttpError(401, "החיבור פג. התחברו מחדש.");
  return token.id;
}
export function requireAdmin(req: Request) {
  if (!process.env.ADMIN_PASSWORD) throw new HttpError(503, "ADMIN_PASSWORD is not configured");
  if (!readAdminToken(cookies(req)[ADMIN_COOKIE])) throw new HttpError(401, "צריך להתחבר כמנהלת");
}

export function clientIp(req: Request) {
  // On Vercel, x-real-ip is set by the platform and cannot be spoofed by the client.
  return (req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0])?.trim().slice(0, 64) || "local";
}

/**
 * Blocks cross-site requests: a state-changing call must come from this site.
 * Browsers always send Origin on cross-site POSTs, so a missing header means a
 * same-origin request or a non-browser client, both fine.
 */
export function checkOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try { originHost = new URL(origin).host; } catch { /* invalid */ }
  if (!host || originHost !== host) throw new HttpError(403, "הבקשה נחסמה");
}

/** Wraps a route handler: turns HttpError into a JSON response, hides anything else. */
export function route<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A) => {
    try { checkOrigin(req); return await fn(req, ...rest); }
    catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
      console.error(e);
      return json({ error: "משהו השתבש אצלנו. נסו שוב בעוד רגע." }, { status: 500 });
    }
  };
}

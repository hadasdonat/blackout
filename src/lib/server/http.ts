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

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  return parsed.data;
}

export function requirePlayer(req: Request): string {
  const id = readPlayerToken(cookies(req)[PLAYER_COOKIE]);
  if (!id) throw new HttpError(401, "צריך להתחבר כדי לשחק");
  return id;
}
export function requireAdmin(req: Request) {
  if (!process.env.ADMIN_PASSWORD) throw new HttpError(503, "ADMIN_PASSWORD is not configured");
  if (!readAdminToken(cookies(req)[ADMIN_COOKIE])) throw new HttpError(401, "צריך להתחבר כמנהלת");
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Wraps a route handler: turns HttpError into a JSON response, hides anything else. */
export function route<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A) => {
    try { return await fn(req, ...rest); }
    catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
      console.error(e);
      return json({ error: "Something went wrong on our side" }, { status: 500 });
    }
  };
}

import "server-only";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return "development-only-secret-change-me";
}
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const PLAYER_COOKIE = "bo_session";
export const ADMIN_COOKIE = "bo_admin";
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;

export const playerToken = (id: string) => `${id}.${sign(`player:${id}`)}`;
export function readPlayerToken(token: string | undefined): string | null {
  if (!token) return null;
  const [id, sig] = token.split(".");
  return id && sig && safeEqual(sig, sign(`player:${id}`)) ? id : null;
}

export function adminToken(now = Date.now()) { return `${now}.${sign(`admin:${now}`)}`; }
export function readAdminToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [ts, sig] = token.split(".");
  const issued = Number(ts);
  return !!sig && Number.isFinite(issued) && now - issued < ADMIN_TTL_MS && safeEqual(sig, sign(`admin:${ts}`));
}
export function checkAdminPassword(given: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return safeEqual(sign(`pw:${given}`), sign(`pw:${real}`));
}

/** PINs are hashed with scrypt and a per-player salt. */
export async function hashPin(pin: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
export async function verifyPin(pin: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const got = await scryptAsync(pin, Buffer.from(salt, "base64url"), 32);
  return safeEqual(got.toString("base64url"), hash);
}

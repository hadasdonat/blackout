import "server-only";
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  // The database URL is already a server-only secret, so a key derived from it
  // keeps sessions signed when SESSION_SECRET is not configured.
  const db = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL || process.env.NEON_DATABASE_URL;
  if (db) return createHash("sha256").update(`blackout-session:${db}`).digest("hex");
  if (process.env.NODE_ENV === "production") throw new Error("Set SESSION_SECRET or DATABASE_URL");
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

const PLAYER_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * A player session is `id.version.issuedAt.signature`. The version lives in the
 * database and goes up when the password changes, which signs out every other
 * device; sessions also expire after 60 days.
 */
export const playerToken = (id: string, version: number, now = Date.now()) => `${id}.${version}.${now}.${sign(`player:${id}:${version}:${now}`)}`;
export function readPlayerToken(token: string | undefined, now = Date.now()): { id: string; version: number } | null {
  if (!token) return null;
  const [id, ver, iat, sig] = token.split(".");
  const version = Number(ver), issued = Number(iat);
  if (!id || !sig || !Number.isInteger(version) || !Number.isFinite(issued) || now - issued > PLAYER_TTL_MS || issued - now > 60_000) return null;
  return safeEqual(sig, sign(`player:${id}:${version}:${issued}`)) ? { id, version } : null;
}

export function adminToken(now = Date.now()) { return `${now}.${sign(`admin:${now}`)}`; }
export function readAdminToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [ts, sig] = token.split(".");
  const issued = Number(ts);
  return !!sig && Number.isFinite(issued) && now - issued < ADMIN_TTL_MS && safeEqual(sig, sign(`admin:${ts}`));
}
export const ADMIN_PASSWORD_MIN = 10;
export function checkAdminPassword(given: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || real.length < ADMIN_PASSWORD_MIN) return false;
  return safeEqual(sign(`pw:${given}`), sign(`pw:${real}`));
}

/** Passwords are hashed with scrypt and a per-player salt; the plain text is never stored. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const got = await scryptAsync(password, Buffer.from(salt, "base64url"), 32);
  return safeEqual(got.toString("base64url"), hash);
}

/** Spends the same time as a real check, so a missing account can't be told apart by timing. */
const DUMMY = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const verifyNothing = (password: string) => verifyPassword(password, DUMMY).then(() => false);

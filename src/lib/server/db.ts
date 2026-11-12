import "server-only";

/**
 * A tiny database adapter. Production uses Postgres through `pg`
 * (DATABASE_URL). Local development and tests use PGlite, a real Postgres
 * compiled to WebAssembly, so the same SQL runs everywhere with no setup.
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname    text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24),
  pin_hash    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  location    text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS players_nickname_ci ON players (lower(nickname));

CREATE TABLE IF NOT EXISTS attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  level        smallint NOT NULL,
  started_at   timestamptz NOT NULL,
  deadline_at  timestamptz,
  completed_at timestamptz,
  failed_at    timestamptz,
  wrong        smallint NOT NULL DEFAULT 0,
  hints        smallint NOT NULL DEFAULT 0,
  bonus_used   boolean NOT NULL DEFAULT false,
  stars        smallint CHECK (stars BETWEEN 1 AND 3),
  duration_ms  integer
);
CREATE INDEX IF NOT EXISTS attempts_player_level ON attempts (player_id, level);

CREATE TABLE IF NOT EXISTS answers (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id  uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  level       smallint NOT NULL,
  answer      text NOT NULL,
  correct     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS answers_wrong_by_level ON answers (level) WHERE NOT correct;
`;

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5, ssl: /sslmode=require|neon\.tech|supabase/.test(url) ? { rejectUnauthorized: false } : undefined });
    const db: Db = {
      async query<T>(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows as T[]; },
      async exec(sql: string) { await pool.query(sql); },
    };
    await db.exec(SCHEMA);
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? (process.env.NODE_ENV === "test" ? undefined : "./.data/pglite");
  const lite = new PGlite(dir);
  const db: Db = {
    async query<T>(sql: string, params: unknown[] = []) { return (await lite.query<T>(sql, params)).rows; },
    async exec(sql: string) { await lite.exec(sql); },
  };
  await db.exec(SCHEMA);
  return db;
}

const g = globalThis as unknown as { __blackoutDb?: Promise<Db> };
export function getDb(): Promise<Db> {
  g.__blackoutDb ??= connect();
  return g.__blackoutDb;
}
/** Tests only: start from an empty database. */
export function resetDbForTests() { g.__blackoutDb = undefined; }

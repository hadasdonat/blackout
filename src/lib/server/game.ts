import "server-only";
import { SECRET_FILES } from "@/lib/game/evidence";
import { LEVEL_COUNT, LEVELS } from "@/lib/game/levels";
import { checkFinal, checkPractice, HINT_PENALTY_S, hintFor, keyFor, SECRET_BONUS_S, starsFor, WRONG_PENALTY_S } from "./answers";
import { hashPin, verifyPin } from "./auth";
import { getDb } from "./db";
import { HttpError } from "./http";

export interface Progress { [level: number]: { stars: number; ms: number } }
interface AttemptRow {
  id: string; player_id: string; level: number; started_at: Date; deadline_at: Date | null;
  completed_at: Date | null; failed_at: Date | null; paused_at: Date | null; wrong: number; hints: number; bonus_used: boolean;
}

const BEST = `
  SELECT DISTINCT ON (player_id, level) player_id, level, stars, duration_ms
  FROM attempts WHERE completed_at IS NOT NULL
  ORDER BY player_id, level, stars DESC, duration_ms ASC`;

/* ---------------- players ---------------- */

export async function register(nickname: string, pin: string) {
  const db = await getDb();
  const taken = await db.query("SELECT 1 FROM players WHERE lower(nickname) = lower($1)", [nickname]);
  if (taken.length) throw new HttpError(409, "השם הזה כבר תפוס. נסו שם אחר, או התחברו עם הקוד שלכם.");
  const [row] = await db.query<{ id: string }>("INSERT INTO players (nickname, pin_hash) VALUES ($1, $2) RETURNING id", [nickname, await hashPin(pin)]);
  return row!.id;
}

export async function login(nickname: string, pin: string) {
  const db = await getDb();
  const [row] = await db.query<{ id: string; pin_hash: string }>("SELECT id, pin_hash FROM players WHERE lower(nickname) = lower($1)", [nickname]);
  if (!row || !(await verifyPin(pin, row.pin_hash))) throw new HttpError(401, "השם או הקוד לא נכונים.");
  return row.id;
}

export async function progressOf(playerId: string): Promise<Progress> {
  const db = await getDb();
  const rows = await db.query<{ level: number; stars: number; duration_ms: number }>(`SELECT level, stars, duration_ms FROM (${BEST}) b WHERE player_id = $1`, [playerId]);
  return Object.fromEntries(rows.map((r) => [r.level, { stars: r.stars, ms: r.duration_ms }]));
}

export async function me(playerId: string) {
  const db = await getDb();
  const [p] = await db.query<{ id: string; nickname: string }>("SELECT id, nickname FROM players WHERE id = $1", [playerId]);
  if (!p) throw new HttpError(401, "החשבון לא נמצא. התחברו מחדש.");
  return { id: p.id, nickname: p.nickname, progress: await progressOf(playerId) };
}

export async function touch(playerId: string, location: string) {
  const db = await getDb();
  await db.query("UPDATE players SET last_seen = now(), location = $2 WHERE id = $1", [playerId, location.slice(0, 40)]);
}

/* ---------------- level runs ---------------- */

function levelOrThrow(n: number) {
  const level = LEVELS[n - 1];
  if (!level) throw new HttpError(404, "אין שלב כזה");
  return level;
}

export async function startLevel(playerId: string, n: number, now = new Date()) {
  const level = levelOrThrow(n);
  if (n > 1 && !(await progressOf(playerId))[n - 1]) throw new HttpError(403, "המשימה הזו עדיין נעולה. סיימו קודם את המשימה הקודמת.");
  const key = keyFor(n)!;
  const deadline = key.kind === "final" ? new Date(now.getTime() + key.seconds * 1000) : null;
  const db = await getDb();
  const [row] = await db.query<{ id: string }>("INSERT INTO attempts (player_id, level, started_at, deadline_at) VALUES ($1, $2, $3, $4) RETURNING id", [playerId, n, now, deadline]);
  await touch(playerId, `שלב ${level.room} משימה ${level.idx}`);
  return { attemptId: row!.id, deadline: deadline?.toISOString() ?? null, serverNow: now.toISOString() };
}

async function openAttempt(playerId: string, n: number, attemptId: string) {
  const db = await getDb();
  const [a] = await db.query<AttemptRow>("SELECT * FROM attempts WHERE id = $1 AND player_id = $2 AND level = $3", [attemptId, playerId, n]);
  if (!a) throw new HttpError(404, "הריצה הזו לא נמצאה. פתחו את השלב מחדש.");
  if (a.completed_at) throw new HttpError(409, "השלב כבר הושלם");
  if (a.failed_at) throw new HttpError(409, "הזמן של הריצה הזו נגמר. פתחו את השלב מחדש.");
  return a;
}

async function expire(attemptId: string, now: Date) {
  const db = await getDb();
  await db.query("UPDATE attempts SET failed_at = $2 WHERE id = $1", [attemptId, now]);
  return { expired: true as const };
}

export async function submitAnswer(playerId: string, n: number, attemptId: string, answer: string | [string, string], now = new Date()) {
  const level = levelOrThrow(n);
  const a = await openAttempt(playerId, n, attemptId);
  const db = await getDb();
  const clock = a.paused_at ?? now;
  if (a.deadline_at && clock > a.deadline_at) return expire(a.id, now);

  const final = !!level.final;
  if (final !== Array.isArray(answer)) throw new HttpError(400, final ? "בשלב הזה שולחים שני ממצאים" : "בשלב הזה שולחים תשובה אחת");
  const verdict = Array.isArray(answer) ? checkFinal(n, answer[0], answer[1]) : checkPractice(n, answer);
  const stored = (Array.isArray(answer) ? answer.map((x) => x.trim()).join(" | ") : answer.trim()).toLowerCase().slice(0, 120);
  await db.query("INSERT INTO answers (attempt_id, level, answer, correct) VALUES ($1, $2, $3, $4)", [a.id, n, stored, verdict.correct]);

  if (!verdict.correct) {
    let deadline = a.deadline_at;
    if (deadline) deadline = new Date(deadline.getTime() - WRONG_PENALTY_S * 1000);
    await db.query("UPDATE attempts SET wrong = wrong + 1, deadline_at = $2 WHERE id = $1", [a.id, deadline]);
    if (deadline && clock > deadline) return expire(a.id, now);
    return { correct: false as const, feedback: verdict.feedback, deadline: deadline?.toISOString() ?? null, serverNow: now.toISOString() };
  }

  const stars = starsFor(final, a.wrong, a.hints);
  const durationMs = now.getTime() - a.started_at.getTime();
  await db.query("UPDATE attempts SET completed_at = $2, stars = $3, duration_ms = $4 WHERE id = $1", [a.id, now, stars, durationMs]);
  return {
    correct: true as const, feedback: verdict.feedback, stars, durationMs,
    timeLeftMs: a.deadline_at ? a.deadline_at.getTime() - clock.getTime() : null,
    wrong: a.wrong, hints: a.hints, progress: await progressOf(playerId),
  };
}

export async function useHint(playerId: string, n: number, attemptId: string, now = new Date()) {
  const a = await openAttempt(playerId, n, attemptId);
  const clock = a.paused_at ?? now;
  if (a.deadline_at && clock > a.deadline_at) return expire(a.id, now);
  const text = hintFor(n, a.hints);
  if (!text) throw new HttpError(409, "אין עוד רמזים בשלב הזה");
  const deadline = a.deadline_at ? new Date(a.deadline_at.getTime() - HINT_PENALTY_S * 1000) : null;
  const db = await getDb();
  await db.query("UPDATE attempts SET hints = hints + 1, deadline_at = $2 WHERE id = $1", [a.id, deadline]);
  if (deadline && clock > deadline) return expire(a.id, now);
  return { hint: text, used: a.hints + 1, deadline: deadline?.toISOString() ?? null, serverNow: now.toISOString() };
}

/** Finding the room's hidden file is worth one extra minute, once, in the incident stage. */
export async function claimSecret(playerId: string, n: number, attemptId: string, file: string, now = new Date()) {
  const level = levelOrThrow(n);
  const a = await openAttempt(playerId, n, attemptId);
  if (!level.final || file !== SECRET_FILES[level.room] || a.bonus_used || !a.deadline_at) return { bonus: false, deadline: a.deadline_at?.toISOString() ?? null };
  const deadline = new Date(a.deadline_at.getTime() + SECRET_BONUS_S * 1000);
  const db = await getDb();
  await db.query("UPDATE attempts SET bonus_used = true, deadline_at = $2 WHERE id = $1", [a.id, deadline]);
  return { bonus: true, deadline: deadline.toISOString(), serverNow: now.toISOString() };
}

/**
 * Stopping the clock freezes the incident deadline on the server: while it is
 * stopped time does not run out, and resuming moves the deadline forward.
 */
export async function setPaused(playerId: string, n: number, attemptId: string, pause: boolean, now = new Date()) {
  const a = await openAttempt(playerId, n, attemptId);
  if (!a.deadline_at) throw new HttpError(400, "רק משימות אירוע עם שעון אפשר לעצור");
  const db = await getDb();
  if (pause) {
    if (a.paused_at) return { paused: true, timeLeftMs: a.deadline_at.getTime() - a.paused_at.getTime() };
    if (now > a.deadline_at) return expire(a.id, now);
    await db.query("UPDATE attempts SET paused_at = $2 WHERE id = $1", [a.id, now]);
    return { paused: true, timeLeftMs: a.deadline_at.getTime() - now.getTime() };
  }
  if (!a.paused_at) return { paused: false, deadline: a.deadline_at.toISOString(), serverNow: now.toISOString() };
  const deadline = new Date(a.deadline_at.getTime() + (now.getTime() - a.paused_at.getTime()));
  await db.query("UPDATE attempts SET paused_at = NULL, deadline_at = $2 WHERE id = $1", [a.id, deadline]);
  return { paused: false, deadline: deadline.toISOString(), serverNow: now.toISOString() };
}

/* ---------------- leaderboard and admin ---------------- */

export async function leaderboard(limitRows = 100) {
  const db = await getDb();
  const rows = await db.query<{ id: string; nickname: string; done: number; stars: number; total_ms: number }>(`
    WITH best AS (${BEST})
    SELECT p.id, p.nickname,
           COUNT(b.level)::int AS done,
           COALESCE(SUM(b.stars), 0)::int AS stars,
           COALESCE(SUM(b.duration_ms), 0)::int AS total_ms
    FROM players p LEFT JOIN best b ON b.player_id = p.id
    GROUP BY p.id
    ORDER BY done DESC, stars DESC, total_ms ASC, p.created_at ASC
    LIMIT $1`, [limitRows]);
  const online = await db.query<{ nickname: string; location: string }>(
    "SELECT nickname, location FROM players WHERE last_seen > now() - interval '60 seconds' ORDER BY last_seen DESC LIMIT 50");
  return { rows: rows.map((r) => ({ id: r.id, nickname: r.nickname, done: r.done, stars: r.stars, totalMs: r.total_ms })), online, levels: LEVEL_COUNT };
}

export async function adminOverview() {
  const db = await getDb();
  const players = await db.query<{ id: string; nickname: string; created_at: Date; last_seen: Date; location: string }>(
    "SELECT id, nickname, created_at, last_seen, location FROM players ORDER BY created_at DESC LIMIT 1000");
  const best = await db.query<{ player_id: string; level: number; stars: number; duration_ms: number }>(BEST);
  const perLevel = await db.query<{ level: number; players_started: number; players_completed: number; runs: number; avg_ms: number | null; avg_wrong: number; avg_hints: number; expired: number }>(`
    SELECT level,
           COUNT(DISTINCT player_id)::int AS players_started,
           COUNT(DISTINCT player_id) FILTER (WHERE completed_at IS NOT NULL)::int AS players_completed,
           COUNT(*)::int AS runs,
           (AVG(duration_ms) FILTER (WHERE completed_at IS NOT NULL))::int AS avg_ms,
           COALESCE(AVG(wrong), 0)::float AS avg_wrong,
           COALESCE(AVG(hints), 0)::float AS avg_hints,
           COUNT(*) FILTER (WHERE failed_at IS NOT NULL)::int AS expired
    FROM attempts GROUP BY level ORDER BY level`);
  const topWrong = await db.query<{ level: number; answer: string; c: number }>(`
    SELECT level, answer, c FROM (
      SELECT level, answer, COUNT(*)::int AS c,
             ROW_NUMBER() OVER (PARTITION BY level ORDER BY COUNT(*) DESC, answer) AS rn
      FROM answers WHERE NOT correct GROUP BY level, answer
    ) t WHERE rn <= 3 ORDER BY level, c DESC`);

  const byPlayer: Record<string, Progress> = {};
  for (const b of best) (byPlayer[b.player_id] ??= {})[b.level] = { stars: b.stars, ms: b.duration_ms };
  const onlineCutoff = Date.now() - 60_000;
  return {
    levels: LEVELS.map((l) => {
      const s = perLevel.find((x) => x.level === l.n);
      return {
        n: l.n, room: l.room, idx: l.idx, title: l.title,
        started: s?.players_started ?? 0, completed: s?.players_completed ?? 0, runs: s?.runs ?? 0,
        avgMs: s?.avg_ms ?? null, avgWrong: s?.avg_wrong ?? 0, avgHints: s?.avg_hints ?? 0, expired: s?.expired ?? 0,
        topWrong: topWrong.filter((w) => w.level === l.n).map((w) => ({ answer: w.answer, count: w.c })),
      };
    }),
    players: players.map((p) => ({
      id: p.id, nickname: p.nickname, joinedAt: p.created_at.toISOString(), lastSeen: p.last_seen.toISOString(),
      online: p.last_seen.getTime() > onlineCutoff, location: p.location, progress: byPlayer[p.id] ?? {},
    })),
  };
}

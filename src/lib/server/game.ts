import "server-only";
import { SECRET_FILES } from "@/lib/game/evidence";
import { LEVELS } from "@/lib/game/levels";
import { checkFinal, checkPractice, HINT_PENALTY_S, hintFor, keyFor, SECRET_BONUS_S, starsFor, WRONG_PENALTY_S } from "./answers";
import { hashPassword, verifyNothing, verifyPassword } from "./auth";
import { isMode, MODE_IDS, MODES, previousLevel, type ModeId } from "@/lib/game/modes";
import { normalizeNickname, passwordProblem, reservedNickname } from "@/lib/game/password";
import { getDb } from "./db";
import { HttpError } from "./http";
import { aiConfigured, offlineAnswer, tutorReply, type ChatMsg } from "./tutor";

export interface Progress { [level: number]: { stars: number; ms: number } }
interface AttemptRow {
  id: string; player_id: string; level: number; mode: ModeId; started_at: Date; deadline_at: Date | null;
  completed_at: Date | null; failed_at: Date | null; paused_at: Date | null; wrong: number; hints: number; bonus_used: boolean;
}

const BEST = `
  SELECT DISTINCT ON (player_id, mode, level) player_id, mode, level, stars, duration_ms
  FROM attempts WHERE completed_at IS NOT NULL
  ORDER BY player_id, mode, level, stars DESC, duration_ms ASC`;

/* ---------------- players ---------------- */

const LOCK_MINUTES = 15;
const MAX_FAILS_PER_NAME = 5;
const MAX_FAILS_PER_IP = 25;

/** Failed sign-ins are counted in the database, so the lockout holds across every server instance. */
async function failures(key: string) {
  const db = await getDb();
  const [r] = await db.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM auth_failures WHERE key = $1 AND at > now() - interval '${LOCK_MINUTES} minutes'`, [key]);
  return r?.c ?? 0;
}
export async function guardAttempts(keys: { key: string; max: number; message: string }[]) {
  for (const k of keys) if ((await failures(k.key)) >= k.max) throw new HttpError(429, k.message);
}
export async function recordFailure(...keys: string[]) {
  const db = await getDb();
  for (const key of keys) await db.query("INSERT INTO auth_failures (key) VALUES ($1)", [key]);
  await db.query("DELETE FROM auth_failures WHERE at < now() - interval '1 day'");
}

export async function register(nicknameRaw: string, password: string, mode: ModeId) {
  const nickname = normalizeNickname(nicknameRaw);
  if (reservedNickname(nickname)) throw new HttpError(409, "השם הזה שמור. בחרו שם אחר.");
  const problem = passwordProblem(password, nickname);
  if (problem) throw new HttpError(400, `הסיסמה צריכה: ${problem}`);
  const db = await getDb();
  const taken = await db.query("SELECT 1 FROM players WHERE lower(nickname) = lower($1)", [nickname]);
  if (taken.length) throw new HttpError(409, "השם הזה כבר תפוס. נסו שם אחר, או התחברו אם זה החשבון שלכם.");
  try {
    const [row] = await db.query<{ id: string }>("INSERT INTO players (nickname, pin_hash, mode) VALUES ($1, $2, $3) RETURNING id", [nickname, await hashPassword(password), mode]);
    return row!.id;
  } catch (e) {
    // Two sign-ups racing for the same name: the unique index decides.
    if ((e as { code?: string }).code === "23505") throw new HttpError(409, "השם הזה כבר תפוס. נסו שם אחר.");
    throw e;
  }
}

export async function login(nicknameRaw: string, password: string, ip: string) {
  const nickname = normalizeNickname(nicknameRaw);
  const nameKey = `name:${nickname.toLowerCase()}`, ipKey = `ip:${ip}`;
  await guardAttempts([
    { key: nameKey, max: MAX_FAILS_PER_NAME, message: `יותר מדי ניסיונות כניסה לחשבון הזה. הוא נעול ל-${LOCK_MINUTES} דקות.` },
    { key: ipKey, max: MAX_FAILS_PER_IP, message: `יותר מדי ניסיונות כניסה מהרשת שלכם. נסו שוב בעוד ${LOCK_MINUTES} דקות.` },
  ]);
  const db = await getDb();
  const [row] = await db.query<{ id: string; pin_hash: string }>("SELECT id, pin_hash FROM players WHERE lower(nickname) = lower($1)", [nickname]);
  const ok = row ? await verifyPassword(password, row.pin_hash) : await verifyNothing(password);
  if (!row || !ok) {
    await recordFailure(nameKey, ipKey);
    throw new HttpError(401, "השם או הסיסמה לא נכונים.");
  }
  await db.query("DELETE FROM auth_failures WHERE key = $1", [nameKey]);
  // Old accounts used a 4-digit code: let them in, and ask them to pick a real password.
  await db.query("UPDATE players SET weak_password = $2 WHERE id = $1", [row.id, passwordProblem(password, nickname) !== null]);
  return row.id;
}

export async function sessionVersion(playerId: string) {
  const db = await getDb();
  const [r] = await db.query<{ session_version: number }>("SELECT session_version FROM players WHERE id = $1", [playerId]);
  return r?.session_version ?? 0;
}

/** Changing the password signs out every other device by bumping the session version. */
export async function changePassword(playerId: string, current: string, next: string) {
  const db = await getDb();
  const [row] = await db.query<{ nickname: string; pin_hash: string }>("SELECT nickname, pin_hash FROM players WHERE id = $1", [playerId]);
  if (!row) throw new HttpError(401, "החשבון לא נמצא. התחברו מחדש.");
  const key = `change:${playerId}`;
  await guardAttempts([{ key, max: MAX_FAILS_PER_NAME, message: `יותר מדי ניסיונות. נסו שוב בעוד ${LOCK_MINUTES} דקות.` }]);
  if (!(await verifyPassword(current, row.pin_hash))) { await recordFailure(key); throw new HttpError(401, "הסיסמה הנוכחית לא נכונה."); }
  const problem = passwordProblem(next, row.nickname);
  if (problem) throw new HttpError(400, `הסיסמה החדשה צריכה: ${problem}`);
  if (next === current) throw new HttpError(400, "הסיסמה החדשה צריכה להיות שונה מהנוכחית.");
  const [r] = await db.query<{ session_version: number }>(
    "UPDATE players SET pin_hash = $2, weak_password = false, session_version = session_version + 1 WHERE id = $1 RETURNING session_version",
    [playerId, await hashPassword(next)]);
  return r!.session_version;
}

export async function playerMode(playerId: string): Promise<ModeId> {
  const db = await getDb();
  const [r] = await db.query<{ mode: string }>("SELECT mode FROM players WHERE id = $1", [playerId]);
  if (!r) throw new HttpError(401, "החשבון לא נמצא. התחברו מחדש.");
  return isMode(r.mode) ? r.mode : "intermediate";
}

export async function setMode(playerId: string, mode: ModeId) {
  const db = await getDb();
  await db.query("UPDATE players SET mode = $2 WHERE id = $1", [playerId, mode]);
  return me(playerId);
}

export async function progressOf(playerId: string, mode: ModeId): Promise<Progress> {
  const db = await getDb();
  const rows = await db.query<{ level: number; stars: number; duration_ms: number }>(`SELECT level, stars, duration_ms FROM (${BEST}) b WHERE player_id = $1 AND mode = $2`, [playerId, mode]);
  return Object.fromEntries(rows.map((r) => [r.level, { stars: r.stars, ms: r.duration_ms }]));
}

export async function me(playerId: string) {
  const db = await getDb();
  const [p] = await db.query<{ id: string; nickname: string; mode: string; weak_password: boolean }>("SELECT id, nickname, mode, weak_password FROM players WHERE id = $1", [playerId]);
  if (!p) throw new HttpError(401, "החשבון לא נמצא. התחברו מחדש.");
  const mode = isMode(p.mode) ? p.mode : "intermediate";
  const sums = await db.query<{ mode: string; done: number; stars: number }>(
    `SELECT mode, COUNT(*)::int AS done, SUM(stars)::int AS stars FROM (${BEST}) b WHERE player_id = $1 GROUP BY mode`, [playerId]);
  const modes = Object.fromEntries(MODE_IDS.map((m) => {
    const s = sums.find((x) => x.mode === m);
    return [m, { done: s?.done ?? 0, stars: s?.stars ?? 0, total: MODES[m].levels.length }];
  }));
  return { id: p.id, nickname: p.nickname, mode, weakPassword: p.weak_password, modes, progress: await progressOf(playerId, mode) };
}

export async function touch(playerId: string, location: string) {
  const db = await getDb();
  await db.query("UPDATE players SET last_seen = now(), location = $2 WHERE id = $1", [playerId, location.slice(0, 40)]);
}

async function assertUnlocked(playerId: string, mode: ModeId, n: number) {
  if (!MODES[mode].levels.includes(n)) throw new HttpError(403, `המשימה הזו לא נמצאת ברמת ${MODES[mode].name}.`);
  const prev = previousLevel(mode, n);
  if (prev && !(await progressOf(playerId, mode))[prev]) throw new HttpError(403, "המשימה הזו עדיין נעולה. סיימו קודם את המשימה הקודמת.");
}

/* ---------------- level runs ---------------- */

function levelOrThrow(n: number) {
  const level = LEVELS[n - 1];
  if (!level) throw new HttpError(404, "אין שלב כזה");
  return level;
}

export async function startLevel(playerId: string, n: number, now = new Date()) {
  const level = levelOrThrow(n);
  const mode = await playerMode(playerId);
  await assertUnlocked(playerId, mode, n);
  const key = keyFor(n)!;
  const deadline = key.kind === "final" ? new Date(now.getTime() + Math.round(key.seconds * MODES[mode].clock) * 1000) : null;
  const db = await getDb();
  const [row] = await db.query<{ id: string }>("INSERT INTO attempts (player_id, level, mode, started_at, deadline_at) VALUES ($1, $2, $3, $4, $5) RETURNING id", [playerId, n, mode, now, deadline]);
  await touch(playerId, `${MODES[mode].icon} שלב ${level.room} משימה ${level.idx}`);
  return { attemptId: row!.id, mode, deadline: deadline?.toISOString() ?? null, serverNow: now.toISOString() };
}

async function openAttempt(playerId: string, n: number, attemptId: string) {
  const db = await getDb();
  const [a] = await db.query<AttemptRow>("SELECT * FROM attempts WHERE id = $1 AND player_id = $2 AND level = $3", [attemptId, playerId, n]);
  if (!a) throw new HttpError(404, "הריצה הזו לא נמצאה. פתחו את השלב מחדש.");
  if (a.completed_at) throw new HttpError(409, "השלב כבר הושלם");
  if (a.failed_at) throw new HttpError(409, "הזמן של הריצה הזו נגמר. פתחו את השלב מחדש.");
  return a;
}

const modeOf = (a: AttemptRow) => MODES[isMode(a.mode) ? a.mode : "intermediate"];

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
    if (deadline) deadline = new Date(deadline.getTime() - WRONG_PENALTY_S * modeOf(a).penalty * 1000);
    await db.query("UPDATE attempts SET wrong = wrong + 1, deadline_at = $2 WHERE id = $1", [a.id, deadline]);
    if (deadline && clock > deadline) return expire(a.id, now);
    return { correct: false as const, feedback: verdict.feedback, deadline: deadline?.toISOString() ?? null, serverNow: now.toISOString() };
  }

  const stars = starsFor(final, a.wrong, final || !modeOf(a).freeHints ? a.hints : 0);
  const durationMs = now.getTime() - a.started_at.getTime();
  await db.query("UPDATE attempts SET completed_at = $2, stars = $3, duration_ms = $4 WHERE id = $1", [a.id, now, stars, durationMs]);
  return {
    correct: true as const, feedback: verdict.feedback, stars, durationMs,
    timeLeftMs: a.deadline_at ? a.deadline_at.getTime() - clock.getTime() : null,
    wrong: a.wrong, hints: a.hints, progress: await progressOf(playerId, isMode(a.mode) ? a.mode : "intermediate"),
  };
}

export async function useHint(playerId: string, n: number, attemptId: string, now = new Date()) {
  const a = await openAttempt(playerId, n, attemptId);
  const clock = a.paused_at ?? now;
  if (a.deadline_at && clock > a.deadline_at) return expire(a.id, now);
  if (!modeOf(a).hints) throw new HttpError(403, "ברמת מומחים אין רמזים. אפשר לשאול את נועה.");
  const text = hintFor(n, a.hints);
  if (!text) throw new HttpError(409, "אין עוד רמזים בשלב הזה");
  const deadline = a.deadline_at ? new Date(a.deadline_at.getTime() - HINT_PENALTY_S * modeOf(a).penalty * 1000) : null;
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
  if (!a.deadline_at) throw new HttpError(400, "רק אתגרים עם שעון אפשר לעצור");
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

/* ---------------- tutor ---------------- */

const PLAYER_DAILY_QUESTIONS = 60;
const SITE_DAILY_QUESTIONS = Number(process.env.TUTOR_DAILY_LIMIT) || 1500;

export async function askTutor(playerId: string, n: number, messages: ChatMsg[], terminal?: string) {
  const level = levelOrThrow(n);
  await assertUnlocked(playerId, await playerMode(playerId), n);
  const db = await getDb();
  const [count] = await db.query<{ mine: number; total: number }>(`
    SELECT COUNT(*) FILTER (WHERE player_id = $1)::int AS mine, COUNT(*)::int AS total
    FROM questions WHERE created_at > now() - interval '1 day'`, [playerId]);
  if ((count?.mine ?? 0) >= PLAYER_DAILY_QUESTIONS) throw new HttpError(429, "שאלתם הרבה שאלות היום. נועה תחזור לענות מחר, ובינתיים יש רמזים ומילון.");
  // Past the site-wide budget Noa still answers, but offline, so the API bill stays capped.
  const reply = (count?.total ?? 0) >= SITE_DAILY_QUESTIONS
    ? { answer: offlineAnswer(level, messages.at(-1)!.content), source: "offline" as const }
    : await tutorReply(level, messages, terminal);
  await db.query("INSERT INTO questions (player_id, level, question, source) VALUES ($1, $2, $3, $4)", [playerId, n, messages.at(-1)!.content.slice(0, 800), reply.source]);
  return reply;
}

/* ---------------- leaderboard and admin ---------------- */

export async function leaderboard(mode: ModeId = "intermediate", limitRows = 100) {
  const db = await getDb();
  // A player appears on a mode's table once they finished something there, or chose that mode.
  const rows = await db.query<{ id: string; nickname: string; done: number; stars: number; total_ms: number }>(`
    WITH best AS (SELECT * FROM (${BEST}) x WHERE mode = $2)
    SELECT p.id, p.nickname,
           COUNT(b.level)::int AS done,
           COALESCE(SUM(b.stars), 0)::int AS stars,
           COALESCE(SUM(b.duration_ms), 0)::int AS total_ms
    FROM players p LEFT JOIN best b ON b.player_id = p.id
    WHERE p.mode = $2 OR b.level IS NOT NULL
    GROUP BY p.id
    ORDER BY done DESC, stars DESC, total_ms ASC, p.created_at ASC
    LIMIT $1`, [limitRows, mode]);
  const online = await db.query<{ nickname: string; location: string }>(
    "SELECT nickname, location FROM players WHERE last_seen > now() - interval '60 seconds' ORDER BY last_seen DESC LIMIT 50");
  return { mode, rows: rows.map((r) => ({ id: r.id, nickname: r.nickname, done: r.done, stars: r.stars, totalMs: r.total_ms })), online, levels: MODES[mode].levels.length };
}

export async function adminOverview() {
  const db = await getDb();
  const players = await db.query<{ id: string; nickname: string; created_at: Date; last_seen: Date; location: string; mode: string }>(
    "SELECT id, nickname, created_at, last_seen, location, mode FROM players ORDER BY created_at DESC LIMIT 1000");
  const best = await db.query<{ player_id: string; mode: string; level: number; stars: number; duration_ms: number }>(BEST);
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

  const questionsPerLevel = await db.query<{ level: number; c: number }>("SELECT level, COUNT(*)::int AS c FROM questions GROUP BY level");
  const recentQuestions = await db.query<{ nickname: string; level: number; question: string; source: string; created_at: Date }>(`
    SELECT p.nickname, q.level, q.question, q.source, q.created_at
    FROM questions q JOIN players p ON p.id = q.player_id
    ORDER BY q.created_at DESC LIMIT 40`);

  const byPlayer: Record<string, Progress> = {};
  // The admin grid shows each level's best result in any mode.
  for (const b of best) {
    const cur = (byPlayer[b.player_id] ??= {})[b.level];
    if (!cur || b.stars > cur.stars) byPlayer[b.player_id]![b.level] = { stars: b.stars, ms: b.duration_ms };
  }
  const onlineCutoff = Date.now() - 60_000;
  return {
    levels: LEVELS.map((l) => {
      const s = perLevel.find((x) => x.level === l.n);
      return {
        n: l.n, room: l.room, idx: l.idx, title: l.title,
        started: s?.players_started ?? 0, completed: s?.players_completed ?? 0, runs: s?.runs ?? 0,
        avgMs: s?.avg_ms ?? null, avgWrong: s?.avg_wrong ?? 0, avgHints: s?.avg_hints ?? 0, expired: s?.expired ?? 0,
        topWrong: topWrong.filter((w) => w.level === l.n).map((w) => ({ answer: w.answer, count: w.c })),
        questions: questionsPerLevel.find((x) => x.level === l.n)?.c ?? 0,
      };
    }),
    players: players.map((p) => ({
      id: p.id, nickname: p.nickname, joinedAt: p.created_at.toISOString(), lastSeen: p.last_seen.toISOString(),
      online: p.last_seen.getTime() > onlineCutoff, location: p.location, progress: byPlayer[p.id] ?? {},
      mode: isMode(p.mode) ? MODES[p.mode].name : p.mode,
    })),
    questions: recentQuestions.map((q) => ({ nickname: q.nickname, level: q.level, question: q.question, ai: q.source === "ai", at: q.created_at.toISOString() })),
    tutorAi: aiConfigured(),
  };
}

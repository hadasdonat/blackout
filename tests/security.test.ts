import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/server/db";
import { resetLimitsForTests } from "@/lib/server/rate-limit";
import { POST as session } from "@/app/api/session/route";
import { POST as start } from "@/app/api/levels/[n]/start/route";
import { POST as answer } from "@/app/api/levels/[n]/answer/route";
import { POST as hint } from "@/app/api/levels/[n]/hint/route";
import { POST as setModeRoute } from "@/app/api/mode/route";
import { POST as password } from "@/app/api/password/route";
import { GET as meRoute } from "@/app/api/me/route";
import { GET as board } from "@/app/api/leaderboard/route";
import { POST as adminLogin } from "@/app/api/admin/login/route";
import { getDb } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/auth";
import { MODES } from "@/lib/game/modes";
import { passwordProblem } from "@/lib/game/password";
import { FINAL, PRACTICE } from "./fixtures";

const req = (body?: unknown, cookie = "", headers: Record<string, string> = {}) =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json", cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const get = (cookie = "", url = "http://test/api") => new Request(url, { headers: { cookie } });
const lvl = (n: number) => ({ params: Promise.resolve({ n: String(n) }) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;
async function join(nickname: string, level = "beginner", pw = "Secret123") {
  const res = await session(req({ mode: "register", nickname, password: pw, level }));
  expect(res.status).toBe(200);
  return cookieOf(res);
}
const begin = async (c: string, n: number) => (await start(req({}, c), lvl(n))).json() as Promise<{ attemptId: string; deadline: string | null; serverNow: string; error?: string }>;
const solve = async (c: string, n: number) => {
  const r = await begin(c, n);
  return (await answer(req({ attemptId: r.attemptId, answer: n % 4 === 0 ? FINAL[n] : PRACTICE[n] }, c), lvl(n))).json();
};

beforeEach(() => { resetDbForTests(); resetLimitsForTests(); process.env.ADMIN_PASSWORD = "correct horse battery"; });

describe("difficulty modes", () => {
  it("gives beginners twice the time and experts only the six challenges", async () => {
    const b = await join("beginner1", "beginner");
    for (const n of [1, 2, 3]) await solve(b, n);
    const run = await begin(b, 4);
    expect(Date.parse(run.deadline!) - Date.parse(run.serverNow)).toBe(30 * 60_000 * MODES.beginner.clock);

    const x = await join("expert1", "expert");
    expect((await start(req({}, x), lvl(1))).status).toBe(403);
    const e = await begin(x, 4);
    expect(Date.parse(e.deadline!) - Date.parse(e.serverNow)).toBe(30 * 60_000 * MODES.expert.clock);
    expect((await hint(req({ attemptId: e.attemptId }, x), lvl(4))).status).toBe(403);
    expect((await start(req({}, x), lvl(8))).status).toBe(403);
    await answer(req({ attemptId: e.attemptId, answer: FINAL[4] }, x), lvl(4));
    expect((await start(req({}, x), lvl(8))).status).toBe(200);
  });

  it("keeps progress and leaderboards separate for each mode", async () => {
    const c = await join("switcher", "intermediate");
    await solve(c, 1);
    let me = await (await setModeRoute(req({ mode: "expert" }, c))).json();
    expect(me.mode).toBe("expert");
    expect(me.progress).toEqual({});
    expect(me.modes.intermediate.done).toBe(1);
    me = await (await setModeRoute(req({ mode: "intermediate" }, c))).json();
    expect(Object.keys(me.progress)).toEqual(["1"]);
    const mid = await (await board(get("", "http://test/api/leaderboard?mode=intermediate"))).json();
    const exp = await (await board(get("", "http://test/api/leaderboard?mode=expert"))).json();
    expect(mid.rows.map((r: { nickname: string }) => r.nickname)).toContain("switcher");
    expect(exp.rows).toEqual([]);
    expect(exp.levels).toBe(6);
  });

  it("does not cost beginners a star for practice hints", async () => {
    const c = await join("helped", "beginner");
    const r = await begin(c, 1);
    await hint(req({ attemptId: r.attemptId }, c), lvl(1));
    const res = await (await answer(req({ attemptId: r.attemptId, answer: PRACTICE[1] }, c), lvl(1))).json();
    expect(res.stars).toBe(3);
  });
});

describe("usernames and passwords", () => {
  it("refuses weak passwords, reserved names and look-alike duplicates", async () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("onlyletters")).not.toBeNull();
    expect(passwordProblem("password123")).not.toBeNull();
    expect(passwordProblem("hadas2026", "hadas")).not.toBeNull();
    expect(passwordProblem("Blue7Lamp")).toBeNull();
    expect((await session(req({ mode: "register", nickname: "dana", password: "1234" }))).status).toBe(400);
    expect((await session(req({ mode: "register", nickname: "Admin", password: "Secret123" }))).status).toBe(409);
    await join("Dana Levi");
    // Full-width letters and extra spaces normalize to the same name.
    expect((await session(req({ mode: "register", nickname: "Ｄａｎａ  Levi", password: "Secret123" }))).status).toBe(409);
  });

  it("never stores the password in plain text", async () => {
    await join("plain", "beginner", "Visible99");
    const [row] = await (await getDb()).query<{ pin_hash: string }>("SELECT pin_hash FROM players WHERE nickname = 'plain'");
    expect(row!.pin_hash).toMatch(/^scrypt\$/);
    expect(row!.pin_hash).not.toContain("Visible99");
  });

  it("locks an account for 15 minutes after 5 wrong passwords", async () => {
    await join("target");
    for (let i = 0; i < 5; i++) expect((await session(req({ mode: "login", nickname: "target", password: `Guess${i}xyz` }, "", { "x-real-ip": `10.0.0.${i}` }))).status).toBe(401);
    resetLimitsForTests();
    const locked = await session(req({ mode: "login", nickname: "target", password: "Secret123" }, "", { "x-real-ip": "10.9.9.9" }));
    expect(locked.status).toBe(429);
  });

  it("lets old 4-digit accounts in, flags them, and a password change signs out other devices", async () => {
    const db = await getDb();
    await db.query("INSERT INTO players (nickname, pin_hash) VALUES ('oldie', $1)", [await hashPassword("1234")]);
    const a = cookieOf(await session(req({ mode: "login", nickname: "oldie", password: "1234" })));
    const b = cookieOf(await session(req({ mode: "login", nickname: "oldie", password: "1234" })));
    expect((await (await meRoute(get(a))).json()).weakPassword).toBe(true);
    expect((await password(req({ current: "1234", next: "weak" }, a))).status).toBe(400);
    const changed = await password(req({ current: "1234", next: "Strong2026" }, a));
    expect(changed.status).toBe(200);
    const a2 = cookieOf(changed);
    expect((await meRoute(get(b))).status).toBe(401);
    const me = await (await meRoute(get(a2))).json();
    expect(me.weakPassword).toBe(false);
    expect((await session(req({ mode: "login", nickname: "oldie", password: "1234" }))).status).toBe(401);
  });
});

describe("request hardening", () => {
  it("blocks cross-site requests and oversized bodies", async () => {
    const c = await join("safe");
    expect((await start(req({}, c, { origin: "https://evil.example", host: "test" }), lvl(1))).status).toBe(403);
    expect((await start(req({}, c, { origin: "http://test", host: "test" }), lvl(1))).status).toBe(200);
    const huge = new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "login", nickname: "x".repeat(40_000), password: "a" }) });
    expect((await session(huge)).status).toBe(413);
  });

  it("rejects forged and expired session cookies", async () => {
    const c = await join("cookie");
    const [id] = c.split("=")[1]!.split(".");
    expect((await meRoute(get(`bo_session=${id}.0.${Date.now()}.forged`))).status).toBe(401);
    expect((await meRoute(get(c))).status).toBe(200);
  });

  it("refuses a short admin password and locks admin sign-in after repeated failures", async () => {
    process.env.ADMIN_PASSWORD = "short";
    expect((await adminLogin(req({ password: "short" }))).status).toBe(503);
    process.env.ADMIN_PASSWORD = "correct horse battery";
    for (let i = 0; i < 5; i++) { resetLimitsForTests(); expect((await adminLogin(req({ password: "nope" }, "", { "x-real-ip": "1.2.3.4" }))).status).toBe(401); }
    resetLimitsForTests();
    expect((await adminLogin(req({ password: "correct horse battery" }, "", { "x-real-ip": "1.2.3.4" }))).status).toBe(429);
    expect((await adminLogin(req({ password: "correct horse battery" }, "", { "x-real-ip": "5.6.7.8" }))).status).toBe(200);
  });
});

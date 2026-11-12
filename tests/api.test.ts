import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/server/db";
import { resetLimitsForTests } from "@/lib/server/rate-limit";
import { POST as session } from "@/app/api/session/route";
import { POST as start } from "@/app/api/levels/[n]/start/route";
import { POST as answer } from "@/app/api/levels/[n]/answer/route";
import { POST as hint } from "@/app/api/levels/[n]/hint/route";
import { POST as secret } from "@/app/api/levels/[n]/secret/route";
import { GET as board } from "@/app/api/leaderboard/route";
import { POST as adminLogin } from "@/app/api/admin/login/route";
import { GET as overview } from "@/app/api/admin/overview/route";
import { FACTS } from "@/lib/game/evidence";
import { setPaused, startLevel, submitAnswer } from "@/lib/server/game";

process.env.ADMIN_PASSWORD = "correct horse";

const req = (body?: unknown, cookie = "") =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
const lvl = (n: number) => ({ params: Promise.resolve({ n: String(n) }) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

async function player(nickname = "hadas") {
  const res = await session(req({ mode: "register", nickname, pin: "1234" }));
  expect(res.status).toBe(200);
  return cookieOf(res);
}
async function begin(c: string, n: number) {
  const res = await start(req({}, c), lvl(n));
  return { res, body: (await res.json()) as { attemptId: string; deadline: string | null } };
}
const send = async (c: string, n: number, attemptId: string, a: unknown) => (await answer(req({ attemptId, answer: a }, c), lvl(n))).json();
import { FINAL, PRACTICE } from "./fixtures";

beforeEach(() => { resetDbForTests(); resetLimitsForTests(); });

describe("players", () => {
  it("rejects a taken nickname and a wrong PIN, and signs in with the right one", async () => {
    await player("hadas");
    expect((await session(req({ mode: "register", nickname: "HADAS", pin: "9999" }))).status).toBe(409);
    expect((await session(req({ mode: "login", nickname: "hadas", pin: "0000" }))).status).toBe(401);
    expect((await session(req({ mode: "login", nickname: "Hadas", pin: "1234" }))).status).toBe(200);
  });

  it("validates input", async () => {
    expect((await session(req({ mode: "register", nickname: "<script>", pin: "1234" }))).status).toBe(400);
    expect((await session(req({ mode: "register", nickname: "ok name", pin: "12" }))).status).toBe(400);
  });

  it("requires a session to play", async () => {
    expect((await start(req({}), lvl(1))).status).toBe(401);
    expect((await start(req({}, "bo_session=fake.signature"), lvl(1))).status).toBe(401);
  });
});

describe("levels", () => {
  it("keeps later levels locked until the previous one is done", async () => {
    const c = await player();
    expect((await begin(c, 2)).res.status).toBe(403);
  });

  it("checks answers on the server, scores stars and unlocks the next level", async () => {
    const c = await player();
    const { body: run } = await begin(c, 1);
    const wrong = await send(c, 1, run.attemptId, "mail-srv");
    expect(wrong).toMatchObject({ correct: false });
    const right = await send(c, 1, run.attemptId, "VPN-GW01");
    expect(right).toMatchObject({ correct: true, stars: 2 });
    expect((await begin(c, 2)).res.status).toBe(200);
  });

  it("plays all six stages to the end", async () => {
    const c = await player();
    for (let n = 1; n <= 24; n++) {
      const { body: run } = await begin(c, n);
      const res = await send(c, n, run.attemptId, FINAL[n] ?? PRACTICE[n]);
      expect(res, `level ${n}`).toMatchObject({ correct: true, stars: 3 });
    }
  });

  it("runs the incident clock on the server: wrong answers and hints cost time", async () => {
    const c = await player();
    for (const n of [1, 2, 3]) { const { body: r } = await begin(c, n); await send(c, n, r.attemptId, PRACTICE[n]); }
    const { body: run } = await begin(c, 4);
    const t0 = Date.parse(run.deadline!);
    const w = await send(c, 4, run.attemptId, ["r.katz", "198.51.100.140"]);
    expect(w.feedback).toContain("כונן");
    expect(t0 - Date.parse(w.deadline)).toBe(60_000);
    const h = await (await hint(req({ attemptId: run.attemptId }, c), lvl(4))).json();
    expect(h.used).toBe(1);
    expect(h.hint).toContain("grep Accepted");
    expect(t0 - Date.parse(h.deadline)).toBe(180_000);
    const s = await (await secret(req({ attemptId: run.attemptId, file: ".shift_note" }, c), lvl(4))).json();
    expect(s.bonus).toBe(true);
    const again = await (await secret(req({ attemptId: run.attemptId, file: ".shift_note" }, c), lvl(4))).json();
    expect(again.bonus).toBe(false);
    const done = await send(c, 4, run.attemptId, FINAL[4]);
    expect(done).toMatchObject({ correct: true, stars: 2 });
  });

  it("does not let one player answer another player's run", async () => {
    const a = await player("alice");
    const b = await player("bob");
    const { body: run } = await begin(a, 1);
    expect((await answer(req({ attemptId: run.attemptId, answer: "vpn-gw01" }, b), lvl(1))).status).toBe(404);
  });
});

describe("leaderboard and admin", () => {
  it("ranks by levels, then stars, then time", async () => {
    const a = await player("alice");
    const b = await player("bob");
    const { body: r1 } = await begin(a, 1); await send(a, 1, r1.attemptId, "x"); await send(a, 1, r1.attemptId, "vpn-gw01");
    const { body: r2 } = await begin(b, 1); await send(b, 1, r2.attemptId, "vpn-gw01");
    const data = await (await board(new Request("http://test/api/leaderboard"))).json();
    expect(data.rows.map((r: { nickname: string }) => r.nickname)).toEqual(["bob", "alice"]);
    expect(data.online).toHaveLength(2);
  });

  it("protects the admin view and reports where players get stuck", async () => {
    expect((await overview(new Request("http://test/api/admin/overview"))).status).toBe(401);
    expect((await adminLogin(req({ password: "nope" }))).status).toBe(401);
    const res = await adminLogin(req({ password: "correct horse" }));
    expect(res.status).toBe(200);
    const c = await player();
    const { body: run } = await begin(c, 1);
    await send(c, 1, run.attemptId, "mail-srv");
    await send(c, 1, run.attemptId, "mail-srv");
    const data = await (await overview(new Request("http://test/api/admin/overview", { headers: { cookie: cookieOf(res) } }))).json();
    expect(data.levels[0]).toMatchObject({ started: 1, completed: 0, topWrong: [{ answer: "mail-srv", count: 2 }] });
    expect(data.players[0].nickname).toBe("hadas");
  });
});

describe("practice help", () => {
  it("gives a tip first, then the exact command, then nothing", async () => {
    const c = await player();
    const { body: run } = await begin(c, 1);
    const ask = async () => hint(req({ attemptId: run.attemptId }, c), lvl(1));
    expect((await (await ask()).json()).hint).toContain("אחרי השעה");
    expect((await (await ask()).json()).hint).toContain("<code>head auth.log</code>");
    expect((await ask()).status).toBe(409);
    expect(await send(c, 1, run.attemptId, "vpn-gw01")).toMatchObject({ correct: true, stars: 1 });
  });
});

describe("pause", () => {
  it("stops the server clock: time does not run out while stopped", async () => {
    const c = await player();
    for (const n of [1, 2, 3]) { const { body: r } = await begin(c, n); await send(c, n, r.attemptId, PRACTICE[n]); }
    const id = c.split("=")[1]!.split(".")[0]!;
    const t0 = new Date("2026-11-12T10:00:00Z");
    const run = await startLevel(id, 4, t0);
    const p = await setPaused(id, 4, run.attemptId, true, new Date(t0.getTime() + 60_000));
    expect(p).toMatchObject({ paused: true, timeLeftMs: 29 * 60_000 });
    const wrongWhilePaused = await submitAnswer(id, 4, run.attemptId, ["r.katz", "198.51.100.140"], new Date(t0.getTime() + 40 * 60_000));
    expect(wrongWhilePaused).toMatchObject({ correct: false });
    const r = await setPaused(id, 4, run.attemptId, false, new Date(t0.getTime() + 11 * 60_000));
    expect(Date.parse((r as { deadline: string }).deadline) - Date.parse(run.deadline!)).toBe(10 * 60_000 - 60_000);
    const done = await submitAnswer(id, 4, run.attemptId, FINAL[4]!, new Date(t0.getTime() + 12 * 60_000));
    expect(done).toMatchObject({ correct: true, timeLeftMs: 27 * 60_000 });
  });
});

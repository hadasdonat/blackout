import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbForTests } from "@/lib/server/db";
import { resetLimitsForTests } from "@/lib/server/rate-limit";
import { POST as session } from "@/app/api/session/route";
import { POST as ask } from "@/app/api/levels/[n]/ask/route";
import { GET as overview } from "@/app/api/admin/overview/route";
import { POST as adminLogin } from "@/app/api/admin/login/route";
import { LEVELS } from "@/lib/game/levels";
import { cleanHistory, offlineAnswer, systemPrompt } from "@/lib/server/tutor";
import { commandsIn, newCommands, reviewCommands, stageQuiz } from "@/lib/game/review";
import { FINAL } from "./fixtures";

process.env.ADMIN_PASSWORD = "correct horse";
const req = (body?: unknown, cookie = "") =>
  new Request("http://test/api", { method: "POST", headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
const lvl = (n: number) => ({ params: Promise.resolve({ n: String(n) }) });
async function player(nickname = "noa-fan") {
  const res = await session(req({ mode: "register", nickname, pin: "1234" }));
  return res.headers.get("set-cookie")!.split(";")[0]!;
}
const q = (content: string) => ({ messages: [{ role: "user", content }] });

beforeEach(() => { resetDbForTests(); resetLimitsForTests(); delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY; });

describe("Noa the tutor", () => {
  it("answers offline without an API key, explaining the command asked about", async () => {
    const c = await player();
    const res = await ask(req(q("מה עושה grep -c?"), c), lvl(1));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("offline");
    expect(body.answer).toContain("grep -c");
  });

  it("explains the task when the player is stuck", () => {
    const a = offlineAnswer(LEVELS[0]!, "אני לא מבינה מה צריך לעשות");
    expect(a).toContain(LEVELS[0]!.tldr);
    expect(a).toContain("head auth.log");
  });

  it("requires a session and keeps locked tasks locked", async () => {
    expect((await ask(req(q("היי")), lvl(1))).status).toBe(401);
    const c = await player();
    expect((await ask(req(q("היי"), c), lvl(5))).status).toBe(403);
    expect((await ask(req({ messages: [{ role: "assistant", content: "x" }] }, c), lvl(1))).status).toBe(400);
  });

  it("uses Claude when a key is set, and falls back when the API fails", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "נסו `grep Failed auth.log`" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = await player();
    const body = await (await ask(req({ ...q("איך מוצאים כישלונות?"), terminal: "$ ls\n  auth.log" }, c), lvl(2))).json().catch(() => null);
    // Level 2 is locked for a new player; ask on level 1 instead.
    expect(body?.error ?? "").not.toBe("");
    const ok = await (await ask(req({ ...q("איך מוצאים כישלונות?"), terminal: "$ ls\n  auth.log" }, c), lvl(1))).json();
    expect(ok).toEqual({ answer: "נסו `grep Failed auth.log`", source: "ai" });
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent.system).toContain(LEVELS[0]!.title);
    expect(sent.messages.at(-1).content).toContain("auth.log");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("overloaded", { status: 529 })));
    const fallback = await (await ask(req(q("מה זה לוג?"), c), lvl(1))).json();
    expect(fallback.source).toBe("offline");
  });

  it("uses Gemini when only a Gemini key is set, and falls back when the quota runs out", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "נסו `ls`" }] } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = await player();
    const ok = await (await ask(req(q("מאיפה מתחילים?"), c), lvl(1))).json();
    expect(ok).toEqual({ answer: "נסו `ls`", source: "ai" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(init.headers["x-goog-api-key"]).toBe("test-gemini");
    const sent = JSON.parse(init.body);
    expect(sent.system_instruction.parts[0].text).toContain(LEVELS[0]!.title);
    expect(sent.contents.at(-1).role).toBe("user");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    expect((await (await ask(req(q("מה זה לוג?"), c), lvl(1))).json()).source).toBe("offline");
  });

  it("never puts a challenge answer into the prompt", () => {
    for (const [n, [a, b]] of Object.entries(FINAL)) {
      // File names are on screen anyway; everything else must stay out.
      const p = systemPrompt(LEVELS[Number(n) - 1]!).replace(/^Files in their folder:.*$/m, "");
      expect(p).not.toContain(a);
      expect(p).not.toContain(b);
    }
  });

  it("cleans the chat history into alternating turns", () => {
    const h = cleanHistory([{ role: "assistant", content: "hi" }, { role: "user", content: "a" }, { role: "user", content: "b" }], "$ ls");
    expect(h).toHaveLength(1);
    expect(h[0]!.content).toMatch(/^a\n\nb\n\n\[What is on/);
  });

  it("shows the admin what players ask", async () => {
    const c = await player();
    await ask(req(q("מה זה sshd?"), c), lvl(1));
    const admin = (await adminLogin(req({ password: "correct horse" }))).headers.get("set-cookie")!.split(";")[0]!;
    const data = await (await overview(new Request("http://test/api", { headers: { cookie: admin } }))).json();
    expect(data.questions[0]).toMatchObject({ nickname: "noa-fan", level: 1, question: "מה זה sshd?", ai: false });
    expect(data.levels[0].questions).toBe(1);
    expect(data.tutorAi).toBe(false);
  });
});

describe("review", () => {
  it("splits commands out of a pipeline", () => {
    expect(commandsIn("grep -c Failed auth.log | sort -nr").map((e) => e.key)).toEqual(["|", "grep -c", "sort"]);
  });
  it("introduces each command once and repeats earlier ones", () => {
    expect(newCommands(LEVELS[0]!).map((e) => e.key)).toEqual(["head"]);
    expect(reviewCommands(LEVELS[1]!).map((e) => e.key)).toContain("head");
  });
  it("builds a recap quiz whose answer is always one of the options", () => {
    expect(stageQuiz(1)).toEqual([]);
    for (let room = 2; room <= 6; room++) for (const x of stageQuiz(room)) expect(x.options).toContain(x.answer);
  });
});

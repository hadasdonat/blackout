import { describe, expect, it } from "vitest";
import { describe as explain } from "@/lib/game/dictionary";
import { FACTS, ROOM_FILES } from "@/lib/game/evidence";
import { expandGlobs, runLine } from "@/lib/game/shell";

const ctx = (room: number) => ({ files: ROOM_FILES[room]!, history: [], secretFile: room === 1 ? ".shift_note" : ".draft" });
const out = (line: string, room = 1) => runLine(line, ctx(room)).lines.slice(1).map((l) => l.text);

describe("shell", () => {
  it("runs pipelines like a real terminal", () => {
    expect(out("grep -c Failed auth.log")).toEqual([String(FACTS.failCount)]);
    expect(out("grep Failed auth.log | wc -l")).toEqual([String(FACTS.failCount)]);
    const top = out("grep Failed auth.log | awk '{print $11}' | sort | uniq -c | sort -nr")[0]!;
    expect(top.trim().split(/\s+/)[1]).toBe(FACTS.topIp);
  });

  it("expands globs and prefixes file names when grepping several files", () => {
    expect(expandGlobs(["mail-*.eml"], ROOM_FILES[2]!)).toHaveLength(8);
    expect(out("grep spf=fail mail-*.eml | wc -l", 2)).toEqual(["2"]);
    expect(out("grep -l noctume mail-*.eml", 2)).toEqual(["mail-05.eml"]);
    expect(out("grep -c href mail-08.eml", 2)).toEqual(["1"]);
  });

  it("reports errors without throwing", () => {
    const r = runLine("rm -rf /", ctx(1));
    expect(r.lines.at(-1)?.kind).toBe("err");
    expect(runLine("cat nope.txt", ctx(1)).lines.at(-1)?.text).toContain("no such file");
    expect(runLine("echo hi > x", ctx(1)).lines.at(-1)?.text).toBe("evidence is read only");
  });

  it("turns game commands and the hidden file into actions", () => {
    expect(runLine("hint", ctx(1)).actions).toEqual([{ type: "hint" }]);
    expect(runLine("submit m.shani 1.2.3.4", ctx(1)).actions).toEqual([{ type: "submit", args: ["m.shani", "1.2.3.4"] }]);
    expect(runLine("cat .shift_note", ctx(1)).actions).toEqual([{ type: "secret", file: ".shift_note" }]);
    expect(out("ls")).not.toContain(".shift_note");
  });

  it("explains what a typed command does", () => {
    expect(explain("grep -c Failed auth.log")).toContain("סופרת");
    expect(explain("grep Failed auth.log | wc")).toContain("צינור של 2 פקודות");
  });
});

import { keyFor } from "@/lib/server/answers";
import { LEVELS } from "@/lib/game/levels";
import { PRACTICE } from "./fixtures";

describe("intel tools", () => {
  it("report reputation, registration, scans and file verdicts", () => {
    expect(out("iprep 203.0.113.140", 3).join("\n")).toMatch(/93 \/ 100[\s\S]*C2/);
    expect(out("iprep 10.9.9.9", 3).join("\n")).toContain("no reports");
    expect(out("whois sub.noctume-portal.example", 3)[1]).toContain("2026-10-28");
    expect(out("urlscan https://noctume-portal.example/login", 3).join("\n")).toContain("203.0.113.80");
    expect(out("vt invoice_2026.pdf.exe", 4).join("\n")).toContain("52 / 70");
    expect(out("sandbox invoice_2026.pdf.exe", 4).join("\n")).toContain("update-check.example");
    expect(out("grep %27 access.log | urldecode | head -1", 5)[0]).toContain("'");
  });

  it("accepts a sha256 prefix instead of a file name", () => {
    const sha = out("grep invoice downloads.txt", 4)[0]!.split(/\s+/)[2]!;
    expect(out(`vt ${sha.slice(0, 10)}`, 4).join("\n")).toContain("invoice_2026.pdf.exe");
  });
});

describe("every practice task is solvable from its own evidence", () => {
  for (const l of LEVELS.filter((x) => !x.final)) {
    it(`stage ${l.room} task ${l.idx}: the "show me" command reveals the answer`, () => {
      const k = keyFor(l.n)!;
      if (k.kind !== "practice") throw new Error("expected practice");
      const text = out(k.show, l.room).join("\n");
      const want = PRACTICE[l.n]!;
      const probe = l.n === 10 ? "2026-10-28" : l.n === 6 ? "2" : l.n === 22 ? "08:16:00" : want;
      expect(text).toContain(probe);
      expect(k.check(want)).toBe(true);
    });
  }
});

describe("every incident is solvable from its evidence", () => {
  const cases: [number, string, string[]][] = [
    [3, "grep 203.0.113.140 firewall.log", ["W11-RONEN"]],
    [4, "grep invoice process.log", ["parent=outlook.exe"]],
    [4, "grep powershell process.log", ["OneDriveSync"]],
    [5, "awk '{print $10, $9, $1}' access.log | sort -nr | head -1", ["203.0.113.141"]],
    [5, "grep 203.0.113.141 access.log | urldecode", ["FROM customers"]],
    [6, "grep FS-01 netflow.log | grep 445", ["W11-DANA"]],
    [6, "grep W11-DANA dns.log | tail -1", ["198.51.100.150"]],
  ];
  for (const [room, cmd, want] of cases) {
    it(`stage ${room}: ${cmd}`, () => { const text = out(cmd, room).join("\n"); for (const w of want) expect(text).toContain(w); });
  }
});

import { COMMANDS } from "./dictionary";
import type { Files } from "./evidence";
import { DOMAINS, FILES_INTEL, IPS, shaOf, URLS } from "./intel";

export type LineKind = "out" | "cmd" | "sys" | "err";
export interface Line { text: string; kind: LineKind }
export type Action =
  | { type: "clear" }
  | { type: "hint" }
  | { type: "submit"; args: string[] }
  | { type: "secret"; file: string };
export interface Result { lines: Line[]; actions: Action[] }

class ShellError extends Error {}
const MAX_LINES = 400;

/** Splits a command line into pipeline segments, honouring quotes. */
export function tokenize(line: string): string[][] {
  const parts: string[][] = [[]];
  let cur = "", quote = "", has = false;
  for (const c of line) {
    if (quote) { if (c === quote) quote = ""; else cur += c; }
    else if (c === '"' || c === "'") { quote = c; has = true; }
    else if (c === " " || c === "|") {
      if (cur || has) { parts.at(-1)!.push(cur); cur = ""; has = false; }
      if (c === "|") parts.push([]);
    } else cur += c;
  }
  if (cur || has) parts.at(-1)!.push(cur);
  return parts;
}

/** Expands `mail-*.eml` style arguments against the visible case files. */
export function expandGlobs(args: string[], files: Files): string[] {
  return args.flatMap((a) => {
    if (!a.includes("*")) return [a];
    const re = new RegExp(`^${a.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    const hits = Object.keys(files).filter((f) => !f.startsWith(".") && re.test(f)).sort();
    return hits.length ? hits : [a];
  });
}

function flags(args: string[], allowed: string) {
  const f: Record<string, boolean> = {};
  const rest: string[] = [];
  for (const a of args) {
    if (/^-[a-zA-Z]+$/.test(a)) {
      for (const ch of a.slice(1)) {
        if (!allowed.includes(ch)) throw new ShellError(`unsupported option -${ch}`);
        f[ch] = true;
      }
    } else rest.push(a);
  }
  return { f, rest };
}

function lineCount(args: string[]) {
  let n = 10;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "-n") n = parseInt(args[++i] ?? "", 10);
    else if (/^-\d+$/.test(a)) n = parseInt(a.slice(1), 10);
    else rest.push(a);
  }
  if (!(n >= 0)) throw new ShellError("invalid line count");
  return { n, rest };
}


function fileRecord(arg: string | undefined, cmd: string) {
  if (!arg) throw new ShellError(`usage: ${cmd} <file name or sha256>   e.g. ${cmd} invoice_2026.pdf.exe`);
  const q = arg.toLowerCase();
  const hit = Object.entries(FILES_INTEL).find(([sha, f]) => f.name.toLowerCase() === q || (q.length >= 6 && sha.startsWith(q)));
  if (!hit) throw new ShellError(`${cmd}: no report for ${arg}. Use a file name from downloads.txt or at least 6 characters of its sha256.`);
  return hit[1];
}

export interface ShellContext {
  files: Files;
  history: string[];
  secretFile?: string;
}

/** Runs one command line against the case files. Pure: no DOM, no network. */
export function runLine(raw: string, ctx: ShellContext): Result {
  const lines: Line[] = [];
  const actions: Action[] = [];
  const read = (name: string | undefined, input: string[] | null): string[] => {
    if (name === undefined) {
      if (input) return input;
      throw new ShellError("missing file name");
    }
    const file = ctx.files[name];
    if (!file) throw new ShellError(`${name}: no such file. Run ls to see the case files.`);
    if (name === ctx.secretFile) actions.push({ type: "secret", file: name });
    return file;
  };

  const cmds: Record<string, (a: string[], input: string[] | null) => string[]> = {
    help: () => [
      "ls [-a]  cat  head  tail  grep [-c -v -i -n -l -E]  awk  cut  sort  uniq -c  wc -l  urldecode",
      "intel tools: iprep <ip>  whois <domain>  urlscan <domain>  vt <file>  sandbox <file>",
      "Pipes and globs work:  grep From: mail-*.eml | wc -l",
      "man <command>   explain a command",
      "hint            get a hint for this stage",
      "submit A B      send your finding in the incident stage",
      "המילון המלא נמצא בלשונית \"מילון\" שבצד.",
    ],
    man: (a) => {
      const q = a.join(" ");
      const d = COMMANDS.find((x) => x.key === q) ?? COMMANDS.find((x) => x.key === a[0]);
      if (!d) throw new ShellError(`man: no entry for ${q}. Open the dictionary tab.`);
      return [`${d.show} · ${d.desc}`, ...(d.ex ? [`example: ${d.ex}`] : [])];
    },
    ls: (a) => { const { f } = flags(a, "al"); return Object.keys(ctx.files).filter((n) => f.a || !n.startsWith(".")).sort(); },
    cat: (a, input) => (a.length ? a.flatMap((n) => read(n, null)) : read(undefined, input)),
    head: (a, input) => { const { n, rest } = lineCount(a); return read(rest[0], input).slice(0, n); },
    tail: (a, input) => { const { n, rest } = lineCount(a); return n ? read(rest[0], input).slice(-n) : []; },
    grep: (a, input) => {
      const { f, rest } = flags(a, "ivcnElh");
      const pat = rest[0];
      if (pat === undefined) throw new ShellError("usage: grep TEXT FILE");
      let test: (l: string) => boolean;
      if (f.E) {
        let re: RegExp;
        try { re = new RegExp(pat, f.i ? "i" : ""); } catch { throw new ShellError(`invalid pattern: ${pat}`); }
        test = (l) => re.test(l);
      } else {
        const needle = f.i ? pat.toLowerCase() : pat;
        test = (l) => (f.i ? l.toLowerCase() : l).includes(needle);
      }
      const names = rest.slice(1);
      const sources: [string | null, string[]][] = names.length ? names.map((n) => [n, read(n, null)]) : [[null, read(undefined, input)]];
      const prefix = names.length > 1 && !f.h;
      const out: string[] = [];
      for (const [name, body] of sources) {
        const hits: string[] = [];
        body.forEach((l, i) => { if (test(l) !== !!f.v) hits.push(`${prefix ? `${name}:` : ""}${f.n ? `${i + 1}:` : ""}${l}`); });
        if (f.l) { if (hits.length) out.push(name ?? "(standard input)"); }
        else if (f.c) out.push(`${prefix ? `${name}:` : ""}${hits.length}`);
        else out.push(...hits);
      }
      return out;
    },
    wc: (a, input) => { const { rest } = flags(a, "l"); return [String(read(rest[0], input).length)]; },
    sort: (a, input) => {
      const { f, rest } = flags(a, "nru");
      const res = [...read(rest[0], input)];
      if (f.n) res.sort((x, y) => parseFloat(x) - parseFloat(y)); else res.sort();
      if (f.r) res.reverse();
      return f.u ? res.filter((l, i) => l !== res[i - 1]) : res;
    },
    uniq: (a, input) => {
      const { f, rest } = flags(a, "c");
      const groups: { l: string; n: number }[] = [];
      for (const l of read(rest[0], input)) {
        const last = groups.at(-1);
        if (last && last.l === l) last.n++; else groups.push({ l, n: 1 });
      }
      return groups.map((g) => (f.c ? `${String(g.n).padStart(7)} ${g.l}` : g.l));
    },
    cut: (a, input) => {
      let d = "\t", field: string | undefined;
      const rest: string[] = [];
      for (let i = 0; i < a.length; i++) {
        const x = a[i]!;
        if (x === "-d") d = a[++i] ?? ""; else if (x.startsWith("-d")) d = x.slice(2);
        else if (x === "-f") field = a[++i]; else if (x.startsWith("-f")) field = x.slice(2);
        else rest.push(x);
      }
      if (!field || !d) throw new ShellError("usage: cut -d ' ' -f N");
      const idx = field.split(",").map(Number);
      return read(rest[0], input).map((l) => { const p = l.split(d); return idx.map((i) => p[i - 1] ?? "").join(d); });
    },
    awk: (a, input) => {
      const m = /^\{\s*print\s+(.+?)\s*\}$/.exec(a[0] ?? "");
      const fields = m ? m[1]!.split(/[\s,]+/).map((x) => parseInt(x.replace("$", ""), 10)) : [];
      if (!m || fields.some(Number.isNaN)) throw new ShellError("only awk '{print $N}' is available here");
      return read(a[1], input).map((l) => { const p = l.trim().split(/\s+/); return fields.map((n) => (n === 0 ? l : p[n - 1] ?? "")).join(" "); });
    },

    iprep: (a) => {
      const ip = a[0];
      if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new ShellError("usage: iprep <IP address>   e.g. iprep 198.51.100.23");
      const r = IPS[ip];
      if (!r) return [`IP reputation for ${ip}`, "  risk score : 0 / 100", "  reports    : 0", "  verdict    : no reports found"];
      const verdict = r.score >= 75 ? "MALICIOUS: block it" : r.score >= 25 ? "SUSPICIOUS: check the context" : "CLEAN";
      return [`IP reputation for ${ip}`, `  risk score : ${r.score} / 100`, `  country    : ${r.country}`, `  provider   : ${r.isp}`, `  reports    : ${r.reports}`, `  known for  : ${r.usage}`, `  verdict    : ${verdict}`];
    },
    whois: (a) => {
      const d = (a[0] ?? "").toLowerCase().replace(/^[a-z]+:\/\//, "").split("/")[0]!;
      if (!d) throw new ShellError("usage: whois <domain>   e.g. whois nocturne.example");
      const base = Object.keys(DOMAINS).filter((k) => d === k || d.endsWith(`.${k}`)).sort((x, y) => y.length - x.length)[0];
      if (!base) return [`whois ${d}`, "  no record found"];
      const r = DOMAINS[base]!;
      return [`whois ${base}`, `  created    : ${r.created}`, `  registrar  : ${r.registrar}`, `  owner      : ${r.owner}`];
    },
    urlscan: (a) => {
      const d = (a[0] ?? "").toLowerCase().replace(/^[a-z]+:\/\//, "").split("/")[0]!;
      if (!d) throw new ShellError("usage: urlscan <domain or URL>");
      const r = URLS[d];
      if (!r) return [`urlscan ${d}`, "  no scan available for this address"];
      return [`urlscan ${d}`, `  page title : ${r.title}`, `  hosted on  : ${r.ip}`, `  verdict    : ${r.verdict.toUpperCase()}`, ...r.summary.map((x) => `  - ${x}`)];
    },
    vt: (a) => {
      const f = fileRecord(a[0], "vt");
      return [`VirusTotal-style report for ${f.name}`, `  sha256     : ${shaOf(f.name)}`, `  detections : ${f.detections} / ${f.engines} engines`, `  family     : ${f.family}`, `  first seen : ${f.firstSeen}`, `  size       : ${f.size}`];
    },
    sandbox: (a) => {
      const f = fileRecord(a[0], "sandbox");
      return [`Sandbox report for ${f.name}: what it did when we ran it in isolation`, ...f.sandbox.map((x) => `  ${x}`)];
    },
    urldecode: (a, input) => read(a[0], input).map((l) => l.replace(/%([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))),
    pwd: () => ["/home/analyst/case"],
    whoami: () => ["analyst"],
    history: () => ctx.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`),
    echo: (a) => [a.join(" ")],
  };
  const refuse = (msg: string) => () => { throw new ShellError(msg); };
  Object.assign(cmds, {
    less: cmds.cat, more: cmds.cat,
    cd: refuse("this station is locked to the case folder"),
    sudo: refuse("analyst is not in the sudoers file. This incident will be reported. Yes, to you."),
    rm: refuse("מחיקה היא התוכנית של התוקף, לא שלכם."),
    ssh: refuse("network tools are disabled on this station"), curl: refuse("network tools are disabled on this station"),
    ping: refuse("network tools are disabled on this station"), nmap: refuse("network tools are disabled on this station"),
    vi: refuse("evidence is read only"), vim: refuse("evidence is read only"), nano: refuse("evidence is read only"),
  });

  const line = raw.trim();
  lines.push({ text: `$ ${line}`, kind: "cmd" });
  if (!line) return { lines, actions };
  try {
    if (/(^|\s)>>?(\s|$)/.test(line.replace(/"[^"]*"|'[^']*'/g, ""))) throw new ShellError("evidence is read only");
    let data: string[] | null = null;
    const pipeline = tokenize(line);
    for (let i = 0; i < pipeline.length; i++) {
      const [name, ...rawArgs] = pipeline[i]!;
      if (!name) throw new ShellError("syntax error near |");
      if (name === "clear") return { lines: [], actions: [{ type: "clear" }] };
      if (name === "hint") { actions.push({ type: "hint" }); data = null; continue; }
      if (name === "submit") { actions.push({ type: "submit", args: rawArgs }); data = null; continue; }
      if (name === "exit") throw new ShellError("אי אפשר לעזוב את המשמרת באמצע אירוע.");
      const cmd = cmds[name];
      if (!cmd) throw new ShellError(`${name}: command not found. Run help, or open the dictionary tab.`);
      const args = name === "awk" ? rawArgs : expandGlobs(rawArgs, ctx.files);
      data = cmd(args, i > 0 ? data ?? [] : null);
    }
    for (const l of (data ?? []).slice(0, MAX_LINES)) lines.push({ text: l, kind: "out" });
    if (data && data.length > MAX_LINES) lines.push({ text: `... ${data.length - MAX_LINES} more lines. Narrow it down with grep.`, kind: "sys" });
  } catch (e) {
    if (!(e instanceof ShellError)) throw e;
    lines.push({ text: e.message, kind: "err" });
  }
  return { lines, actions };
}

export function completeWord(value: string, files: Files): string | null {
  const m = /(\S*)$/.exec(value)!;
  const word = m[1]!;
  if (!word) return null;
  const pool = value.includes(" ") ? Object.keys(files) : ["ls", "cat", "head", "tail", "grep", "awk", "cut", "sort", "uniq", "wc", "man", "history", "clear", "hint", "submit", "help", "iprep", "whois", "urlscan", "vt", "sandbox", "urldecode"];
  const hits = pool.filter((x) => x.startsWith(word));
  return hits.length === 1 ? value.slice(0, m.index) + hits[0] + " " : null;
}

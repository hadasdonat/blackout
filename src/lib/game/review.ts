import { COMMANDS, type Entry } from "./dictionary";
import { LEVELS, type Level } from "./levels";

/** The dictionary entries a command line uses, e.g. "grep -c x f | sort -nr" → grep -c, |, sort. */
export function commandsIn(line: string): Entry[] {
  const out: Entry[] = [];
  const add = (e?: Entry) => { if (e && !out.includes(e)) out.push(e); };
  const parts = line.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) add(COMMANDS.find((c) => c.key === "|"));
  if (/\S\*\S|\*\.\w/.test(line)) add(COMMANDS.find((c) => c.key === "*"));
  for (const p of parts) {
    const [word, flag] = p.split(/\s+/);
    add(COMMANDS.find((c) => flag && c.key === `${word} ${flag}`) ?? COMMANDS.find((c) => c.key === word));
  }
  return out;
}

const learnedBy = new Map<number, Entry[]>();
const seen = new Set<Entry>();
for (const l of LEVELS) {
  const fresh: Entry[] = [];
  for (const [cmd] of l.chips) for (const e of commandsIn(cmd)) if (!seen.has(e)) { seen.add(e); fresh.push(e); }
  learnedBy.set(l.n, fresh);
}

/** Commands this task introduces for the first time. */
export const newCommands = (l: Level) => learnedBy.get(l.n) ?? [];

/** Commands from earlier tasks, most recent first: the ones worth repeating now. */
export function reviewCommands(l: Level, max = 6): Entry[] {
  const out: Entry[] = [];
  for (let n = l.n - 1; n >= 1 && out.length < max; n--) for (const e of learnedBy.get(n) ?? []) if (out.length < max && !out.includes(e)) out.push(e);
  return out;
}

/** Every command a whole stage introduced, for the end-of-stage summary. */
export const stageCommands = (room: number) => LEVELS.filter((l) => l.room === room).flatMap((l) => learnedBy.get(l.n) ?? []);

export interface QuizQ { prompt: string; options: string[]; answer: string }

/** Three quick "which command does this?" questions about the previous stage. */
export function stageQuiz(room: number): QuizQ[] {
  if (room < 2) return [];
  const pool = LEVELS.filter((l) => l.room < room).flatMap((l) => learnedBy.get(l.n) ?? []).filter((e) => e.key !== "|" && e.key !== "*");
  const targets = stageCommands(room - 1).filter((e) => e.key !== "|" && e.key !== "*").slice(0, 3);
  let seed = room * 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return targets.map((t) => {
    const others = pool.filter((e) => e !== t && e.show !== t.show).sort(() => rnd() - 0.5).slice(0, 2);
    const options = [t, ...others].map((e) => e.show).sort(() => rnd() - 0.5);
    return { prompt: t.desc, options, answer: t.show };
  });
}

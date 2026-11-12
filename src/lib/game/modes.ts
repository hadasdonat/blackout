import { LEVELS, type Level } from "./levels";

/**
 * Three ways to play. Each mode keeps its own progress, stars and leaderboard,
 * so a beginner and an expert never compete on the same table.
 */
export type ModeId = "beginner" | "intermediate" | "expert";

export interface Mode {
  id: ModeId;
  name: string;
  icon: string;
  pitch: string;
  rules: string[];
  /** Level numbers in play order. */
  levels: number[];
  /** Multiplies every challenge clock. */
  clock: number;
  /** Multiplies the time lost for a wrong answer or a hint. */
  penalty: number;
  hints: boolean;
  /** Practice hints cost no stars. */
  freeHints: boolean;
}

export const MODES: Record<ModeId, Mode> = {
  beginner: {
    id: "beginner", name: "מתחילים", icon: "🌱",
    pitch: "פעם ראשונה בטרמינל? מתחילים כאן.",
    rules: ["כל 24 המשימות, עם הסבר מלא לכל אחת", "פי 2 זמן באתגרים, וחצי עונש על טעות", "רמזים בלי לאבד כוכבים במשימות התרגול"],
    levels: LEVELS.map((l) => l.n), clock: 2, penalty: 0.5, hints: true, freeHints: true,
  },
  intermediate: {
    id: "intermediate", name: "בינוניים", icon: "⚡",
    pitch: "כבר מכירים קצת? הקצב הרגיל של המשחק.",
    rules: ["כל 24 המשימות", "שעון רגיל באתגרים", "רמזים זמינים, אבל עולים כוכבים וזמן"],
    levels: LEVELS.map((l) => l.n), clock: 1, penalty: 1, hints: true, freeHints: false,
  },
  expert: {
    id: "expert", name: "מומחים", icon: "🔥",
    pitch: "רק ששת אתגרי הסיום, בלי הסברים ובלי רמזים.",
    rules: ["6 אתגרים, אחד לכל נושא", "60% מהזמן, ועונש כפול על טעות", "בלי רמזים. רק אתם, הטרמינל ונועה"],
    levels: LEVELS.filter((l) => l.final).map((l) => l.n), clock: 0.6, penalty: 2, hints: false, freeHints: false,
  },
};

export const MODE_IDS = Object.keys(MODES) as ModeId[];
export const isMode = (v: unknown): v is ModeId => typeof v === "string" && v in MODES;
export const modeLevels = (m: ModeId): Level[] => MODES[m].levels.map((n) => LEVELS[n - 1]!);

/** The level that must be finished before `n` opens in this mode, or null for the first one. */
export function previousLevel(m: ModeId, n: number): number | null {
  const list = MODES[m].levels;
  const i = list.indexOf(n);
  return i > 0 ? list[i - 1]! : null;
}
export const nextLevel = (m: ModeId, n: number): number | null => {
  const list = MODES[m].levels;
  const i = list.indexOf(n);
  return i >= 0 && i < list.length - 1 ? list[i + 1]! : null;
};

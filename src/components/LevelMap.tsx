"use client";

import { LEVELS, STAGE_COUNT, STAGE_NAMES } from "@/lib/game/levels";
import type { Progress } from "@/lib/client/api";

const XS = [180, 286, 180, 74];
const GAP = 120, STAGE_GAP = 70, TOP = 100;

export function LevelMap({ progress, onOpen }: { progress: Progress; onOpen: (n: number) => void }) {
  const pts = LEVELS.map((l, k) => [XS[k % 4]!, TOP + k * GAP + (l.room - 1) * STAGE_GAP] as const);
  const trophyY = pts.at(-1)![1] + 150;
  const H = trophyY + 70;
  const seg = (a: readonly number[], b: readonly number[]) => ` C ${a[0]} ${a[1]! + 65}, ${b[0]} ${b[1]! - 65}, ${b[0]} ${b[1]}`;
  let all = `M ${pts[0]![0]} ${pts[0]![1]}`, done = all;
  const doneCount = LEVELS.filter((l) => progress[l.n]).length;
  for (let k = 1; k < pts.length; k++) {
    all += seg(pts[k - 1]!, pts[k]!);
    if (k < doneCount + 1 && progress[LEVELS[k - 1]!.n]) done += seg(pts[k - 1]!, pts[k]!);
  }
  all += seg(pts.at(-1)!, [180, trophyY]);
  const at = (x: number, y: number) => ({ left: `${(x / 360) * 100}%`, top: `${(y / H) * 100}%` });
  const allDone = doneCount === LEVELS.length;

  return (
    <div className="map">
      <svg viewBox={`0 0 360 ${H}`} aria-hidden="true">
        <path className="trail" d={all} />
        <path className="trail-todo" d={all} />
        {doneCount > 0 && <path className="trail-done" d={done} />}
      </svg>
      {Array.from({ length: STAGE_COUNT }, (_, s) => {
        const first = LEVELS.findIndex((l) => l.room === s + 1);
        const stageDone = LEVELS.filter((l) => l.room === s + 1).every((l) => progress[l.n]);
        return (
          <span key={s} className={`roomtag${stageDone ? " done" : ""}`} style={at(180, pts[first]![1] - 62)}>
            שלב {s + 1}: {STAGE_NAMES[s + 1]}{stageDone ? " ✓" : ""}
          </span>
        );
      })}
      {LEVELS.map((l, k) => {
        const rec = progress[l.n], open = l.n === 1 || !!progress[l.n - 1];
        const cls = `node${l.final ? " boss" : ""}${rec ? " done" : open ? " open" : " locked"}`;
        return (
          <button key={l.n} className={cls} type="button" disabled={!open} style={{ ...at(pts[k]![0], pts[k]![1]), animationDelay: `${Math.min(k, 12) * 40}ms` }} onClick={() => onOpen(l.n)}
            aria-label={`שלב ${l.room} משימה ${l.idx}: ${l.title}${rec ? `, הושלמה עם ${rec.stars} כוכבים` : open ? ", פתוחה" : ", נעולה"}`}>
            <span className="disc" aria-hidden="true">{open || rec ? (l.final ? "!" : l.idx) : "🔒"}</span>
            <span className="name">{l.title}</span>
            <span className="stars" aria-hidden="true">{[1, 2, 3].map((s) => (rec && rec.stars >= s ? <b key={s}>★</b> : <span key={s}>★</span>))}</span>
          </button>
        );
      })}
      <div className={`trophy${allDone ? " won" : ""}`} style={at(180, trophyY)}>
        <span className="disc" aria-hidden="true">🏆</span>
        <span className="name">{allDone ? "אנליסט SOC: כל ששת השלבים!" : "סיימו את כל ששת השלבים"}</span>
      </div>
    </div>
  );
}

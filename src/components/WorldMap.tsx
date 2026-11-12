"use client";

import type { Progress } from "@/lib/client/api";
import { STAGE_COUNT, STAGE_NAMES } from "@/lib/game/levels";
import { modeLevels, previousLevel, type ModeId } from "@/lib/game/modes";

const ICONS = ["", "📜", "🎣", "🛰️", "🦠", "🌐", "🔐"];

export const isOpen = (mode: ModeId, progress: Progress, n: number) => { const p = previousLevel(mode, n); return p === null || !!progress[p]; };

/**
 * The desktop map: six worlds, one per topic, laid out to fill a wide screen.
 * Phones get the vertical trail in LevelMap instead.
 */
export function WorldMap({ mode, progress, onOpen }: { mode: ModeId; progress: Progress; onOpen: (n: number) => void }) {
  const levels = modeLevels(mode);
  return (
    <div className="worlds">
      {Array.from({ length: STAGE_COUNT }, (_, s) => {
        const room = s + 1;
        const list = levels.filter((l) => l.room === room);
        const done = list.filter((l) => progress[l.n]).length;
        const unlocked = list.some((l) => isOpen(mode, progress, l.n));
        const current = unlocked && done < list.length;
        const stars = list.reduce((a, l) => a + (progress[l.n]?.stars ?? 0), 0);
        return (
          <section key={room} className={`world${done === list.length ? " cleared" : current ? " current" : unlocked ? "" : " sealed"}`} style={{ ["--i" as string]: s }} aria-label={`שלב ${room}: ${STAGE_NAMES[room]}`}>
            <header>
              <span className="world-icon" aria-hidden="true">{ICONS[room]}</span>
              <div>
                <span className="world-num">שלב {room}</span>
                <h3>{STAGE_NAMES[room]}</h3>
              </div>
              <span className="world-score">{stars}<b>★</b></span>
            </header>
            <div className={`world-path${list.length === 1 ? " solo" : ""}`}>
              {list.map((l, k) => {
                const rec = progress[l.n], open = isOpen(mode, progress, l.n);
                return (
                  <button key={l.n} type="button" disabled={!open} onClick={() => onOpen(l.n)}
                    className={`wnode${l.final ? " boss" : ""}${rec ? " done" : open ? " open" : " locked"}`} style={{ ["--k" as string]: k }}
                    aria-label={`${l.title}${rec ? `, הושלמה עם ${rec.stars} כוכבים` : open ? ", פתוחה" : ", נעולה"}`}>
                    <span className="disc" aria-hidden="true">{open || rec ? (l.final ? "!" : l.idx) : "🔒"}</span>
                    <span className="name">{l.final && list.length > 1 ? "אתגר" : l.title}</span>
                    <span className="stars" aria-hidden="true">{[1, 2, 3].map((x) => (rec && rec.stars >= x ? <b key={x}>★</b> : <span key={x}>★</span>))}</span>
                  </button>
                );
              })}
            </div>
            <footer>
              <span className="bar" aria-hidden="true"><i style={{ width: `${(done / list.length) * 100}%` }} /></span>
              <small>{done === list.length ? "הושלם ✓" : unlocked ? `${done}/${list.length} משימות` : `נפתח אחרי שלב ${room - 1}`}</small>
            </footer>
          </section>
        );
      })}
    </div>
  );
}

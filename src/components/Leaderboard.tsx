"use client";

import { useEffect, useState } from "react";
import { api, type Board } from "@/lib/client/api";
import { mmss } from "@/lib/client/format";
import { MODE_IDS, MODES, type ModeId } from "@/lib/game/modes";

/** One table per difficulty, so beginners never compete with experts. */
export function Leaderboard({ initial, meId, onClose }: { initial: ModeId; meId?: string; onClose: () => void }) {
  const [mode, setMode] = useState<ModeId>(initial);
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => { setBoard(null); api<Board>(`/api/leaderboard?mode=${mode}`).then(setBoard).catch(() => {}); }, [mode]);
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="boardTitle" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div>
        <div className="actions spread">
          <h2 id="boardTitle" className="amber">טבלת המובילים</h2>
          <button className="ghost" type="button" onClick={onClose} autoFocus>סגירה</button>
        </div>
        <div className="seg" role="tablist" aria-label="רמה">
          {MODE_IDS.map((m) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>{MODES[m].icon} {MODES[m].name}</button>)}
        </div>
        <p className="label">מדורגים לפי משימות שהושלמו, אחר כך כוכבים, ובשוויון מי שסיים הכי מהר.</p>
        {!board ? <p className="label">טוען...</p> : (
          <div className="tablewrap">
            <table className="board">
              <thead><tr><th>#</th><th>שם</th><th>משימות</th><th>כוכבים</th><th>זמן כולל</th></tr></thead>
              <tbody>
                {board.rows.map((r, i) => (
                  <tr key={r.id} className={r.id === meId ? "mine" : ""}>
                    <td className="medal">{["🥇", "🥈", "🥉"][i] ?? i + 1}</td>
                    <td>{r.nickname}{r.id === meId ? " (אתם)" : ""}</td>
                    <td>{r.done}/{board.levels}</td>
                    <td className="st">{r.stars}★</td>
                    <td className="num">{mmss(r.totalMs)}</td>
                  </tr>
                ))}
                {!board.rows.length && <tr><td colSpan={5} className="label">עוד אין שחקנים ברמה הזו. תהיו הראשונים!</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

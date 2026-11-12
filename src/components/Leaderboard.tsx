"use client";

import type { Board } from "@/lib/client/api";
import { mmss } from "@/lib/client/format";

export function Leaderboard({ board, meId, onClose }: { board: Board | null; meId?: string; onClose: () => void }) {
  return (
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="boardTitle" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div>
        <div className="actions spread">
          <h2 id="boardTitle" className="amber">טבלת המובילים</h2>
          <button className="ghost" type="button" onClick={onClose} autoFocus>סגירה</button>
        </div>
        <p className="label">מדורגים לפי שלבים שהושלמו, אחר כך כוכבים, ובשוויון מי שסיים הכי מהר.</p>
        {!board ? <p className="label">טוען...</p> : (
          <div className="tablewrap">
            <table className="board">
              <thead><tr><th>#</th><th>שם</th><th>שלבים</th><th>כוכבים</th><th>זמן כולל</th></tr></thead>
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

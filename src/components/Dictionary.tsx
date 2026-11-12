"use client";

import { useState } from "react";
import { COMMANDS, TERMS } from "@/lib/game/dictionary";

export function Dictionary({ room, onTry }: { room: number; onTry: (cmd: string) => void }) {
  const [q, setQ] = useState("");
  const match = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());
  return (
    <>
      <p className="label">כל מה שצריך במעבדה. לחצו "נסו" כדי להריץ דוגמה בטרמינל.</p>
      <input className="dict-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש פקודה או מונח" aria-label="חיפוש במילון" />
      <h3 className="dict-h">פקודות</h3>
      <ul className="dict">
        {COMMANDS.filter((d) => match(`${d.show} ${d.desc}`)).map((d) => (
          <li key={d.key}>
            <code>{d.show}</code>
            {d.ex && (!d.room || d.room === room) ? <button className="ghost" type="button" onClick={() => onTry(d.ex!)}>נסו</button> : <span />}
            <p>{d.desc}</p>
            {d.ex && <pre>{d.ex}</pre>}
          </li>
        ))}
      </ul>
      <h3 className="dict-h">מונחים</h3>
      <ul className="dict">
        {TERMS.filter((d) => match(`${d.show} ${d.desc}`)).map((d) => (
          <li key={d.key}><code>{d.show}</code><span /><p>{d.desc}</p></li>
        ))}
      </ul>
    </>
  );
}

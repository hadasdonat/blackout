"use client";

import { useId, useState } from "react";
import { PASSWORD_MAX, passwordChecks } from "@/lib/game/password";

/** A new-password input with a show/hide toggle and a live checklist of the rules. */
export function PasswordField({ id, label, value, onChange, nickname }: { id: string; label: string; value: string; onChange: (v: string) => void; nickname: string }) {
  const [show, setShow] = useState(false);
  const listId = useId();
  const checks = passwordChecks(value, nickname);
  const passed = checks.filter((c) => c.ok).length;
  return (
    <div className="field pw">
      <label htmlFor={id}>{label}</label>
      <div className="pw-row">
        <input id={id} type={show ? "text" : "password"} value={value} maxLength={PASSWORD_MAX} onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password" aria-describedby={listId} spellCheck={false} autoCapitalize="off" />
        <button type="button" className="pw-eye" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"}>{show ? "הסתרה" : "הצגה"}</button>
      </div>
      <div className={`pw-meter s${value ? passed : 0}`} aria-hidden="true"><i /><i /><i /><i /></div>
      <ul className="pw-rules" id={listId}>
        {checks.map((c) => <li key={c.id} className={c.ok ? "ok" : ""}>{c.ok ? "✓" : "•"} {c.label}</li>)}
      </ul>
    </div>
  );
}

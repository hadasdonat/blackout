"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import { PasswordField } from "./PasswordField";

/** Change-password form. On success the server signs out every other device. */
export function Account({ nickname, onDone }: { nickname: string; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api("/api/password", { current, next });
      setMsg({ ok: true, text: "הסיסמה עודכנה. כל המכשירים האחרים נותקו." });
      setCurrent(""); setNext("");
      setTimeout(onDone, 1400);
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    finally { setBusy(false); }
  }

  return (
    <form className="account" onSubmit={submit} noValidate>
      <h3>שינוי סיסמה</h3>
      <div className="field">
        <label htmlFor="cur">הסיסמה או הקוד הנוכחיים</label>
        <input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </div>
      <PasswordField id="newpw" label="סיסמה חדשה" value={next} onChange={setNext} nickname={nickname} />
      <div className="actions">
        <button className="primary" type="submit" disabled={busy || !current || !next}>{busy ? "רגע..." : "שמירת הסיסמה"}</button>
        <button className="ghost" type="button" onClick={onDone}>ביטול</button>
      </div>
      {msg && <p className={`feedback ${msg.ok ? "ok" : "no"}`} role="status">{msg.text}</p>}
    </form>
  );
}

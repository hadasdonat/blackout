"use client";

import { useState } from "react";
import { api, type Me } from "@/lib/client/api";

export function Intro({ onReady }: { onReady: (me: Me) => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try { onReady(await api<Me>("/api/session", { mode, nickname, pin })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className="intro">
      <h2 className="title">BLACKOUT</h2>
      <p className="lead">לומדים סייבר מאפס, בטרמינל, בקצב שלכם. לא צריך שום ידע קודם.</p>
      <p>שישה שלבים, כל אחד בנושא אחר ומהקל לקשה: לוגים, פישינג, מודיעין איומים, קובץ חשוד, התקפות על אתרים וכופרה. בכל שלב לומדים כמה פקודות חדשות, מתרגלים אותן, וחוזרים על מה שכבר למדתם.</p>
      <p>נועה, המורה שלכם, מסבירה כל מילה וכל פקודה. נתקעתם? שואלים אותה בצ'אט, כמה שרוצים.</p>
      <ol className="learn">
        <li><b>לומדים</b>הסבר קצר ופשוט לכל נושא ולכל פקודה, מהבסיס.</li>
        <li><b>מתרגלים וחוזרים</b>תרגיל בטרמינל אחרי כל הסבר, חזרה מהירה בתחילת כל שלב, ונועה עונה על כל שאלה.</li>
        <li><b>אתגר</b>בסוף כל שלב, אתגר שמשלב את כל הפקודות שלמדתם. מקבלים כוכבים ותעודה לשיתוף בלינקדאין.</li>
      </ol>
      <form className="card join" onSubmit={submit} noValidate>
        <div className="seg" role="tablist" aria-label="סוג כניסה">
          <button type="button" role="tab" aria-selected={mode === "register"} aria-pressed={mode === "register"} onClick={() => setMode("register")}>שחקן חדש</button>
          <button type="button" role="tab" aria-selected={mode === "login"} aria-pressed={mode === "login"} onClick={() => setMode("login")}>כבר שיחקתי</button>
        </div>
        <div className="join-row">
          <div className="field">
            <label htmlFor="nick">השם שיופיע בטבלה ובתעודה</label>
            <input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="למשל: הדס" />
          </div>
          <div className="field pin">
            <label htmlFor="pin">{mode === "register" ? "בחרו קוד של 4 ספרות" : "הקוד שלכם"}</label>
            <input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="••••" />
          </div>
          <button className="primary" type="submit" disabled={busy}>{busy ? "רגע..." : mode === "register" ? "מתחילים ללמוד" : "ממשיכים מאיפה שעצרתי"}</button>
        </div>
        <p className="label">הקוד מאפשר לחזור להתקדמות שלכם ממכשיר אחר. אנחנו שומרים רק את השם, הקוד המוצפן, התוצאות והשאלות לנועה (כדי לשפר את השלבים).</p>
        {error && <p className="feedback no" role="alert">{error}</p>}
      </form>
    </main>
  );
}

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
      <p className="lead">חדר בריחה בסייבר. לא צריך ידע קודם: כל מה שצריך מוסבר בדרך.</p>
      <p>אתם אנליסטים חדשים בחדר הבקרה של נוקטורן דאטה, חברה בדיונית. מחכים לכם שישה שלבים, כל אחד בנושא אחר ומהקל לקשה: לוגים, פישינג, מודיעין איומים, קובץ חשוד, התקפות על אתרים וכופרה.</p><p>כל שלב בנוי מארבע משימות. בשלוש הראשונות נועה, ראש המשמרת, מסבירה ומתרגלת איתכם. ברביעית מגיעה התראה אמיתית, ותצטרכו לפתור אותה לבד נגד השעון.</p>
      <ol className="learn">
        <li><b>לומדים</b>הסבר קצר ופשוט על כל נושא, מהבסיס.</li>
        <li><b>מתרגלים</b>תרגיל בטרמינל אחרי כל הסבר, עם רמזים כשנתקעים.</li>
        <li><b>מתחרים</b>כוכבים, תעודה על כל משימה וטבלת מובילים. רק מי שעובר את כל השישה מקבל את תעודת האנליסט.</li>
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
          <button className="primary" type="submit" disabled={busy}>{busy ? "רגע..." : mode === "register" ? "יוצאים למשמרת" : "ממשיכים מאיפה שעצרתי"}</button>
        </div>
        <p className="label">הקוד מאפשר לחזור להתקדמות שלכם ממכשיר אחר. אנחנו שומרים רק את השם, הקוד המוצפן והתוצאות.</p>
        {error && <p className="feedback no" role="alert">{error}</p>}
      </form>
    </main>
  );
}

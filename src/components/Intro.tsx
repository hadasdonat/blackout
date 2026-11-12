"use client";

import { useState } from "react";
import { api, type Me } from "@/lib/client/api";
import type { ModeId } from "@/lib/game/modes";
import { passwordProblem } from "@/lib/game/password";
import { ModePicker } from "./ModePicker";
import { PasswordField } from "./PasswordField";

export function Intro({ onReady }: { onReady: (me: Me) => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [level, setLevel] = useState<ModeId>("beginner");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register") {
      const problem = passwordProblem(password, nickname);
      if (problem) { setError(`הסיסמה צריכה: ${problem}`); return; }
    }
    setBusy(true);
    try { onReady(await api<Me>("/api/session", { mode, nickname, password, ...(mode === "register" ? { level } : {}) })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <main className="intro">
      <section className="hero">
        <h2 className="title">BLACKOUT</h2>
        <p className="lead">לומדים סייבר מאפס, בטרמינל, בקצב שלכם. לא צריך שום ידע קודם.</p>
        <p>שישה שלבים, כל אחד בנושא אחר ומהקל לקשה: לוגים, פישינג, מודיעין איומים, קובץ חשוד, התקפות על אתרים וכופרה. בכל שלב לומדים כמה פקודות חדשות, מתרגלים אותן, וחוזרים על מה שכבר למדתם.</p>
        <p>נועה, המורה שלכם, מסבירה כל מילה וכל פקודה. נתקעתם? שואלים אותה בצ&apos;אט, כמה שרוצים.</p>
        <ol className="learn">
          <li><b>לומדים</b>הסבר קצר ופשוט לכל נושא ולכל פקודה, מהבסיס.</li>
          <li><b>מתרגלים וחוזרים</b>תרגיל בטרמינל אחרי כל הסבר, חזרה מהירה בתחילת כל שלב, ונועה עונה על כל שאלה.</li>
          <li><b>אתגר</b>בסוף כל שלב, אתגר שמשלב את כל הפקודות שלמדתם. מקבלים כוכבים ותעודה לשיתוף בלינקדאין.</li>
        </ol>
      </section>

      <form className="card join" onSubmit={submit} noValidate>
        <div className="seg" role="tablist" aria-label="סוג כניסה">
          <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => { setMode("register"); setError(""); }}>שחקן חדש</button>
          <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(""); }}>כבר שיחקתי</button>
        </div>

        {mode === "register" && (
          <fieldset className="pick">
            <legend>בחרו רמה <span className="label">(אפשר להחליף בכל רגע)</span></legend>
            <ModePicker value={level} onChange={setLevel} compact />
          </fieldset>
        )}

        <div className="field">
          <label htmlFor="nick">{mode === "register" ? "שם משתמש (יופיע בטבלה ובתעודה)" : "שם המשתמש שלכם"}</label>
          <input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} autoComplete="username" placeholder="למשל: הדס" spellCheck={false} />
        </div>

        {mode === "register"
          ? <PasswordField id="pw" label="בחרו סיסמה" value={password} onChange={setPassword} nickname={nickname} />
          : (
            <div className="field">
              <label htmlFor="pw">הסיסמה שלכם</label>
              <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              <span className="label">נרשמתם עם קוד של 4 ספרות? הקלידו אותו כאן, ונציע לכם לבחור סיסמה חזקה.</span>
            </div>
          )}

        <button className="primary big" type="submit" disabled={busy}>{busy ? "רגע..." : mode === "register" ? "מתחילים ללמוד" : "ממשיכים מאיפה שעצרתי"}</button>
        {error && <p className="feedback no" role="alert">{error}</p>}
        <p className="label">כל שם משתמש הוא ייחודי. הסיסמה נשמרת מוצפנת, ואחרי 5 ניסיונות שגויים החשבון ננעל ל-15 דקות. אנחנו שומרים רק את השם, התוצאות והשאלות לנועה.</p>
      </form>
    </main>
  );
}

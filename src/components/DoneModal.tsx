"use client";

import { useEffect, useState } from "react";
import { drawCertificate } from "@/lib/client/certificate";
import { mmss } from "@/lib/client/format";
import { LEVEL_COUNT, STAGE_NAMES, type Level } from "@/lib/game/levels";

export interface DoneInfo { level: Level; stars: number; durationMs: number; timeLeftMs: number | null; wrong: number; hints: number }
interface Props { info: DoneInfo; nickname: string; hasNext: boolean; onNext: () => void; onMap: () => void; onBoard: () => void }

const Html = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;

export function DoneModal({ info, nickname, hasNext, onNext, onMap, onBoard }: Props) {
  const { level, stars } = info;
  const final = level.final;
  const [kind, setKind] = useState<"post" | "story">("post");
  const [img, setImg] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    void drawCertificate(kind, { level, nickname, stars, durationMs: info.durationMs, timeLeftMs: info.timeLeftMs }).then((c) => { if (alive) setImg(c.toDataURL("image/png")); });
    return () => { alive = false; };
  }, [kind, level, nickname, stars, info.durationMs, info.timeLeftMs]);

  const grand = level.n === LEVEL_COUNT;
  const site = typeof location !== "undefined" ? location.origin : "";
  const shareText = `${grand ? "סיימתי את כל ששת השלבים של Blackout, חדר בריחה בסייבר, וקיבלתי תעודת אנליסט SOC." : final ? `השלמתי את שלב ${level.room} ב-Blackout, חדר בריחה בסייבר: ${STAGE_NAMES[level.room]}, עם ${stars} מתוך 3 כוכבים.` : `השלמתי משימה ב-Blackout, חדר בריחה בסייבר: ${level.title}`}\nמה למדתי: ${level.learned.join(", ")}.\nנסו בעצמכם: ${site}\n#סייבר #Cybersecurity #SOC`;

  async function save() {
    const c = await drawCertificate(kind, { level, nickname, stars, durationMs: info.durationMs, timeLeftMs: info.timeLeftMs });
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `blackout-stage${level.room}-task${level.idx}-${kind}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setMsg("התמונה נשמרה בתיקיית ההורדות.");
    }, "image/png");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(shareText); setMsg("הטקסט הועתק. הדביקו אותו בפוסט."); }
    catch { setMsg(shareText); }
  }

  return (
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="doneTitle">
      <div>
        <div className="bigstars" aria-label={`${stars} כוכבים מתוך 3`}>
          {[1, 2, 3].map((s) => <span key={s} className={s <= stars ? "on" : ""} style={{ animationDelay: `${s * 180}ms` }}>★</span>)}
        </div>
        <h2 id="doneTitle">{final ? final.winTitle : `משימה ${level.idx} הושלמה!`}</h2>
        {final && <p className="stagedone">{grand ? "עברתם את כל ששת השלבים. מגיעה לכם תעודת אנליסט SOC!" : `שלב ${level.room}, ${STAGE_NAMES[level.room]}, הושלם. שלב ${level.room + 1} נפתח.`}</p>}
        {final && <Html html={final.winHtml} />}
        <dl className="stats">
          <div><dt>כוכבים</dt><dd>{stars}/3</dd></div>
          <div><dt>{final ? "זמן שנותר" : "זמן"}</dt><dd>{mmss(final ? info.timeLeftMs ?? 0 : info.durationMs)}</dd></div>
          <div><dt>{final ? "רמזים / טעויות" : "טעויות"}</dt><dd>{final ? `${info.hints} / ${info.wrong}` : info.wrong}</dd></div>
        </dl>
        <section className="certbox">
          {img ? <img src={img} alt="תעודת השלמת השלב" /> : <div className="certph" />}
          <div className="ctrl">
            <h3>התעודה שלכם</h3>
            <p className="label">שתפו את ההישג בלינקדאין או בסטורי.</p>
            <div className="seg" role="group" aria-label="גודל התעודה">
              <button type="button" aria-pressed={kind === "post"} onClick={() => setKind("post")}>פוסט</button>
              <button type="button" aria-pressed={kind === "story"} onClick={() => setKind("story")}>סטורי</button>
            </div>
            <div className="actions">
              <button className="primary" type="button" onClick={() => void save()}>שמירת התמונה</button>
              <a className="ghost" href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">פרסום בלינקדאין</a>
              <button className="ghost" type="button" onClick={() => void copy()}>העתקת טקסט</button>
            </div>
            <p className="label" role="status">{msg || (kind === "story" ? "לסטורי: שמרו את התמונה והעלו אותה לסטורי." : "בלינקדאין: שמרו את התמונה, לחצו \"פרסום בלינקדאין\" וצרפו אותה לפוסט.")}</p>
          </div>
        </section>
        <div><h3>מה למדתם במשימה הזו</h3><ul className="plain">{level.learned.map((x) => <li key={x}>{x}</li>)}</ul></div>
        {final && <Html html={final.debriefHtml} />}
        <div className="actions">
          {hasNext && <button className="primary" type="button" onClick={onNext} autoFocus>{final ? `לשלב ${level.room + 1}` : "למשימה הבאה"}</button>}
          <button className="ghost" type="button" onClick={onMap} autoFocus={!hasNext}>חזרה למפה</button>
          <button className="ghost" type="button" onClick={onBoard}>טבלת המובילים</button>
        </div>
      </div>
    </section>
  );
}

export function LoseModal({ level, onRetry, onMap }: { level: Level; onRetry: () => void; onMap: () => void }) {
  return (
    <section className="modal lost" role="dialog" aria-modal="true" aria-labelledby="loseTitle">
      <div>
        <h2 id="loseTitle">הזמן נגמר</h2>
        <p>{level.final?.loseText}</p>
        <p>טיפ לסיבוב הבא: {level.final?.loseTip}</p>
        <div className="actions">
          <button className="primary" type="button" onClick={onRetry} autoFocus>נסו שוב</button>
          <button className="ghost" type="button" onClick={onMap}>חזרה למפה</button>
        </div>
      </div>
    </section>
  );
}

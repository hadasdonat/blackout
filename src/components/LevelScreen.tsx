"use client";

import { useEffect, useRef, useState } from "react";
import { ROOM_FILES, SECRET_FILES } from "@/lib/game/evidence";
import { levelLabel, type Level } from "@/lib/game/levels";
import type { Action } from "@/lib/game/shell";
import { reducedMotion, sfx } from "@/lib/client/fx";
import { Dictionary } from "./Dictionary";
import { FailChart } from "./FailChart";
import { Terminal, type TerminalHandle } from "./Terminal";

const BASE_CHIPS: [string, string][] = [["ls", "מציגה את הקבצים בתיק"], ["cat README.txt", "מציגה את קובץ ההסבר על התיק"], ["help", "רשימה קצרה של כל הפקודות"], ["clear", "מנקה את המסך"]];

export interface LevelApi {
  answer(a: string | [string, string]): Promise<{ correct: boolean; feedback: string } | null>;
  hint(): Promise<string | null>;
  secret(file: string): Promise<boolean>;
}
interface Props { level: Level; api: LevelApi; hints: string[]; hintsLeft: number; solved: boolean }

/** Lesson text and Noa's line are our own static content, so rendering them as HTML is safe. */
const Html = ({ html, className }: { html: string; className?: string }) => <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;

function Typewriter({ text }: { text: string }) {
  const [shown, setShown] = useState(reducedMotion() ? text.length : 0);
  useEffect(() => {
    if (shown >= text.length) return;
    const t = setTimeout(() => setShown((s) => s + 2), 16);
    return () => clearTimeout(t);
  }, [shown, text]);
  return <>{text.slice(0, shown)}</>;
}

export function LevelScreen({ level, api, hints, hintsLeft, solved }: Props) {
  const term = useRef<TerminalHandle>(null);
  const [tab, setTab] = useState<"stage" | "dict">("stage");
  const [answer, setAnswer] = useState("");
  const [f, setF] = useState<[string, string]>(["", ""]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const final = level.final;

  useEffect(() => {
    const t = term.current!;
    t.clear();
    if (final) {
      final.alerts.forEach((a) => t.print(a, a.includes("ALERT") ? "err" : "sys"));
      t.print(final.go, "out");
    } else {
      t.print(`[SOC] חפיפה עם נועה · ${levelLabel(level)}`, "sys");
      t.print("ההוראות בתיק שבצד. הקלידו פקודה ולחצו Enter, או לחצו על פקודה מוצעת. עמדו על פקודה כדי לראות מה היא עושה.", "out");
    }
    if (matchMedia("(min-width: 901px)").matches) t.focus();
  }, [level, final]);

  async function send(a: string | [string, string]) {
    if (busy || solved) return;
    setBusy(true);
    try {
      const res = await api.answer(a);
      if (!res) return;
      setFeedback({ ok: res.correct, text: res.correct ? `נכון! ${res.feedback}` : res.feedback });
      if (res.correct) term.current?.print(`✓ ${levelLabel(level)} הושלם`, "sys");
      else { setShake((s) => s + 1); sfx("bad"); if (final) term.current?.print(`${res.feedback}  -01:00`, "err"); }
    } finally { setBusy(false); }
  }

  async function hint() {
    const text = await api.hint();
    if (text && !final) term.current?.print("רמז נפתח בתיק שבצד", "sys");
    if (text && final) term.current?.print(`רמז ${hints.length + 1} נפתח בתיק  -02:00`, "sys");
  }

  function onAction(a: Action) {
    if (a.type === "hint") void hint();
    else if (a.type === "submit") {
      if (!final) term.current?.print("בשלבי החפיפה עונים בתרגיל שבצד.", "err");
      else if (a.args.length !== 2) term.current?.print("usage: submit A B", "err");
      else void send([a.args[0]!, a.args[1]!]);
    } else if (a.type === "secret") {
      void api.secret(a.file).then((bonus) => {
        term.current?.print(bonus ? "מצאתם קובץ נסתר: נוספה דקה לשעון" : "מצאתם קובץ נסתר! בשלב האירוע הוא שווה דקה נוספת.", "sys");
        sfx("ok");
      });
    }
  }

  const chips: [string, string, boolean][] = [...level.chips.map(([c, t]) => [c, t, false] as [string, string, boolean]), ...BASE_CHIPS.map(([c, t]) => [c, t, true] as [string, string, boolean])];

  return (
    <main className="gamegrid">
      <aside className="file" aria-label="תיק האירוע">
        <div className="tabs" role="tablist">
          <button role="tab" type="button" aria-selected={tab === "stage"} onClick={() => setTab("stage")}>השלב</button>
          <button role="tab" type="button" aria-selected={tab === "dict"} onClick={() => setTab("dict")}>מילון</button>
        </div>
        <div className="pane" hidden={tab !== "stage"}>
          <div className="noa"><div className="avatar" aria-hidden="true">נ</div><div className="bubble"><Typewriter key={level.n} text={level.noa} /></div></div>
          <div className="lesson">
            <span className="label">{levelLabel(level)}</span>
            <h2>{level.title}</h2>
            <p className="tldr"><b>בקצרה:</b> {level.tldr}</p>
            <Html html={level.lesson} className="lesson" />
          </div>
          {!final && (
            <div className={`task${shake ? " shake" : ""}`} key={`t${shake}`}>
              <b>התרגיל</b>
              <Html html={level.task!} />
              <form className="answer" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) void send(answer); }} noValidate>
                <input value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={solved} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="התשובה שלכם" />
                <button className="primary" type="submit" disabled={busy || solved || !answer.trim()}>בדיקה</button>
              </form>
              <p className={`feedback ${feedback?.ok ? "ok" : "no"}`} role="status">{feedback?.text}</p>
              {hints.length > 0 && <ol className="hints">{hints.map((h) => <li key={h}><Html html={h} /></li>)}</ol>}
              {!solved && hintsLeft > 0 && (
                <button className="ghost help" type="button" onClick={() => void hint()}>
                  {hints.length === 0 ? "צריכים עזרה? קבלו רמז" : "עדיין תקועים? הראו לי את הפקודה"}
                </button>
              )}
              <p className="label">רמז מוריד כוכב אחד, אבל אין הגבלה על ניסיונות.</p>
            </div>
          )}
          {final && (
            <>
              <section className="lesson">
                <Html html={final.caseHtml} className="lesson" />
                {final.chart && <><span className="label">התחברויות שנכשלו בכל 15 דקות, מ-22:00 עד 02:00</span><FailChart /></>}
              </section>
              <form className={`task${shake ? " shake" : ""}`} key={`r${shake}`} onSubmit={(e) => { e.preventDefault(); if (f[0].trim() && f[1].trim()) void send(f); }} noValidate>
                <b>דוח ממצאים</b>
                {final.fields.map((field, i) => (
                  <div className="field" key={field.label}>
                    <label htmlFor={`f${i}`}>{field.label}</label>
                    <input id={`f${i}`} className="ltr" value={f[i]} placeholder={field.placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false}
                      onChange={(e) => setF((v) => (i === 0 ? [e.target.value, v[1]] : [v[0], e.target.value]))} />
                  </div>
                ))}
                <button className="primary" type="submit" disabled={busy || solved}>שליחת הממצאים</button>
                <p className={`feedback ${feedback?.ok ? "ok" : "no"}`} role="status">{feedback?.text}</p>
              </form>
              <section className="lesson">
                <h2>רמזים</h2>
                <ol className="hints">{hints.map((h) => <li key={h}><Html html={h} /></li>)}</ol>
                <button className="ghost" type="button" disabled={hintsLeft === 0 || solved} onClick={() => void hint()}>
                  {hintsLeft === 0 ? "אין עוד רמזים" : `פתחו רמז ${hints.length + 1} מתוך 3 (מוריד 2 דקות)`}
                </button>
              </section>
            </>
          )}
        </div>
        <div className="pane" hidden={tab !== "dict"}>
          <Dictionary room={level.room} onTry={(cmd) => term.current?.run(cmd)} />
        </div>
      </aside>
      <Terminal ref={term} files={ROOM_FILES[level.room]!} secretFile={SECRET_FILES[level.room]!} chips={chips} alert={!!final}
        status={final ? `INC-04${16 + level.room} · LIVE` : "training · no clock"} onAction={onAction} />
    </main>
  );
}

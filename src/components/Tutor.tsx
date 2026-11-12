"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/client/api";
import type { Level } from "@/lib/game/levels";

interface Msg { role: "user" | "assistant"; content: string }
interface Props { level: Level; terminal: () => string; onTry: (cmd: string) => void; onAuth: () => void }

/** Renders Noa's plain-text answer: paragraphs, lists, **bold**, `code` and ``` blocks. Never uses innerHTML. */
function Rich({ text, onTry }: { text: string; onTry: (cmd: string) => void }) {
  const inline = (s: string, k: string): ReactNode[] =>
    s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        const cmd = part.slice(1, -1);
        return <button key={`${k}${i}`} type="button" className="code-run" dir="ltr" title="הרצה בטרמינל" onClick={() => onTry(cmd)}>{cmd}</button>;
      }
      if (part.startsWith("**") && part.endsWith("**")) return <b key={`${k}${i}`}>{part.slice(2, -2)}</b>;
      return part;
    });
  const blocks = text.split(/```[a-z]*\n?([\s\S]*?)```/g);
  return (
    <>
      {blocks.map((block, bi) => {
        if (bi % 2 === 1) return <pre key={bi} dir="ltr">{block.trim()}</pre>;
        return block.split(/\n{2,}/).filter((p) => p.trim()).map((para, pi) => {
          const lines = para.trim().split("\n");
          const list = lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l));
          if (list) return <ul key={`${bi}-${pi}`}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""), `${bi}-${pi}-${li}-`)}</li>)}</ul>;
          return <p key={`${bi}-${pi}`}>{lines.map((l, li) => <span key={li}>{li > 0 && <br />}{inline(l, `${bi}-${pi}-${li}-`)}</span>)}</p>;
        });
      })}
    </>
  );
}

export function Tutor({ level, terminal, onTry, onAuth }: Props) {
  const greeting = level.final
    ? "זה אתגר הסיום של השלב, אז לא אגלה תשובות. אבל אם משהו לא ברור, פקודה לא עובדת או שאתם לא יודעים מאיפה להתחיל, שאלו אותי."
    : `היי! אני נועה. אפשר לשאול אותי כל שאלה על "${level.title}": מה מילה מסוימת אומרת, מה פקודה עושה, או למה משהו לא עבד. אין שאלה טיפשית.`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  const firstCmd = level.chips[0]?.[0].split(" ")[0] ?? "grep";
  const starters = level.final
    ? ["מאיפה כדאי להתחיל?", "איזו פקודה מהשלב הזה יכולה לעזור?", "הפקודה שלי לא עבדה, למה?"]
    : ["מה המשימה מבקשת ממני?", `מה עושה ${firstCmd}?`, "תסבירי לי את זה יותר פשוט", "הפקודה שלי לא עבדה, למה?"];

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: question }];
    setMsgs(next); setText(""); setBusy(true); setError("");
    try {
      const res = await api<{ answer: string }>(`/api/levels/${level.n}/ask`, { messages: next.slice(-12), terminal: terminal() });
      setMsgs((m) => [...m, { role: "assistant", content: res.answer }]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { onAuth(); return; }
      setError((e as Error).message);
      setMsgs((m) => m.slice(0, -1)); setText(question);
    } finally { setBusy(false); }
  }

  return (
    <div className="tutor">
      <div className="chatlog" ref={list} aria-live="polite">
        <div className="msg bot"><div className="avatar" aria-hidden="true">נ</div><div className="bubble"><p>{greeting}</p></div></div>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
            {m.role === "assistant" && <div className="avatar" aria-hidden="true">נ</div>}
            <div className="bubble">{m.role === "assistant" ? <Rich text={m.content} onTry={onTry} /> : <p dir="auto">{m.content}</p>}</div>
          </div>
        ))}
        {busy && <div className="msg bot"><div className="avatar" aria-hidden="true">נ</div><div className="bubble typing" aria-label="נועה כותבת"><i /><i /><i /></div></div>}
      </div>
      {msgs.length === 0 && (
        <div className="starters" aria-label="שאלות לדוגמה">
          {starters.map((s) => <button key={s} type="button" onClick={() => void ask(s)}>{s}</button>)}
        </div>
      )}
      {error && <p className="feedback no" role="alert">{error}</p>}
      <form className="ask" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <textarea
          value={text} rows={2} maxLength={800} placeholder="כתבו שאלה, למשל: מה ההבדל בין cat ל-head?" aria-label="השאלה לנועה"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
        />
        <button className="primary" type="submit" disabled={busy || !text.trim()}>שליחה</button>
      </form>
      <p className="label">לחיצה על פקודה בתשובה מריצה אותה בטרמינל. נועה מסבירה ומכוונת, אבל את התשובה מוצאים לבד.</p>
    </div>
  );
}

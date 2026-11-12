"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { describe } from "@/lib/game/dictionary";
import type { Files } from "@/lib/game/evidence";
import { completeWord, runLine, type Action, type Line, type LineKind } from "@/lib/game/shell";
import { sfx } from "@/lib/client/fx";

export interface TerminalHandle { print(text: string, kind?: LineKind): void; run(cmd: string): void; focus(): void; clear(): void }
interface Props {
  files: Files;
  secretFile: string;
  chips: [string, string, boolean][];
  alert: boolean;
  status: string;
  onAction: (a: Action) => void;
}

const TOKEN = /(\bFailed\b|\bAccepted\b|\bspf=fail\b|\bPOST\b|\b\d{1,3}(?:\.\d{1,3}){3}\b)/g;
function colour(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return part;
    const cls = part === "Accepted" ? "good" : /^\d/.test(part) ? "ip" : "bad";
    return <span key={i} className={cls}>{part}</span>;
  });
}

let nextId = 0;
export const Terminal = forwardRef<TerminalHandle, Props>(function Terminal({ files, secretFile, chips, alert, status, onAction }, ref) {
  const [lines, setLines] = useState<(Line & { id: number })[]>([]);
  const [value, setValue] = useState("");
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const history = useRef<string[]>([]);
  const pos = useRef(0);
  const out = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const append = (more: Line[]) => {
    setLines((l) => [...l, ...more.map((x) => ({ ...x, id: nextId++ }))].slice(-1200));
    requestAnimationFrame(() => { if (out.current) out.current.scrollTop = out.current.scrollHeight; });
  };
  const exec = (cmd: string) => {
    const trimmed = cmd.trim();
    if (trimmed) { history.current.push(trimmed); pos.current = history.current.length; }
    const res = runLine(cmd, { files, history: history.current, secretFile });
    if (res.actions.some((a) => a.type === "clear")) setLines([]);
    else {
      append(res.lines);
      if (res.lines.at(-1)?.kind === "err") sfx("soft");
    }
    res.actions.filter((a) => a.type !== "clear").forEach(onAction);
  };

  useImperativeHandle(ref, () => ({
    print: (text, kind = "sys") => append([{ text, kind }]),
    run: exec,
    focus: () => input.current?.focus({ preventScroll: true }),
    clear: () => setLines([]),
  }));

  const showTip = (el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 140), innerWidth - 140), y: r.top - 10 });
  };

  return (
    <section className={`term${alert ? " alert" : ""}`} aria-label="טרמינל" dir="ltr">
      <div className="tbar"><span>analyst@soc-04</span><span>{status}</span></div>
      <div className="out" ref={out} role="log" aria-live="polite" onClick={() => { if (!String(getSelection())) input.current?.focus({ preventScroll: true }); }}>
        {lines.map((l) => (
          <p key={l.id} dir="auto" className={`ln ${l.kind === "out" ? "o" : l.kind}${/[֐-׿]/.test(l.text) ? " he" : ""}`}>{l.kind === "out" ? colour(l.text) : l.text}</p>
        ))}
      </div>
      <div className="entry">
        <label htmlFor="cmd">~/case$</label>
        <input
          id="cmd" ref={input} value={value} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" aria-describedby="cmdHelp"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); exec(value); setValue(""); }
            else if (e.key === "ArrowUp") { e.preventDefault(); if (pos.current > 0) setValue(history.current[--pos.current] ?? ""); }
            else if (e.key === "ArrowDown") { e.preventDefault(); pos.current = Math.min(history.current.length, pos.current + 1); setValue(history.current[pos.current] ?? ""); }
            else if (e.key === "Tab" && value.trim()) { e.preventDefault(); const next = completeWord(value, files); if (next) setValue(next); }
          }}
        />
      </div>
      <div className="cmdhelp" id="cmdHelp" dir="rtl" aria-live="polite">{describe(value)}</div>
      <div className="chips" aria-label="פקודות מוצעות" onPointerLeave={() => setTip(null)}>
        {chips.map(([cmd, text, base]) => (
          <button
            key={cmd} type="button" className={base ? "base" : undefined} aria-description={text}
            onPointerEnter={(e) => showTip(e.currentTarget, text)} onFocus={(e) => showTip(e.currentTarget, text)} onBlur={() => setTip(null)}
            onClick={() => { sfx("click"); exec(cmd); }}
          >{cmd}</button>
        ))}
      </div>
      {tip && <div className="tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </section>
  );
});

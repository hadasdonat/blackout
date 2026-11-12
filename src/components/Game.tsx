"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type Board, type Me } from "@/lib/client/api";
import { mmss, totals } from "@/lib/client/format";
import { confetti, loadSound, reducedMotion, setSound, sfx } from "@/lib/client/fx";
import { LEVEL_COUNT, LEVELS } from "@/lib/game/levels";
import { DoneModal, LoseModal, type DoneInfo } from "./DoneModal";
import { Intro } from "./Intro";
import { Leaderboard } from "./Leaderboard";
import { LevelMap } from "./LevelMap";
import { LevelScreen, type LevelApi } from "./LevelScreen";

interface Run { n: number; attemptId: string; deadline: number | null; offset: number; hints: string[]; solved: boolean }
type AnswerRes =
  | { expired: true }
  | { correct: false; feedback: string; deadline: string | null; serverNow: string }
  | { correct: true; feedback: string; stars: number; durationMs: number; timeLeftMs: number | null; wrong: number; hints: number; progress: Me["progress"] };

export function Game() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<Run | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [lost, setLost] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const [sound, setSoundState] = useState(false);
  const [big, setBig] = useState(false);
  const [paused, setPaused] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const fx = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setSoundState(loadSound());
    try { const b = localStorage.getItem("blackout.big") === "1"; setBig(b); document.documentElement.classList.toggle("big", b); } catch { /* ignore */ }
    api<Me>("/api/me").then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, []);

  const level = run ? LEVELS[run.n - 1]! : null;
  const where = level ? `שלב ${level.room} משימה ${level.idx}` : "במפה";

  const refreshBoard = useCallback(() => { api<Board>("/api/leaderboard").then(setBoard).catch(() => {}); }, []);
  useEffect(() => {
    if (!me) return;
    refreshBoard();
    const beat = () => { void api("/api/presence", { where }).catch(() => {}); };
    beat();
    const a = setInterval(beat, 20_000), b = setInterval(refreshBoard, 15_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [me, where, refreshBoard]);

  // The server owns the incident clock; the browser only displays it.
  useEffect(() => {
    if (!run?.deadline || run.solved || lost || paused !== null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [run?.deadline, run?.solved, lost, paused]);
  const timeLeft = paused !== null ? paused : run?.deadline ? run.deadline - (now + run.offset) : null;
  useEffect(() => {
    if (paused === null && timeLeft !== null && timeLeft <= 0 && run && !run.solved && !lost) { setLost(true); sfx("lose"); }
  }, [timeLeft, run, lost, paused]);

  async function togglePause(pause: boolean) {
    if (!run) return;
    try {
      const res = await api<{ paused: boolean; timeLeftMs?: number; deadline?: string; serverNow?: string } | { expired: true }>(`/api/levels/${run.n}/pause`, { attemptId: run.attemptId, pause });
      if ("expired" in res) { setPaused(null); setLost(true); return; }
      if (res.paused) setPaused(res.timeLeftMs ?? 0);
      else { setPaused(null); syncClock(res.deadline ?? null, res.serverNow); setNow(Date.now()); }
    } catch (e) { fail(e); }
  }

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { setMe(null); setRun(null); return; }
    setError((e as Error).message);
  };

  async function openLevel(n: number) {
    setError(""); setDone(null); setLost(false); setPaused(null);
    try {
      const r = await api<{ attemptId: string; deadline: string | null; serverNow: string }>(`/api/levels/${n}/start`, {});
      setRun({ n, attemptId: r.attemptId, deadline: r.deadline ? Date.parse(r.deadline) : null, offset: Date.parse(r.serverNow) - Date.now(), hints: [], solved: false });
      setNow(Date.now());
      if (LEVELS[n - 1]!.final) sfx("alarm"); else sfx("click");
      scrollTo(0, 0);
    } catch (e) { fail(e); }
  }

  const syncClock = (deadline: string | null, serverNow?: string) => setRun((r) => r && ({
    ...r, deadline: deadline ? Date.parse(deadline) : r.deadline, offset: serverNow ? Date.parse(serverNow) - Date.now() : r.offset,
  }));

  const levelApi: LevelApi = {
    async answer(answer) {
      if (!run) return null;
      try {
        const res = await api<AnswerRes>(`/api/levels/${run.n}/answer`, { attemptId: run.attemptId, answer });
        if ("expired" in res) { setLost(true); sfx("lose"); return null; }
        if (!res.correct) { syncClock(res.deadline, res.serverNow); return res; }
        setRun((r) => r && { ...r, solved: true });
        setMe((m) => m && { ...m, progress: res.progress });
        sfx("win"); confetti(fx.current);
        const info: DoneInfo = { level: LEVELS[run.n - 1]!, stars: res.stars, durationMs: res.durationMs, timeLeftMs: res.timeLeftMs, wrong: res.wrong, hints: res.hints };
        setTimeout(() => setDone(info), reducedMotion() ? 0 : 700);
        refreshBoard();
        return res;
      } catch (e) { fail(e); return null; }
    },
    async hint() {
      if (!run) return null;
      try {
        const res = await api<{ hint: string; deadline: string | null; serverNow: string } | { expired: true }>(`/api/levels/${run.n}/hint`, { attemptId: run.attemptId });
        if ("expired" in res) { setLost(true); return null; }
        setRun((r) => r && { ...r, hints: [...r.hints, res.hint] });
        syncClock(res.deadline, res.serverNow);
        return res.hint;
      } catch (e) { fail(e); return null; }
    },
    async secret(file) {
      if (!run) return false;
      try {
        const res = await api<{ bonus: boolean; deadline: string | null; serverNow?: string }>(`/api/levels/${run.n}/secret`, { attemptId: run.attemptId, file });
        if (res.bonus) syncClock(res.deadline, res.serverNow);
        return res.bonus;
      } catch { return false; }
    },
  };

  function goMap() { setPaused(null); setRun(null); setDone(null); setLost(false); refreshBoard(); scrollTo(0, 0); }
  async function logout() { await api("/api/logout", {}).catch(() => {}); setMe(null); setRun(null); }

  if (loading) return <div className="wrap"><p className="label">טוען...</p></div>;
  const t = me ? totals(me.progress) : null;

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>BLACKOUT</h1>
          <p>{level ? `שלב ${level.room} · ${level.title}` : "לומדים סייבר מאפס"}</p>
        </div>
        <div className="bar-tools">
          {timeLeft !== null && !run?.solved && (
            <div className={`clock${paused !== null ? " paused" : timeLeft <= 300_000 ? " low" : ""}`} role="timer" aria-label="זמן שנותר">
              <span>{level?.final?.clockLabel}</span><output>{mmss(timeLeft)}</output>
              <button className="clockbtn" type="button" onClick={() => void togglePause(paused === null)} aria-label={paused === null ? "עצירת הזמן" : "המשך הזמן"} title={paused === null ? "עצירת הזמן" : "המשך הזמן"}>{paused === null ? "⏸" : "▶"}</button>
            </div>
          )}
          {me && <span className="pill"><span className="star">★</span><b>{t!.stars}</b></span>}
          {me && <button className="pill" type="button" onClick={() => { refreshBoard(); setShowBoard(true); }}>טבלת המובילים</button>}
          <button className="pill" type="button" aria-pressed={big} onClick={() => { const v = !big; setBig(v); document.documentElement.classList.toggle("big", v); try { localStorage.setItem("blackout.big", v ? "1" : "0"); } catch { /* ignore */ } }}>טקסט גדול</button>
          <button className="pill" type="button" aria-pressed={sound} onClick={() => { setSound(!sound); setSoundState(!sound); sfx("ok"); }}>צליל: {sound ? "פועל" : "כבוי"}</button>
          {run && <button className="pill" type="button" onClick={goMap}>חזרה למפה</button>}
        </div>
      </header>
      {error && <p className="note err" role="alert">{error}</p>}

      {!me && <Intro onReady={(m) => { setMe(m); sfx("ok"); }} />}

      {me && !run && (
        <main className="mapgrid">
          <section className="mapcol" aria-label="מפת השלבים">
            <h2>מפת הלמידה</h2>
            <p className="label">לחצו על השלב המהבהב כדי להתחיל</p>
            <LevelMap progress={me.progress} onOpen={(n) => void openLevel(n)} />
          </section>
          <aside className="side">
            <section className="card">
              <div className="me">
                <div className="avatar" aria-hidden="true">{me.nickname.charAt(0)}</div>
                <div>
                  <b>{me.nickname}</b>
                  <div className="meta"><span>שלבים <b>{t!.done}/{LEVEL_COUNT}</b></span><span>כוכבים <b>{t!.stars}</b></span><span>זמן <b>{mmss(t!.ms)}</b></span></div>
                </div>
              </div>
              <button className="ghost" type="button" onClick={() => void logout()}>התנתקות</button>
            </section>
            <section className="card">
              <h3>מחוברים עכשיו</h3>
              <ul className="online">
                {(board?.online ?? []).map((o, i) => <li key={`${o.nickname}${i}`}><i className="dot" /><span>{o.nickname}{o.nickname === me.nickname ? " (אתם)" : ""}</span><small>{o.location}</small></li>)}
                {!board?.online.length && <li><span className="label">רק אתם כרגע</span></li>}
              </ul>
            </section>
            <section className="card">
              <h3>המובילים</h3>
              <table className="mini"><tbody>
                {(board?.rows ?? []).slice(0, 5).map((r, i) => (
                  <tr key={r.id} className={r.id === me.id ? "mine" : ""}><td>{i + 1}</td><td>{r.nickname}</td><td className="num">{r.stars}★ · {mmss(r.totalMs)}</td></tr>
                ))}
              </tbody></table>
              <button className="ghost" type="button" onClick={() => setShowBoard(true)}>לטבלה המלאה</button>
            </section>
          </aside>
        </main>
      )}

      {me && run && level && (
        <LevelScreen key={run.attemptId} level={level} api={levelApi} hints={run.hints} hintsLeft={(level.final ? 3 : 2) - run.hints.length} solved={run.solved} />
      )}

      {done && me && (
        <DoneModal info={done} nickname={me.nickname} hasNext={done.level.n < LEVEL_COUNT}
          onNext={() => void openLevel(done.level.n + 1)} onMap={goMap} onBoard={() => { goMap(); setShowBoard(true); }} />
      )}
      {lost && level && <LoseModal level={level} onRetry={() => void openLevel(level.n)} onMap={goMap} />}
      {showBoard && <Leaderboard board={board} meId={me?.id} onClose={() => setShowBoard(false)} />}
      <canvas className="fx" ref={fx} aria-hidden="true" />
    </div>
  );
}

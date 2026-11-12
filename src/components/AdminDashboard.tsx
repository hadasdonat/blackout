"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type Progress } from "@/lib/client/api";
import { ago, mmss, totals } from "@/lib/client/format";
import { LEVEL_COUNT, LEVELS } from "@/lib/game/levels";

interface LevelStat { n: number; room: number; idx: number; title: string; started: number; completed: number; runs: number; avgMs: number | null; avgWrong: number; avgHints: number; expired: number; topWrong: { answer: string; count: number }[] }
interface Overview { levels: LevelStat[]; players: { id: string; nickname: string; joinedAt: string; lastSeen: string; online: boolean; location: string; progress: Progress }[] }

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<Overview>("/api/admin/overview")); setNeedLogin(false); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setNeedLogin(true); else setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 20_000); return () => clearInterval(t); }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try { await api("/api/admin/login", { password }); setPassword(""); await load(); }
    catch (err) { setError((err as Error).message); }
  }

  if (needLogin) {
    return (
      <div className="wrap">
        <header className="top"><div className="brand"><h1>BLACKOUT</h1><p>ניהול</p></div></header>
        <form className="card narrow" onSubmit={login}>
          <h3>כניסת מנהלת</h3>
          <div className="field"><label htmlFor="pw">סיסמה</label><input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          <button className="primary" type="submit">כניסה</button>
          {error && <p className="feedback no" role="alert">{error}</p>}
        </form>
      </div>
    );
  }
  if (!data) return <div className="wrap"><p className="label">{error || "טוען נתונים..."}</p></div>;

  const players = data.players;
  const online = players.filter((p) => p.online).length;
  const finishedRoom = (room: number) => players.filter((p) => LEVELS.filter((l) => l.room === room && l.final).every((l) => p.progress[l.n])).length;
  const finishedAll = players.filter((p) => LEVELS.every((l) => p.progress[l.n])).length;
  const first = data.levels[0]?.started || 0;
  const played = data.levels.filter((l) => l.started > 0);
  const hardest = [...played].sort((a, b) => pct(a.completed, a.started) - pct(b.completed, b.started) || b.avgWrong - a.avgWrong)[0];
  const postText = `${players.length} אנשים כבר שיחקו ב-Blackout, חדר הבריחה בסייבר שבניתי.\n${pct(finishedRoom(1), players.length)}% עברו את שלב 1, ורק ${pct(finishedAll, players.length)}% עברו את כל ששת השלבים.${hardest ? `\nהשלב שבו הכי הרבה נתקעו: "${hardest.title}", עם ממוצע של ${hardest.avgWrong.toFixed(1)} טעויות לשחקן.` : ""}`;

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand"><h1>BLACKOUT</h1><p>ניהול · מתעדכן כל 20 שניות</p></div>
        <div className="bar-tools">
          <a className="pill" href="/">למשחק</a>
          <button className="pill" type="button" onClick={() => void api("/api/admin/logout", {}).then(() => setNeedLogin(true))}>התנתקות</button>
        </div>
      </header>

      <section className="kpis" aria-label="סיכום">
        <div className="card"><span className="label">שחקנים</span><b>{players.length}</b></div>
        <div className="card"><span className="label">מחוברים עכשיו</span><b><i className="dot inline" /> {online}</b></div>
        <div className="card"><span className="label">עברו את שלב 1</span><b>{finishedRoom(1)}</b><small>{pct(finishedRoom(1), players.length)}%</small></div>
        <div className="card"><span className="label">עברו את כל 6 השלבים</span><b>{finishedAll}</b><small>{pct(finishedAll, players.length)}%</small></div>
      </section>

      <section className="card">
        <div className="actions spread">
          <h3>איפה אנשים נתקעים</h3>
          <button className="ghost" type="button" onClick={() => void navigator.clipboard.writeText(postText).then(() => setCopied(true), () => setCopied(false))}>{copied ? "הועתק" : "העתקת נתונים לפוסט"}</button>
        </div>
        <p className="label">כל פס מראה כמה שחקנים הגיעו לשלב ביחס לשלב הראשון, והחלק המלא הוא מי שסיים אותו.</p>
        <div className="tablewrap">
          <table className="board stuck">
            <thead><tr><th>שלב</th><th className="barcol">הגיעו וסיימו</th><th>סיימו</th><th>זמן ממוצע</th><th>טעויות</th><th>רמזים</th><th>נגמר הזמן</th><th>התשובות השגויות הנפוצות</th></tr></thead>
            <tbody>
              {data.levels.map((l) => (
                <tr key={l.n} className={hardest?.n === l.n ? "hard" : ""}>
                  <td>שלב {l.room} · {l.idx}. {l.title}{hardest?.n === l.n && <span className="flag">הכי קשה</span>}</td>
                  <td className="barcol"><div className="bar" aria-label={`${l.started} הגיעו, ${l.completed} סיימו`}><span className="reach" style={{ width: `${pct(l.started, first)}%` }} /><span className="fill" style={{ width: `${pct(l.completed, first)}%` }} /></div></td>
                  <td className="num">{l.completed}/{l.started} · {pct(l.completed, l.started)}%</td>
                  <td className="num">{l.avgMs ? mmss(l.avgMs) : "–"}</td>
                  <td className="num">{l.avgWrong.toFixed(1)}</td>
                  <td className="num">{l.avgHints.toFixed(1)}</td>
                  <td className="num">{l.expired || "–"}</td>
                  <td className="wrongs">{l.topWrong.length ? l.topWrong.map((w) => <span key={w.answer} className="chip-a" dir="auto">{w.answer} <b>×{w.count}</b></span>) : <span className="label">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>כל המשתמשים</h3>
        <div className="tablewrap">
          <table className="board">
            <thead><tr><th>שם</th><th>מצב</th>{LEVELS.map((l) => <th key={l.n}>{l.room}.{l.idx}</th>)}<th>שלבים</th><th>זמן כולל</th><th>הצטרפות</th></tr></thead>
            <tbody>
              {players.map((p) => {
                const t = totals(p.progress);
                return (
                  <tr key={p.id}>
                    <td>{p.nickname}</td>
                    <td>{p.online ? <><i className="dot inline" /> {p.location}</> : <span className="label">{ago(p.lastSeen)}</span>}</td>
                    {LEVELS.map((l) => <td key={l.n} className="st">{p.progress[l.n] ? "★".repeat(p.progress[l.n]!.stars) : <span className="label">–</span>}</td>)}
                    <td className="num">{t.done}/{LEVEL_COUNT}</td>
                    <td className="num">{mmss(t.ms)}</td>
                    <td className="num">{new Date(p.joinedAt).toLocaleDateString("he-IL")}</td>
                  </tr>
                );
              })}
              {!players.length && <tr><td colSpan={LEVEL_COUNT + 5} className="label">עוד אין שחקנים. שלחו את הקישור לחברים.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

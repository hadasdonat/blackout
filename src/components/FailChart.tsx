import { FACTS } from "@/lib/game/evidence";

/** Failed logins per 15 minutes, drawn from the same log the player searches. */
export function FailChart() {
  const bins = FACTS.bins, max = Math.max(...bins), W = 320, base = 96, top = 12, bw = W / 16;
  return (
    <svg className="chart" viewBox={`0 0 ${W} 118`} role="img" aria-label="התחברויות שנכשלו: שתי קפיצות, סביב 23:15 וסביב 01:40">
      <line x1="0" x2={W} y1={base} y2={base} />
      {bins.map((v, i) => {
        const h = (v / max) * (base - top);
        return (
          <g key={i}>
            <rect x={i * bw + 1.5} y={base - h} width={bw - 3} height={h} />
            {v === max && <text textAnchor="middle" x={i * bw + bw / 2} y={base - h - 3}>{v}</text>}
          </g>
        );
      })}
      {([[0, "22:00", "start"], [4, "23:00", "middle"], [8, "00:00", "middle"], [12, "01:00", "middle"], [16, "02:00", "end"]] as const).map(([i, t, a]) => (
        <text key={t} x={i * bw} y={base + 14} textAnchor={a}>{t}</text>
      ))}
    </svg>
  );
}

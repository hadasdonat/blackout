export const pad = (n: number) => String(n).padStart(2, "0");
export const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
export function totals(progress: Record<number, { stars: number; ms: number }>) {
  const v = Object.values(progress);
  return { done: v.length, stars: v.reduce((a, b) => a + b.stars, 0), ms: v.reduce((a, b) => a + b.ms, 0) };
}
export function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  return h < 24 ? `לפני ${h} שע׳` : new Date(iso).toLocaleDateString("he-IL");
}

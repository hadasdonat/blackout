import { LEVEL_COUNT, STAGE_NAMES, type Level } from "@/lib/game/levels";
import { mmss } from "./format";

export interface CertInfo { level: Level; nickname: string; stars: number; durationMs: number; timeLeftMs: number | null }

function star(x: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  x.beginPath();
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 ? R * 0.45 : R, a = (Math.PI / 5) * k - Math.PI / 2;
    x.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  x.closePath();
}

/** A neon HUD certificate: 1200x1200 for a feed post, 1080x1920 for a story. */
export async function drawCertificate(kind: "post" | "story", c: CertInfo): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load('100px "Saira Stencil One"'), document.fonts.load('700 80px "Karantina"'), document.fonts.load('600 36px "Assistant"')]);
  } catch { /* fall back to system fonts */ }
  const story = kind === "story", W = story ? 1080 : 1200, H = story ? 1920 : 1200, sc = story ? 1.1 : 1;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  const l = c.level, grand = l.n === LEVEL_COUNT;

  // Dark HUD card with neon edges
  x.fillStyle = "#05060d"; x.fillRect(0, 0, W, H);
  for (const [gx, gy, col] of [[W * 0.85, 0, "rgba(139,92,255,.45)"], [W * 0.1, H * 0.1, "rgba(11,120,180,.35)"], [W * 0.5, H * 1.1, "rgba(255,61,154,.3)"]] as const) {
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, W * 0.8); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  x.strokeStyle = "rgba(57,229,255,.07)"; x.lineWidth = 1;
  for (let g = 0; g < Math.max(W, H); g += 48) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, H); x.stroke(); x.beginPath(); x.moveTo(0, g); x.lineTo(W, g); x.stroke(); }
  const m = 46;
  const edge = x.createLinearGradient(0, 0, W, H); edge.addColorStop(0, "#39e5ff"); edge.addColorStop(0.5, "#8b5cff"); edge.addColorStop(1, "#ff3d9a");
  x.save(); x.shadowColor = "#39e5ff"; x.shadowBlur = 30; x.strokeStyle = edge; x.lineWidth = 4;
  x.beginPath(); x.roundRect(m, m, W - m * 2, H - m * 2, 28); x.stroke(); x.restore();

  const cx = W / 2;
  let y = m + (story ? 330 : 250);
  const text = (t: string, size: number, color: string, font: string, dir: CanvasDirection = "rtl") => {
    x.direction = dir; x.fillStyle = color; x.font = font.replace("{s}", String(Math.round(size * sc))); x.textAlign = "center"; x.fillText(t, cx, y);
  };
  x.save(); x.shadowColor = "#39e5ff"; x.shadowBlur = 24; text("BLACKOUT", 112, "#ffffff", '{s}px "Saira Stencil One", Impact, sans-serif', "ltr"); x.restore();
  y += 64 * sc; text(grand ? "תעודת סיום · יסודות הסייבר" : l.final ? `תעודת סיום · שלב ${l.room} מתוך 6` : "תעודת השלמת משימה", 40, "#8a93c0", '600 {s}px "Assistant", Arial, sans-serif');
  y += (story ? 210 : 150) * sc; text(c.nickname, 120, "#ffffff", '700 {s}px "Karantina", Impact, sans-serif');
  y += 74 * sc; text(grand ? "השלים/ה את כל ששת השלבים" : l.final ? `השלים/ה את שלב ${l.room}: ${STAGE_NAMES[l.room]}` : `שלב ${l.room} · משימה ${l.idx}: ${l.title}`, 54, "#39e5ff", '700 {s}px "Karantina", Impact, sans-serif');
  y += (story ? 160 : 110) * sc;
  for (let s = 0; s < 3; s++) {
    star(x, cx + (s - 1) * 112 * sc, y - 30 * sc, 46 * sc);
    x.save(); if (s < c.stars) { x.shadowColor = "#ffc23d"; x.shadowBlur = 24; }
    x.fillStyle = s < c.stars ? "#ffc23d" : "rgba(255,255,255,.1)"; x.fill(); x.restore();
  }
  y += (story ? 170 : 105) * sc; text("מה למדתי", 34, "#8a93c0", '600 {s}px "Assistant", Arial, sans-serif');
  for (const item of l.learned) { y += (story ? 66 : 56) * sc; text(item, 38, "#ffffff", '600 {s}px "Assistant", Arial, sans-serif'); }

  // Stamp
  x.save();
  x.translate(m + 160, H - m - (story ? 150 : 110));
  x.rotate(-0.14);
  x.shadowColor = "#5dff9e"; x.shadowBlur = 16; x.strokeStyle = "#5dff9e"; x.lineWidth = 4;
  x.strokeRect(-105, -40, 210, 78);
  x.fillStyle = "#5dff9e"; x.font = '700 52px "Karantina", Impact, sans-serif'; x.textAlign = "center"; x.direction = "rtl";
  x.fillText("הושלם", 0, 18);
  x.restore();

  y = H - m - (story ? 150 : 100);
  text(`${c.timeLeftMs !== null ? `זמן שנותר ${mmss(c.timeLeftMs)}` : `זמן ${mmss(c.durationMs)}`}   ·   ${new Date().toLocaleDateString("he-IL")}`, 30, "#8a93c0", '600 {s}px "Assistant", Arial, sans-serif');
  y += 48 * sc; text("Blackout · לומדים סייבר מאפס", 36, "#ff3d9a", '700 {s}px "Karantina", Impact, sans-serif');
  return cv;
}

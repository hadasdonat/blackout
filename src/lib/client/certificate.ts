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

/** A manila case-file certificate: 1200x1200 for a feed post, 1080x1920 for a story. */
export async function drawCertificate(kind: "post" | "story", c: CertInfo): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load('100px "Saira Stencil One"'), document.fonts.load('700 80px "Karantina"'), document.fonts.load('600 36px "Assistant"')]);
  } catch { /* fall back to system fonts */ }
  const story = kind === "story", W = story ? 1080 : 1200, H = story ? 1920 : 1200, sc = story ? 1.1 : 1;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  const l = c.level, grand = l.n === LEVEL_COUNT;

  // Desk, then the folder
  x.fillStyle = "#121a33"; x.fillRect(0, 0, W, H);
  const m = 46;
  x.save();
  x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 40; x.shadowOffsetY = 18;
  x.fillStyle = "#e6d2a3"; x.fillRect(m + 10, m + 60, W * 0.36, 60);
  x.fillStyle = "#f3e5c2"; x.fillRect(m, m + 100, W - m * 2, H - m * 2 - 100);
  x.restore();
  x.strokeStyle = "rgba(110,92,68,.18)"; x.lineWidth = 1;
  for (let y = m + 160; y < H - m; y += 44) { x.beginPath(); x.moveTo(m + 30, y); x.lineTo(W - m - 30, y); x.stroke(); }

  const cx = W / 2;
  let y = m + (story ? 330 : 250);
  const text = (t: string, size: number, color: string, font: string, dir: CanvasDirection = "rtl") => {
    x.direction = dir; x.fillStyle = color; x.font = font.replace("{s}", String(Math.round(size * sc))); x.textAlign = "center"; x.fillText(t, cx, y);
  };
  text("BLACKOUT", 112, "#2a2016", '{s}px "Saira Stencil One", Impact, sans-serif', "ltr");
  y += 64 * sc; text(grand ? "תעודת אנליסט SOC" : l.final ? `תעודת סיום · שלב ${l.room} מתוך 6` : "תעודת השלמת משימה", 40, "#6e5c44", '600 {s}px "Assistant", Arial, sans-serif');
  y += (story ? 210 : 150) * sc; text(c.nickname, 120, "#2a2016", '700 {s}px "Karantina", Impact, sans-serif');
  y += 74 * sc; text(grand ? "השלים/ה את כל ששת השלבים" : l.final ? `השלים/ה את שלב ${l.room}: ${STAGE_NAMES[l.room]}` : `שלב ${l.room} · משימה ${l.idx}: ${l.title}`, 54, "#c8373a", '700 {s}px "Karantina", Impact, sans-serif');
  y += (story ? 160 : 110) * sc;
  for (let s = 0; s < 3; s++) {
    star(x, cx + (s - 1) * 112 * sc, y - 30 * sc, 46 * sc);
    x.fillStyle = s < c.stars ? "#ffb547" : "rgba(42,32,22,.12)"; x.fill();
    if (s < c.stars) { x.strokeStyle = "#a8650a"; x.lineWidth = 3; x.stroke(); }
  }
  y += (story ? 170 : 105) * sc; text("מה למדתי", 34, "#6e5c44", '600 {s}px "Assistant", Arial, sans-serif');
  for (const item of l.learned) { y += (story ? 66 : 56) * sc; text(item, 38, "#2a2016", '600 {s}px "Assistant", Arial, sans-serif'); }

  // Stamp
  x.save();
  x.translate(m + 160, H - m - (story ? 150 : 110));
  x.rotate(-0.14);
  x.strokeStyle = "rgba(31,122,74,.85)"; x.lineWidth = 6;
  x.strokeRect(-105, -40, 210, 78);
  x.fillStyle = "rgba(31,122,74,.85)"; x.font = '700 52px "Karantina", Impact, sans-serif'; x.textAlign = "center"; x.direction = "rtl";
  x.fillText("תיק סגור", 0, 18);
  x.restore();

  y = H - m - (story ? 150 : 100);
  text(`${c.timeLeftMs !== null ? `זמן שנותר ${mmss(c.timeLeftMs)}` : `זמן ${mmss(c.durationMs)}`}   ·   ${new Date().toLocaleDateString("he-IL")}`, 30, "#6e5c44", '600 {s}px "Assistant", Arial, sans-serif');
  y += 48 * sc; text("Blackout · חדר בריחה בסייבר", 36, "#c8373a", '700 {s}px "Karantina", Impact, sans-serif');
  return cv;
}

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

/** Draws a shareable certificate: 1200x1200 for a feed post, 1080x1920 for a story. */
export async function drawCertificate(kind: "post" | "story", c: CertInfo): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load('100px "Saira Stencil One"'), document.fonts.load('80px "Secular One"'), document.fonts.load('36px "IBM Plex Sans Hebrew"')]);
  } catch { /* fall back to system fonts */ }
  const story = kind === "story", W = story ? 1080 : 1200, H = story ? 1920 : 1200, sc = story ? 1.12 : 1;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const x = cv.getContext("2d")!;
  x.fillStyle = "#0f1119"; x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(255,255,255,0.045)"; x.lineWidth = 1;
  for (let g = 0; g < Math.max(W, H); g += 40) { x.beginPath(); x.moveTo(g, 0); x.lineTo(g, H); x.stroke(); x.beginPath(); x.moveTo(0, g); x.lineTo(W, g); x.stroke(); }
  const glow = x.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.7);
  glow.addColorStop(0, "rgba(247,172,46,0.28)"); glow.addColorStop(1, "rgba(247,172,46,0)");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#31374f"; x.lineWidth = 3; x.strokeRect(40, 40, W - 80, H - 80);
  x.strokeStyle = "#f7ac2e"; x.lineWidth = 6;
  for (const [px, py, dx, dy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]] as const) {
    x.beginPath(); x.moveTo(px, py + 60 * dy); x.lineTo(px, py); x.lineTo(px + 60 * dx, py); x.stroke();
  }
  const cx = W / 2, l = c.level;
  let y = story ? 380 : 200;
  const text = (t: string, size: number, color: string, font: string, dir: CanvasDirection = "rtl") => {
    x.direction = dir; x.fillStyle = color; x.font = `${Math.round(size * sc)}px ${font}`; x.textAlign = "center"; x.fillText(t, cx, y);
  };
  text("BLACKOUT", 118, "#f7ac2e", '"Saira Stencil One", Impact, sans-serif', "ltr");
  y += 70 * sc; const grand = l.n === LEVEL_COUNT;
  text(grand ? "תעודת אנליסט SOC" : l.final ? `תעודת סיום · שלב ${l.room} מתוך 6` : "תעודת השלמת משימה", 34, "#9da2b8", '"IBM Plex Sans Hebrew", Arial, sans-serif');
  y += (story ? 200 : 140) * sc; text(c.nickname, 92, "#ece8dc", '"Secular One", Arial, sans-serif');
  y += 80 * sc; text(grand ? "השלים/ה את כל ששת השלבים" : l.final ? `השלים/ה את שלב ${l.room}: ${STAGE_NAMES[l.room]}` : `שלב ${l.room} · משימה ${l.idx}: ${l.title}`, 44, "#5ad6ac", '"Secular One", Arial, sans-serif');
  y += (story ? 170 : 110) * sc;
  for (let s = 0; s < 3; s++) { star(x, cx + (s - 1) * 110 * sc, y - 30 * sc, 44 * sc); x.fillStyle = s < c.stars ? "#f7ac2e" : "rgba(255,255,255,0.12)"; x.fill(); }
  y += (story ? 180 : 100) * sc; text("מה למדתי", 32, "#9da2b8", '"IBM Plex Sans Hebrew", Arial, sans-serif');
  for (const item of l.learned) { y += (story ? 70 : 58) * sc; text(item, 38, "#ece8dc", '"IBM Plex Sans Hebrew", Arial, sans-serif'); }
  y = H - (story ? 230 : 150);
  text(`${c.timeLeftMs !== null ? `זמן שנותר ${mmss(c.timeLeftMs)}` : `זמן ${mmss(c.durationMs)}`}  ·  ${new Date().toLocaleDateString("he-IL")}`, 30, "#9da2b8", '"IBM Plex Sans Hebrew", Arial, sans-serif');
  y = H - (story ? 170 : 100);
  text("Blackout · חדר בריחה בסייבר", 30, "#f7ac2e", '"Secular One", Arial, sans-serif');
  return cv;
}

let ctx: AudioContext | null = null;
let enabled = false;
export function setSound(on: boolean) { enabled = on; try { localStorage.setItem("blackout.sound", on ? "1" : "0"); } catch { /* ignore */ } }
export function loadSound() { try { enabled = localStorage.getItem("blackout.sound") === "1"; } catch { enabled = false; } return enabled; }

function tone(f: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, ctx!.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, ctx!.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx!.currentTime + start + dur);
  o.connect(g); g.connect(ctx!.destination);
  o.start(ctx!.currentTime + start); o.stop(ctx!.currentTime + start + dur + 0.05);
}
export type Sfx = "click" | "ok" | "bad" | "soft" | "win" | "alarm" | "lose";
export function sfx(name: Sfx) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (name === "click") tone(880, 0, 0.05, "square", 0.03);
    else if (name === "ok") { tone(660, 0, 0.12); tone(990, 0.1, 0.18); }
    else if (name === "bad") tone(180, 0, 0.25, "sawtooth", 0.08);
    else if (name === "soft") tone(240, 0, 0.08, "triangle", 0.05);
    else if (name === "win") [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.3, "triangle"));
    else if (name === "alarm") for (let i = 0; i < 3; i++) { tone(740, i * 0.4, 0.18, "square", 0.06); tone(520, i * 0.4 + 0.2, 0.18, "square", 0.06); }
    else if (name === "lose") [392, 330, 262].forEach((f, i) => tone(f, i * 0.2, 0.35, "sawtooth", 0.07));
  } catch { /* audio is optional */ }
}

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function confetti(canvas: HTMLCanvasElement | null) {
  if (!canvas || reducedMotion()) return;
  const x = canvas.getContext("2d")!;
  canvas.width = innerWidth; canvas.height = innerHeight;
  const colors = ["#f7ac2e", "#5ad6ac", "#8fc9ee", "#ece8dc", "#ff6b7d"];
  const parts = Array.from({ length: 140 }, (_, k) => ({ x: canvas.width / 2 + (Math.random() - 0.5) * 200, y: canvas.height * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[k % colors.length]! }));
  const t0 = performance.now();
  const frame = (t: number) => {
    x.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.99;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore();
    }
    if (t - t0 < 2600) requestAnimationFrame(frame); else x.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(frame);
}

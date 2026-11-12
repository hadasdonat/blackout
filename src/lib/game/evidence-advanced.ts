import type { Files } from "./evidence";
import { FILES_INTEL, shaOf } from "./intel";

const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
const t = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

/* ---------- Stage 3: threat intelligence ---------- */
function stage3(): Files {
  const fw: [number, string][] = [];
  const add = (sec: number, src: string, dst: string, port: number) => fw.push([sec, `2026-11-07 ${hms(sec)} src=${src} dst=${dst} port=${port} action=allow`]);
  const hosts = ["W11-DANA", "W11-ORI", "W11-NOA", "W11-RONEN", "W11-TAL"];
  hosts.forEach((h, i) => {
    add(t(8, 1 + i), h, "192.0.2.20", 53);
    add(t(8, 3 + i, 10), h, "192.0.2.10", 443);
    add(t(9, 30 + i), h, "192.0.2.30", 443);
    add(t(11, 5 + i * 7), h, "198.51.100.200", 443);
  });
  add(t(10, 12, 40), "W11-TAL", "192.0.2.55", 443);
  add(t(10, 44, 2), "W11-TAL", "192.0.2.55", 443);
  for (let k = 0; k < 12; k++) add(t(8, 15) + k * 60, "W11-RONEN", "203.0.113.140", 443);
  fw.sort((a, b) => a[0] - b[0]);
  return {
    "README.txt": [
      "תיק INC-0419: חיבורים יוצאים מתחנות העבודה, 07/11.",
      "firewall.log   כל חיבור שיצא מהרשת: מתי, מאיזה מחשב (src), לאיזו כתובת (dst) ובאיזה פורט",
      "כלי מודיעין זמינים: iprep, whois, urlscan. הקלידו man iprep להסבר.",
    ],
    "firewall.log": fw.map((x) => x[1]),
    ".intel_tip": ["פתק מצוות המודיעין: ציון מעל 90 כמעט תמיד מצדיק חסימה מיידית. מי שמצא את זה מקבל דקה בונוס באתגר הסיום."],
  };
}

/* ---------- Stage 4: a suspicious file ---------- */
function stage4(): Files {
  const dl = Object.values(FILES_INTEL).map((f) => `${f.size.padEnd(8)} ${shaOf(f.name)}  ${f.name}`);
  return {
    "README.txt": [
      "תיק INC-0420: המחשב W11-RONEN התחבר לשרת זדוני. מה רץ עליו?",
      "downloads.txt   הקבצים בתיקיית ההורדות: גודל, טביעת אצבע (SHA-256) ושם",
      "process.log     אילו תוכנות הופעלו, ומי הפעיל כל אחת",
      "כלי מודיעין זמינים: vt, sandbox. אפשר לכתוב שם קובץ במקום טביעת אצבע.",
    ],
    "downloads.txt": dl,
    "process.log": [
      "07:58:40 parent=services.exe        child=GoogleUpdate.exe",
      '07:58:44 parent=GoogleUpdate.exe    child=schtasks.exe /create /tn "GoogleUpdateTaskMachineUA" /sc hourly',
      "08:12:01 parent=explorer.exe        child=outlook.exe",
      "08:13:30 parent=explorer.exe        child=chrome.exe",
      "08:14:22 parent=outlook.exe         child=invoice_2026.pdf.exe",
      "08:14:25 parent=invoice_2026.pdf.exe child=powershell.exe -w hidden -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBi...",
      '08:14:31 parent=powershell.exe      child=schtasks.exe /create /tn "OneDriveSync" /tr "C:\\Users\\ronen\\AppData\\Roaming\\OneDriveSync\\sync.exe" /sc minute /mo 60',
      "08:15:00 parent=svchost.exe         child=sync.exe",
      "09:02:10 parent=explorer.exe        child=teams.exe",
    ],
    ".analyst_notes": ["הערה של נועה: \"שם קובץ עם שתי סיומות הוא הדגל האדום הראשון\". מי שמצא את זה מקבל דקה בונוס באתגר הסיום."],
  };
}

/* ---------- Stage 5: an attack on the website ---------- */
function stage5() {
  const lines: [number, string][] = [];
  const ua = "\"Mozilla/5.0 (Windows NT 10.0) Chrome/130\"";
  const add = (sec: number, ip: string, path: string, status: number, size: number, agent = ua) =>
    lines.push([sec, `${ip} - - [09/Nov/2026:${hms(sec)} +0200] "GET ${path} HTTP/1.1" ${status} ${size} ${agent}`]);
  const pages = ["/", "/products", "/about", "/contact", "/product?id=3", "/product?id=7", "/images/logo.png", "/careers"];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 110; k++) {
    const sec = t(1, 0) + Math.floor(rnd() * 3 * 3600);
    const ip = `192.0.2.${101 + Math.floor(rnd() * 30)}`;
    if (rnd() < 0.09) add(sec, ip, ["/wp-admin", "/old-page", "/favicon.ico"][k % 3]!, 404, 1200 + Math.floor(rnd() * 200));
    else add(sec, ip, pages[k % pages.length]!, 200, 3800 + Math.floor(rnd() * 2600));
  }
  const scan = "\"sqlmap/1.8 (https://sqlmap.example)\"";
  const probes = ["/product?id=1%27", "/product?id=1%27%20OR%20%271%27%3D%271", "/login?user=admin%27--", "/product?id=1%27%20UNION%20SELECT%20username,password%20FROM%20users--", "/product?id=1%27%20AND%20SLEEP(5)--"];
  probes.forEach((p, i) => add(t(3, 12, 4 + i * 9), "198.51.100.77", p, 500, 612, scan));
  add(t(3, 31, 0), "198.51.100.77", "/product?id=1%27%20UNION%20SELECT%20name,email%20FROM%20users--", 500, 612, scan);
  add(t(3, 40, 55), "203.0.113.141", "/product?id=1", 200, 4410);
  add(t(3, 41, 12), "203.0.113.141", "/product?id=1%20UNION%20SELECT%20name,email,card_number%20FROM%20customers--", 200, 48213);
  add(t(3, 41, 40), "203.0.113.141", "/product?id=1%20UNION%20SELECT%20name,email,card_number%20FROM%20customers%20LIMIT%20500,500--", 200, 47988);
  lines.sort((a, b) => a[0] - b[0]);
  const files: Files = {
    "README.txt": [
      "תיק INC-0421: אתר החברה, shop.nocturne.example, בלילה של 09/11.",
      "access.log   כל בקשה שהגיעה לאתר: כתובת הגולש, זמן, הדף שביקש, קוד התשובה, גודל התשובה והדפדפן",
      "כלי חדש: urldecode מתרגם קידוד של כתובות (%27 הופך ל-').",
    ],
    "access.log": lines.map((x) => x[1]),
    ".dev_todo": ["TODO של המפתחים: \"לעבור לשאילתות עם פרמטרים לפני הלאנץ'\". מי שמצא את זה מקבל דקה בונוס באתגר הסיום."],
  };
  return { files, notFound: lines.filter((x) => x[1].includes('" 404 ')).length };
}

/* ---------- Stage 6: ransomware ---------- */
function stage6(): Files {
  const dns: [number, string][] = [];
  const flow: [number, string][] = [];
  const q = (day: string, sec: number, host: string, name: string, ip: string) => dns.push([sec + (day === "08" ? 86400 : 0), `2026-11-${day} ${hms(sec)} host=${host} query=${name} answer=${ip}`]);
  const f = (sec: number, src: string, dst: string, port: number, bytes: number) => flow.push([sec, `2026-11-08 ${hms(sec)} ${src} ${dst} ${port} ${bytes}`]);
  ["W11-DANA", "W11-ORI", "W11-NOA", "W11-TAL"].forEach((h, i) => {
    q("07", t(8, 2 + i), h, "portal.nocturne.example", "192.0.2.10");
    q("07", t(9, 30 + i), h, "zoom.example", "192.0.2.30");
    q("08", t(9, 1 + i), h, "portal.nocturne.example", "192.0.2.10");
  });
  for (let k = 0; k < 15; k++) q("07", t(8, 15) + k * 60, "W11-RONEN", "update-check.example", "203.0.113.140");
  for (let k = 0; k < 20; k++) q("08", t(22, 15, 3) + k * 60, "W11-DANA", "cdn-sync.example", "198.51.100.150");
  for (let k = 0; k < 20; k++) f(t(22, 15, 4) + k * 60, "W11-DANA", "198.51.100.150", 443, 1180 + (k % 4) * 6);
  ["W11-ORI", "W11-NOA", "W11-TAL"].forEach((h, i) => {
    f(t(9, 10 + i), h, "192.0.2.10", 443, 52_000 + i * 3100);
    f(t(10, 20 + i), h, "FS-01", 445, 380_000 + i * 21_000);
    f(t(14, 5 + i), h, "192.0.2.30", 443, 9_400_000 + i * 120_000);
  });
  f(t(2, 0), "FS-01", "192.0.2.10", 443, 1_204_331_008);
  f(t(23, 20, 10), "W11-DANA", "203.0.113.142", 443, 8_412_339_012);
  for (let k = 0; k < 4; k++) f(t(23, 38) + k * 50, "W11-DANA", "FS-01", 445, 2_100_000_000 + k * 40_000_000);
  dns.sort((a, b) => a[0] - b[0]);
  flow.sort((a, b) => a[0] - b[0]);
  return {
    "README.txt": [
      "תיק INC-0422: כופרה. בשרת הקבצים FS-01 קבצים הוצפנו הלילה.",
      "dns.log      איזה מחשב שאל על איזה שם, ומה הכתובת שקיבל",
      "netflow.log  חיבורים בין מחשבים. העמודות: תאריך, שעה, מקור, יעד, פורט, בייטים שיצאו מהמקור",
      "alerts.txt   ההתראות של מערכת ההגנה על המחשבים (EDR)",
      "רקע: אתמול חסמנו את 203.0.113.140 וניקינו את המחשב של רונן. ההתקפה ממשיכה.",
      "כל כלי המודיעין זמינים: iprep, whois, urlscan, vt, sandbox.",
    ],
    "dns.log": dns.map((x) => x[1]),
    "netflow.log": flow.map((x) => x[1]),
    "alerts.txt": [
      "[23:41:02] EDR  FS-01: 4,812 קבצים שונו לסיומת .nightjar בתוך 3 דקות",
      "[23:41:05] EDR  FS-01: הודעת כופר READ_ME_NIGHTJAR.txt נוצרה ב-312 תיקיות",
      "[23:41:06] EDR  מקור הכתיבה: חיבור רשת לשיתוף הקבצים (SMB, פורט 445)",
      "[23:41:30] CHALLENGE  grand final: you have everything you need",
    ],
    ".ir_playbook": ["מתוך תוכנית התגובה: \"קודם עוצרים את ההצפנה, אחר כך מחפשים אשמים\". מי שמצא את זה מקבל דקה בונוס באתגר הסיום."],
  };
}

const s5 = stage5();
export const ADVANCED_FILES: Record<number, Files> = { 3: stage3(), 4: stage4(), 5: s5.files, 6: stage6() };
export const ADVANCED_SECRETS: Record<number, string> = { 3: ".intel_tip", 4: ".analyst_notes", 5: ".dev_todo", 6: ".ir_playbook" };
export const ADVANCED_FACTS = { notFound: s5.notFound };

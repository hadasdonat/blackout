/**
 * The case files each room investigates. Generated deterministically, so the
 * browser (which runs the terminal) and the server (which checks answers)
 * always see exactly the same evidence.
 */
import { ADVANCED_FACTS, ADVANCED_FILES, ADVANCED_SECRETS } from "./evidence-advanced";

export type Files = Record<string, string[]>;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

function buildRoom1() {
  const r = rng(417);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const stamp = (t: number) => {
    let s = 22 * 3600 + t;
    let day = "02";
    if (s >= 86400) { s -= 86400; day = "03"; }
    return `Nov ${day} ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  };
  const at = (h: number, m: number, s = 0) => (h < 12 ? h + 24 : h) * 3600 + m * 60 + s - 22 * 3600;
  const events: { t: number; s: string }[] = [];
  const fails: number[] = [];
  const ev = (t: number, proc: string, msg: string) => events.push({ t, s: `${stamp(t)} vpn-gw01 ${proc}: ${msg}` });
  const sshd = () => `sshd[${int(1800, 9800)}]`;
  const fail = (t: number, u: string, ip: string) => { fails.push(t); ev(t, sshd(), `Failed password for ${u} from ${ip} port ${int(40000, 60999)} ssh2`); };
  const ok = (t: number, u: string, ip: string, how: string) => ev(t, sshd(), `Accepted ${how} for ${u} from ${ip} port ${int(40000, 60999)} ssh2`);

  const staff: [string, string][] = [["t.ben-ami", "10.0.4.12"], ["o.peretz", "10.0.4.31"], ["n.cohen", "10.0.2.18"], ["d.mizrahi", "10.0.2.44"]];
  for (let i = 0; i < 34; i++) { const w = pick(staff); ok(int(0, 14300), w[0], w[1], "publickey"); }
  for (let i = 0; i < 28; i++) ev(i * 510 + int(0, 40), `CRON[${int(1100, 7900)}]`, "pam_unix(cron:session): session opened for user root");
  for (let i = 0; i < 6; i++) fail(int(0, 14000), "o.peretz", "10.0.4.31");
  const bots = ["root", "admin", "svc_backup", "oracle", "test"];
  for (let i = 0; i < 52; i++) fail(at(23, 12, 8) + i * 23 + int(0, 9), pick(bots), "198.51.100.23");
  ok(at(22, 31, 7), "y.azulay", "198.51.100.61", "password");
  ok(at(0, 12, 41), "r.katz", "198.51.100.140", "password");
  const spray = ["d.mizrahi", "n.cohen", "m.shani", "y.azulay", "r.katz", "o.peretz"];
  for (let i = 0; i < 24; i++) fail(at(1, 38, 4) + i * 22 + int(0, 7), spray[i % 6]!, "203.0.113.77");
  ok(at(1, 47, 12), "m.shani", "203.0.113.77", "password");
  ev(at(1, 52, 33), "sudo", "m.shani : TTY=pts/3 ; PWD=/home/m.shani ; USER=root ; COMMAND=/usr/bin/tar czf /tmp/.b.tgz /srv/finance");
  ev(at(1, 55, 8), "sudo", "m.shani : TTY=pts/3 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/crontab -e");
  events.sort((a, b) => a.t - b.t);

  const files: Files = {
    "README.txt": [
      "תיק INC-0417. כל הקבצים לקריאה בלבד.",
      "auth.log    כל ההתחברויות לשער ה-VPN מ-22:00",
      "badge.log   כניסות ויציאות ממשרדי החברה",
      "roster.txt  סידור התורנויות והחופשות של השבוע",
    ],
    "auth.log": events.map((e) => e.s),
    "badge.log": [
      "Oct 29 18:04:11 door-02 OUT m.shani",
      "Nov 02 17:31:50 door-01 OUT y.azulay",
      "Nov 02 17:58:02 door-01 OUT r.katz",
      "Nov 02 21:49:37 door-01 IN  t.ben-ami",
      "Nov 02 21:52:15 door-02 IN  o.peretz",
      "Nov 02 21:55:03 door-02 IN  n.cohen",
      "Nov 02 21:57:44 door-01 IN  d.mizrahi",
    ],
    "roster.txt": [
      "USER        STATUS         REMOTE_IP",
      "t.ben-ami   night shift    -",
      "o.peretz    night shift    -",
      "n.cohen     night shift    -",
      "d.mizrahi   night shift    -",
      "y.azulay    on call        198.51.100.61",
      "r.katz      on call        198.51.100.140",
      "m.shani     leave to 09/11 -",
    ],
    ".shift_note": ["פתק מנועה: מי שמוצא את הפתק הזה יודע להסתכל היטב. באתגר הסיום הוא שווה דקה נוספת על השעון."],
  };
  const bins = new Array<number>(16).fill(0);
  for (const t of fails) { const b = Math.floor(t / 900); if (b >= 0 && b < 16) bins[b]!++; }
  const ipCount: Record<string, number> = {};
  for (const e of events) {
    const m = /Failed password for \S+ from (\S+)/.exec(e.s);
    if (m) ipCount[m[1]!] = (ipCount[m[1]!] ?? 0) + 1;
  }
  const topIp = Object.keys(ipCount).sort((a, b) => ipCount[b]! - ipCount[a]!)[0]!;
  return { files, failCount: fails.length, topIp, bins };
}

const auth = (spf: string, dkim: string, dmarc: string) => `Authentication-Results: spf=${spf} dkim=${dkim} dmarc=${dmarc}`;
function mail(head: string[], body: string[]) { return [...head, "", ...body]; }

function buildRoom2(): Files {
  const to = "To: m.shani@nocturne.example";
  return {
    "README.txt": [
      "תיק INC-0418: תיבת הדואר של m.shani, 30/10 עד 02/11. לקריאה בלבד.",
      "mail-01.eml עד mail-08.eml   המיילים שהתקבלו",
      "proxy.log                    האתרים שהמחשב של m.shani גלש אליהם",
      "הדומיין של החברה: nocturne.example. כל הדומיינים בתיק בדיוניים.",
    ],
    "mail-01.eml": mail(["From: IT Support <it-support@nocturne.example>", to, "Subject: תחזוקה מתוכננת בשרתי הדואר", "Date: Thu, 30 Oct 2026 09:12:40 +0200", "Return-Path: <it-support@nocturne.example>", auth("pass", "pass", "pass")],
      ["שלום לכולם,", "ביום ראשון בין 22:00 ל-23:00 שירות הדואר לא יהיה זמין.", 'סטטוס בזמן אמת: <a href="https://portal.nocturne.example/status">https://portal.nocturne.example/status</a>', "צוות IT"]),
    "mail-02.eml": mail(["From: HR Weekly <news@hr-weekly.example>", "Reply-To: news@hr-weekly.example", to, "Subject: 5 טיפים לשבוע עבודה מאוזן", "Date: Thu, 30 Oct 2026 11:03:15 +0200", "Return-Path: <bounce@hr-weekly.example>", auth("pass", "pass", "pass")],
      ["הפעם: איך לסגור את המחשב בזמן ולא לחשוב על מיילים בערב.", '<a href="https://hr-weekly.example/tips">לכתבה המלאה</a>']),
    "mail-03.eml": mail(["From: Dana Levi <dana.l@nocturne.example>", to, "Subject: חשבונית ספק לאישור", "Date: Thu, 30 Oct 2026 13:20:02 +0200", "Return-Path: <dana.l@nocturne.example>", auth("pass", "pass", "pass")],
      ["היי מיכל,", "צירפתי את החשבונית של ספק הניקיון. אפשר לאשר עד יום שני?", "תודה, דנה"]),
    "mail-04.eml": mail(["From: Prize Center <winner@prize-claims.example>", "Reply-To: claims@prize-claims.example", to, "Subject: !!! זכית באייפון חדש !!!", "Date: Thu, 30 Oct 2026 14:55:31 +0200", "Return-Path: <x91@bulk-sender.example>", auth("fail", "none", "fail")],
      ["מזל טוב! נבחרת לזכות.", "כדי לקבל את הפרס יש למלא פרטי אשראי תוך שעה:", '<a href="http://prize-claims.example/claim">לקבלת הפרס</a>']),
    "mail-05.eml": mail(["From: IT Support <it-support@noctume.example>", "Reply-To: helpdesk@mail-noctume.example", to, "Subject: פעולה נדרשת: הסיסמה שלך תפוג היום", "Date: Thu, 30 Oct 2026 16:41:09 +0200", "Return-Path: <bounce@sendfast.example>", "Authentication-Results: spf=pass (domain noctume.example) dkim=none dmarc=none"],
      ["שלום מיכל,", "הסיסמה שלך לרשת החברה תפוג היום ב-18:00.", "כדי לא לאבד גישה, יש לאשר אותה מחדש כאן:", '<a href="https://noctume-portal.example/login">https://portal.nocturne.example/reset</a>', "צוות IT"]),
    "mail-06.eml": mail(["From: IT Support <it-support@nocturne.example>", to, "Subject: תזכורת: מדיניות סיסמאות חדשה", "Date: Fri, 31 Oct 2026 08:30:00 +0200", "Return-Path: <it-support@nocturne.example>", auth("pass", "pass", "pass")],
      ["החל מחודש הבא סיסמאות יוחלפו כל 90 יום.", "אנחנו אף פעם לא נבקש את הסיסמה שלכם במייל.", 'החלפה מתבצעת רק דרך <a href="https://portal.nocturne.example/account">https://portal.nocturne.example/account</a>']),
    "mail-07.eml": mail(["From: HR <hr@nocturne.example>", to, "Subject: אישור חופשה 03/11 עד 09/11", "Date: Sat, 01 Nov 2026 10:00:12 +0200", "Return-Path: <hr@nocturne.example>", auth("pass", "pass", "pass")],
      ["מיכל, החופשה שלך אושרה. חופשה נעימה!"]),
    "mail-08.eml": mail(["From: Delivery Updates <updates@parcel-notify.example>", "Reply-To: no-reply@parcel-notify.example", to, "Subject: החבילה שלך מחכה לאיסוף", "Date: Sun, 02 Nov 2026 12:14:50 +0200", "Return-Path: <mailer@cheap-smtp.example>", auth("fail", "none", "fail")],
      ["לא הצלחנו למסור את החבילה.", "לתיאום מסירה חדשה:", '<a href="http://pkg-track.example/x7">https://parcel-notify.example/track</a>']),
    "proxy.log": [
      "2026-10-30 09:15:03 user=m.shani method=GET host=portal.nocturne.example path=/status status=200",
      "2026-10-30 11:20:44 user=m.shani method=GET host=hr-weekly.example path=/tips status=200",
      "2026-10-30 13:25:10 user=m.shani method=GET host=portal.nocturne.example path=/invoices status=200",
      "2026-10-30 16:44:02 user=m.shani method=GET host=noctume-portal.example path=/login status=200",
      "2026-10-30 16:45:37 user=m.shani method=POST host=noctume-portal.example path=/login status=302",
      "2026-10-30 16:45:38 user=m.shani method=GET host=portal.nocturne.example path=/ status=200",
      "2026-10-30 16:50:11 user=d.mizrahi method=GET host=portal.nocturne.example path=/status status=200",
      "2026-10-31 08:35:12 user=m.shani method=GET host=portal.nocturne.example path=/account status=200",
      "2026-11-01 10:05:40 user=m.shani method=GET host=portal.nocturne.example path=/calendar status=200",
      "2026-11-02 12:20:05 user=m.shani method=GET host=pkg-track.example path=/x7 status=200",
    ],
    ".draft": ["טיוטה של נועה: \"לבדוק את proxy.log לפני הכול\". מי שמצא את זה מקבל דקה נוספת במשימת האירוע."],
  };
}

const room1 = buildRoom1();
export const ROOM_FILES: Record<number, Files> = { 1: room1.files, 2: buildRoom2(), ...ADVANCED_FILES };
export const SECRET_FILES: Record<number, string> = { 1: ".shift_note", 2: ".draft", ...ADVANCED_SECRETS };
export const FACTS = { failCount: room1.failCount, topIp: room1.topIp, bins: room1.bins, notFound: ADVANCED_FACTS.notFound };

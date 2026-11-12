import "server-only";
import { FACTS } from "@/lib/game/evidence";
import { LEVELS } from "@/lib/game/levels";

/**
 * The answer key. Server-only: the browser never receives answers, hints or
 * the feedback that would give them away.
 */
export interface Verdict { correct: boolean; feedback: string }

const lower = (v: string) => v.trim().toLowerCase();
const digits = (v: string) => v.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
export function normDomain(v: string) {
  return lower(v).replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0] ?? "";
}

interface PracticeKey { kind: "practice"; check: (v: string) => boolean; tip: string; after: string; show: string }
interface FinalKey {
  kind: "final";
  seconds: number;
  check: (a: string, b: string) => [boolean, boolean];
  decoy: (a: string, b: string) => string | undefined;
  half: [string, string];
  wrong: string;
  hints: string[];
}

const KEYS: Record<number, PracticeKey | FinalKey> = {
  1: { kind: "practice", check: (v) => lower(v) === "vpn-gw01", tip: "השם מופיע בכל שורה, מיד אחרי השעה. בשורת הדוגמה הוא mail-srv.", after: "זה שער ה-VPN, שדרכו עובדים מתחברים לרשת מבחוץ." , show: "head auth.log" },
  2: { kind: "practice", check: (v) => digits(v) === String(FACTS.failCount), tip: "השתמשו ב-grep עם האפשרות -c, שסופרת שורות.", after: `${FACTS.failCount} ניסיונות בלילה אחד זה הרבה. בשלב הבא נבדוק מי עומד מאחוריהם.` , show: "grep -c Failed auth.log" },
  3: { kind: "practice", check: (v) => v.trim() === FACTS.topIp, tip: "החליפו את $9 ב-$11 והריצו שוב. התשובה נמצאת בשורה הראשונה.", after: "אבל שימו לב: הכתובת הכי רועשת היא לא בהכרח זו שהצליחה להיכנס." , show: "grep Failed auth.log | awk '{print $11}' | sort | uniq -c | sort -nr" },
  4: {
    kind: "final", seconds: 30 * 60,
    check: (u, ip) => [lower(u) === "m.shani", ip.trim() === "203.0.113.77"],
    decoy: (u, ip) => ({
      svc_backup: "החשבון הותקף, אבל אף ניסיון לא הצליח.", root: "החשבון הותקף, אבל אף ניסיון לא הצליח.", admin: "החשבון הותקף, אבל אף ניסיון לא הצליח.",
      "r.katz": "זה חשבון של כונן, והכתובת תואמת לסידור התורנויות.", "y.azulay": "זה חשבון של כונן, והכתובת תואמת לסידור התורנויות.",
      "o.peretz": "זו טעות הקלדה של עובד במשמרת, מהרשת הפנימית.",
    } as Record<string, string>)[lower(u)] ?? ({
      "198.51.100.23": "הכתובת הזו רועשת, אבל אף ניסיון שלה לא הצליח.", "198.51.100.140": "זו הכתובת הרשומה של כונן.", "198.51.100.61": "זו הכתובת הרשומה של כונן.",
    } as Record<string, string>)[ip.trim()],
    half: ["החשבון נכון, הכתובת לא. חפשו מאיפה בוצעה ההתחברות שלו.", "הכתובת נכונה, החשבון לא. חפשו איזו התחברות מהכתובת הזו הצליחה."],
    wrong: "החשבון והכתובת לא מתאימים לראיות.",
    hints: [
      "בגרף יש שתי קפיצות, והרועשת יותר לא בהכרח הצליחה. מה שחשוב הוא התחברות שעברה: <code>grep Accepted auth.log</code>",
      'רוב ההתחברויות הן מהרשת הפנימית. סננו אותן: <code>grep Accepted auth.log | grep -v "10.0."</code>',
      "השוו את התוצאות לקובץ <code>roster.txt</code>. למי מהם לא הייתה סיבה להיות מחובר הלילה?",
    ],
  },
  5: { kind: "practice", check: (v) => lower(v).replace(/[<>]/g, "").includes("winner@prize-claims.example"), tip: "הכתובת מופיעה בשורה הראשונה, אחרי From, בין הסוגריים.", after: "דחיפות, פרס ובקשה לפרטי אשראי: זה פישינג קלאסי. אבל רוב המתקפות מתוחכמות הרבה יותר." , show: "cat mail-04.eml" },
  6: { kind: "practice", check: (v) => digits(v) === "2", tip: "חפשו spf=fail בכל המיילים, והעבירו את התוצאה ל-wc -l כדי לספור.", after: "שימו לב: SPF תקין לא אומר שהמייל בטוח. הוא רק אומר שהשרת מורשה לשלוח בשם הדומיין שלו, וגם תוקף יכול לקנות דומיין." , show: "grep spf=fail mail-*.eml | wc -l" },
  7: { kind: "practice", check: (v) => normDomain(v) === "pkg-track.example", tip: "הריצו grep href mail-08.eml. הדומיין האמיתי כתוב בתוך href, בין המירכאות.", after: "מי שלחץ הגיע לאתר אחר לגמרי ממה שראה. אפשר לגלות את זה אם עומדים עם העכבר על הקישור לפני שלוחצים." , show: "grep href mail-08.eml" },
  8: {
    kind: "final", seconds: 20 * 60,
    check: (m, d) => [digits(m) === "5", normDomain(d) === "noctume-portal.example"],
    decoy: (m, d) => ({
      "4": "המייל הזה חשוד מאוד, אבל אין עדות שמיכל לחצה עליו.", "8": "מיכל לחצה על הקישור, אבל לא שלחה שם שום פרטים. אין בקשת POST.",
      "1": "זה מייל אמיתי של צוות IT. השוו את הדומיין בשורת From.", "6": "זה מייל אמיתי של צוות IT. השוו את הדומיין בשורת From.",
    } as Record<string, string>)[digits(m)] ?? ({
      "pkg-track.example": "הייתה גלישה לשם, אבל בלי שליחת פרטים.", "prize-claims.example": "אין בלוג גלישה לדומיין הזה.",
      "noctume.example": "זה הדומיין של השולח. לאן נשלחה הסיסמה?", "mail-noctume.example": "לכתובת הזו הולכות תשובות למייל, לא הסיסמה.",
      "portal.nocturne.example": "זה האתר האמיתי של החברה. התוקף רק מחקה אותו.", "nocturne.example": "זה הדומיין האמיתי של החברה.",
    } as Record<string, string>)[normDomain(d)],
    half: ["המייל נכון, הדומיין לא. לאן נשלח הטופס?", "הדומיין נכון, המייל לא. איזה מייל מקשר אליו?"],
    wrong: "המייל והדומיין לא מתאימים לראיות.",
    hints: [
      "לא כל מייל חשוד גרם נזק. בדקו לאן מיכל באמת גלשה: <code>cat proxy.log</code>",
      "שליחת טופס, כמו סיסמה, נרשמת כבקשת POST: <code>grep POST proxy.log</code>",
      "חפשו את הדומיין שמצאתם בתוך המיילים: <code>grep noctume mail-*.eml</code>",
    ],
  },
  /* ---------- Stage 3: threat intelligence ---------- */
  9: { kind: "practice", check: (v) => digits(v) === "88", show: "iprep 198.51.100.23", tip: "הקלידו iprep ואחריו הכתובת. התשובה בשורה risk score.", after: "88 מתוך 100: בוטנט מוכר. אילו היינו בודקים אותה בשלב 1, היינו יודעים מיד שהיא מסוכנת." },
  10: { kind: "practice", check: (v) => /\b28\b/.test(v) && /\b10\b/.test(v), show: "whois noctume-portal.example", tip: "הקלידו whois noctume-portal.example וחפשו את השורה created.", after: "הדומיין נרשם יומיים לפני מייל הפישינג. זה דפוס קלאסי של קמפיין." },
  11: { kind: "practice", check: (v) => v.trim() === "203.0.113.80", show: "urlscan noctume-portal.example", tip: "בתוצאה של urlscan חפשו את השורה hosted on.", after: "השרת שייך ל-BulletHost, אותו ספק של הכתובת שתקפה בשלב 1. מתחילים לראות את התשתית של התוקף." },
  12: {
    kind: "final", seconds: 20 * 60,
    check: (h, ip) => [lower(h) === "w11-ronen", ip.trim() === "203.0.113.140"],
    decoy: (h, ip) => ({
      "w11-tal": "המחשב הזה פנה לשירות VPN עם ציון 35. חשוד מעט, אבל לא זדוני.",
      "w11-dana": "המחשב הזה פנה רק לשירותים מוכרים.", "w11-ori": "המחשב הזה פנה רק לשירותים מוכרים.", "w11-noa": "המחשב הזה פנה רק לשירותים מוכרים.",
    } as Record<string, string>)[lower(h)] ?? ({
      "192.0.2.55": "ציון 35: שירות VPN מסחרי. חשוד מעט, לא שרת של תוקף.",
      "192.0.2.10": "זו כתובת של שירות מוכר, עם ציון 0.", "192.0.2.20": "זו כתובת של שירות מוכר, עם ציון 0.", "192.0.2.30": "זו כתובת של שירות מוכר, עם ציון 0.",
      "198.51.100.200": "ציון 8: רשת להפצת תוכן. תקין.", "203.0.113.80": "זה השרת של אתר הפישינג, ואף מחשב לא פנה אליו אתמול.",
    } as Record<string, string>)[ip.trim()],
    half: ["המחשב נכון, הכתובת לא. בדקו את הכתובות שהוא פנה אליהן עם iprep.", "הכתובת נכונה, המחשב לא. מי פנה אליה?"],
    wrong: "המחשב והכתובת לא מתאימים לראיות.",
    hints: ["הוציאו את רשימת הכתובות: <code>cat firewall.log | awk '{print $4}' | sort -u</code>", "בדקו כל כתובת עם <code>iprep</code>. חפשו ציון מעל 90.", "מצאתם כתובת זדונית? <code>grep 203.0.113.140 firewall.log</code> יראה מי פנה אליה."],
  },
  /* ---------- Stage 4: a suspicious file ---------- */
  13: { kind: "practice", check: (v) => lower(v) === "invoice_2026.pdf.exe", show: "grep .exe downloads.txt", tip: "חפשו שם שיש בו שתי נקודות ושנגמר ב-.exe.", after: "הסיומת האמיתית היא .exe, כלומר תוכנה. מי שפתח את \"החשבונית\" הריץ אותה." },
  14: { kind: "practice", check: (v) => digits(v.split("/")[0] ?? "") === "52", show: "vt invoice_2026.pdf.exe", tip: "הקלידו vt invoice_2026.pdf.exe והסתכלו בשורה detections.", after: "52 מתוך 70 זה זיהוי חד-משמעי. משפחת הנוזקה: Nightjar." },
  15: { kind: "practice", check: (v) => normDomain(v) === "update-check.example", show: "sandbox invoice_2026.pdf.exe", tip: "בדוח של sandbox חפשו את השורה שמתחילה ב\"מתחבר אל\".", after: "זה שרת השליטה. הכתובת שלו, 203.0.113.140, היא בדיוק זו שמצאתם בשלב 3." },
  16: {
    kind: "final", seconds: 20 * 60,
    check: (p, t) => [lower(p) === "outlook.exe" || lower(p) === "outlook", lower(t).replace(/"/g, "") === "onedrivesync"],
    decoy: (p, t) => ({
      "explorer.exe": "explorer.exe פתח את Outlook. מי פתח את הקובץ עצמו?", "powershell.exe": "PowerShell הופעל על ידי הקובץ. מי הפעיל את הקובץ?",
      "chrome.exe": "אין קשר בין Chrome לקובץ החשוד.", "invoice_2026.pdf.exe": "זה הקובץ הזדוני עצמו. איזו תוכנה הפעילה אותו?",
    } as Record<string, string>)[lower(p)] ?? ({
      googleupdatetaskmachineua: "זו משימה לגיטימית שיצר GoogleUpdate. איזו משימה יצר PowerShell?", "sync.exe": "sync.exe היא התוכנה שהמשימה מריצה. מה שם המשימה עצמה?",
    } as Record<string, string>)[lower(t)],
    half: ["התוכנה נכונה, שם המשימה לא. חפשו schtasks.", "שם המשימה נכון. עכשיו: מי הפעיל את הקובץ הזדוני?"],
    wrong: "התוכנה ושם המשימה לא מתאימים לראיות.",
    hints: ["חפשו את הקובץ החשוד: <code>grep invoice process.log</code>. מה כתוב אחרי parent=?", "חפשו יצירה של משימות: <code>grep schtasks process.log</code>", "שם המשימה מופיע אחרי /tn, בין המירכאות. איזו מהן נוצרה על ידי powershell.exe?"],
  },
  /* ---------- Stage 5: web attacks ---------- */
  17: { kind: "practice", check: (v) => digits(v) === String(FACTS.notFound), show: 'grep -c " 404 " access.log', tip: "הקלידו grep -c \" 404 \" access.log, כולל המירכאות והרווחים.", after: "רוב ה-404 הם רעש רגיל: בוטים שמחפשים דפים כמו /wp-admin. עכשיו נחפש משהו מסוכן יותר." },
  18: { kind: "practice", check: (v) => v.trim() === "198.51.100.77", show: "grep %27 access.log", tip: "הקלידו grep %27 access.log. הכתובת מופיעה בתחילת כל שורה.", after: "הכתובת הזו שלחה ניסיונות SQL Injection. הוסיפו | urldecode כדי לקרוא אותם." },
  19: { kind: "practice", check: (v) => lower(v).includes("sqlmap"), show: "grep 198.51.100.77 access.log | awk '{print $11}'", tip: "הריצו את הפקודה עם awk '{print $11}'. שם הכלי מופיע מיד אחרי המירכאות.", after: "sqlmap הוא כלי פופולרי לבדיקות חדירה, וגם לתוקפים. שימו לב שכל הבקשות שלו קיבלו 500." },
  20: {
    kind: "final", seconds: 20 * 60,
    check: (tb, ip) => [lower(tb) === "customers", ip.trim() === "203.0.113.141"],
    decoy: (tb, ip) => ({ users: "הניסיון לשלוף מהטבלה users נכשל עם קוד 500.", products: "זו הטבלה שהאתר קורא ממנה כרגיל." } as Record<string, string>)[lower(tb)]
      ?? ({ "198.51.100.77": "הכתובת הזו רק סרקה וקיבלה שגיאות 500. מי קיבל תשובה גדולה עם קוד 200?" } as Record<string, string>)[ip.trim()],
    half: ["הטבלה נכונה, הכתובת לא. מי קיבל את התשובות הגדולות?", "הכתובת נכונה, הטבלה לא. מה כתוב אחרי FROM בבקשות שלה?"],
    wrong: "הטבלה והכתובת לא מתאימות לראיות.",
    hints: ["מיינו לפי גודל: <code>awk '{print $10, $9, $1}' access.log | sort -nr | head</code>", "קחו את הכתובת שקיבלה את התשובות הגדולות ותרגמו את הבקשות שלה: <code>grep 203.0.113.141 access.log | urldecode</code>", "שם הטבלה מופיע אחרי המילה FROM."],
  },
  /* ---------- Stage 6: ransomware ---------- */
  21: { kind: "practice", check: (v) => v.trim() === "203.0.113.140", show: "grep update-check dns.log", tip: "הקלידו grep update-check dns.log והסתכלו בסוף השורה, אחרי answer=.", after: "זו הכתובת שחסמנו בשלב 3. אבל התוקף כבר הכין תוכנית גיבוי." },
  22: { kind: "practice", check: (v) => digits(v) === "60" || /דקה/.test(v), show: "grep update-check dns.log | awk '{print $2}'", tip: "הסתכלו על שתי שעות רצופות, למשל 08:15:00 ו-08:16:00. כמה שניות ביניהן?", after: "בדיוק 60 שניות, שוב ושוב. אף אדם לא גולש ככה." },
  23: { kind: "practice", check: (v) => v.trim() === "203.0.113.142", show: "awk '{print $6, $3, $4}' netflow.log | sort -nr | head -5", tip: "בתוצאה הממוינת, השורה הראשונה היא הגדולה ביותר. היעד הוא המספר השלישי בשורה.", after: "8.4GB לשרת של BulletHost: המידע נגנב לפני ההצפנה. הגיבוי ל-Azure, לעומת זאת, תקין." },
  24: {
    kind: "final", seconds: 25 * 60,
    check: (h, ip) => [lower(h) === "w11-dana", ip.trim() === "198.51.100.150"],
    decoy: (h, ip) => ({
      "w11-ronen": "המחשב של רונן נוקה ובודד אתמול.", "fs-01": "זה השרת שמוצפן, לא המחשב שמצפין.",
      "w11-ori": "המחשב הזה כתב לשרת הקבצים כמויות רגילות בבוקר.", "w11-noa": "המחשב הזה כתב לשרת הקבצים כמויות רגילות בבוקר.", "w11-tal": "המחשב הזה כתב לשרת הקבצים כמויות רגילות בבוקר.",
    } as Record<string, string>)[lower(h)] ?? ({
      "203.0.113.140": "את הכתובת הזו חסמנו אתמול. התוקף עבר לשרת גיבוי.", "203.0.113.142": "לשם נשלח המידע הגנוב. מאיפה מגיעות הפקודות כל 60 שניות?",
      "192.0.2.10": "זה הגיבוי הלילי ל-Azure.",
    } as Record<string, string>)[ip.trim()],
    half: ["המחשב נכון. עכשיו: לאן הוא פונה כל 60 שניות?", "שרת השליטה נכון. איזה מחשב פונה אליו וכותב לשרת הקבצים?"],
    wrong: "המחשב והשרת לא מתאימים לראיות.",
    hints: ["מי כותב לשרת הקבצים? <code>grep FS-01 netflow.log</code>. חפשו כמויות ענק בפורט 445.", "בדקו לאן אותו מחשב פונה: <code>grep W11-DANA dns.log</code>", "ודאו עם <code>iprep</code> שהכתובת היא שרת שליטה."],
  },
};

if (Object.keys(KEYS).length !== LEVELS.length) throw new Error("Every level needs an answer key");

export function keyFor(n: number) { return KEYS[n]; }
export const WRONG_PENALTY_S = 60;
export const HINT_PENALTY_S = 120;
export const SECRET_BONUS_S = 60;

export function checkPractice(n: number, answer: string): Verdict & { after?: string } {
  const k = KEYS[n];
  if (!k || k.kind !== "practice") throw new Error("not a practice level");
  return k.check(answer) ? { correct: true, feedback: k.after, after: k.after } : { correct: false, feedback: `עדיין לא. ${k.tip}` };
}

export function checkFinal(n: number, a: string, b: string): Verdict {
  const k = KEYS[n];
  if (!k || k.kind !== "final") throw new Error("not a final level");
  const [okA, okB] = k.check(a, b);
  if (okA && okB) return { correct: true, feedback: "" };
  if (okA) return { correct: false, feedback: k.half[0] };
  if (okB) return { correct: false, feedback: k.half[1] };
  return { correct: false, feedback: k.decoy(a, b) ?? k.wrong };
}

export function hintFor(n: number, used: number): string | null {
  const k = KEYS[n];
  if (!k) return null;
  if (k.kind === "practice") {
    if (used === 0) return k.tip;
    if (used === 1) return `הריצו בדיוק את הפקודה הזו, וקראו את התוצאה: <code>${k.show.replace(/</g, "&lt;")}</code>`;
    return null;
  }
  return k.hints[used] ?? null;
}

/** 3 stars for a clean run; hints cost more than wrong answers. */
export function starsFor(final: boolean, wrong: number, hints: number) {
  const cost = final ? wrong + hints : wrong + hints * 2;
  return cost === 0 ? 3 : cost <= 2 ? 2 : 1;
}

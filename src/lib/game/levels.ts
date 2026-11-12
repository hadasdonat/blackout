import { STAGE3, STAGE4, STAGE5, STAGE6 } from "./levels-advanced";

/**
 * Everything a player may see about a level. Answers, hints and feedback
 * live on the server (src/lib/server/answers.ts) and never reach the browser.
 */
export interface Level {
  n: number;
  room: number;
  idx: number;
  short: string;
  title: string;
  /** One plain sentence: the whole idea of the task. */
  tldr: string;
  noa: string;
  lesson: string;
  task?: string;
  learned: string[];
  chips: [string, string][];
  final?: {
    caseHtml: string;
    chart?: boolean;
    fields: [{ label: string; placeholder: string }, { label: string; placeholder: string }];
    alerts: string[];
    go: string;
    clockLabel: string;
    winTitle: string;
    winHtml: string;
    debriefHtml: string;
    loseText: string;
    loseTip: string;
  };
}

export const STAGE_NAMES: Record<number, string> = { 1: "לוגים", 2: "פישינג", 3: "מודיעין איומים", 4: "קובץ חשוד", 5: "התקפות על אתרים", 6: "כופרה" };
export const STAGE_COUNT = 6;

const room1: Omit<Level, "n" | "room" | "idx">[] = [
  {
    short: "לוגים", title: "מה זה לוג?",
    tldr: "לוג הוא יומן של המערכת. כל שורה מספרת מה קרה, מתי ואיפה.",
    noa: "היי, אני נועה, ראש המשמרת. לפני שמגיעה התראה אמיתית, נלמד לקרוא את הכלי הכי חשוב שלנו: הלוג.",
    lesson:
      "<p>כל שרת מנהל יומן: שורה אחת לכל דבר שקרה, למשל התחברות או פקודה שהורצה. היומן הזה נקרא <b>לוג</b> (log), ובו אנליסטים מחפשים עקבות של תוקפים.</p>" +
      "<p>כל שורה בנויה מאותם חלקים: זמן, שם השרת, התוכנה שכתבה את השורה, ומה קרה.</p>" +
      "<pre>Nov 01 09:15:02 mail-srv sshd[812]: Accepted password for dana from 10.0.0.5</pre>" +
      "<p>שלוש פקודות ראשונות:</p><ul><li><code>ls</code> מציגה את הקבצים בתיק.</li><li><code>cat README.txt</code> מציגה קובץ שלם.</li><li><code>head auth.log</code> מציגה רק את 10 השורות הראשונות.</li></ul>",
    task: "פתחו את <code>auth.log</code> עם <code>head</code>. מה שם השרת שכתב את הלוג?",
    learned: ["מה זה לוג וממה בנויה שורה", "פקודות ראשונות: ls · cat · head"],
    chips: [["head auth.log", "מציגה את 10 השורות הראשונות של הלוג"], ["head -n 3 auth.log", "מציגה רק 3 שורות ראשונות"]],
  },
  {
    short: "חיפוש", title: "נכנס או לא נכנס?",
    tldr: "grep מוצאת שורות לפי מילה, ו-grep -c סופרת אותן.",
    noa: "יפה מאוד! עכשיו נחפש בתוך הלוג, במקום לקרוא מאות שורות אחת אחרי השנייה.",
    lesson:
      "<p>הלוג מגיע מ-<b>sshd</b>, התוכנה שמנהלת התחברויות מרחוק. שתי מילים בו חשובות במיוחד:</p><ul><li><code>Failed password</code>: מישהו הקליד סיסמה שגויה.</li><li><code>Accepted</code>: ההתחברות הצליחה, ומישהו בפנים.</li></ul>" +
      "<p>לא קוראים את כל הלוג אלא מחפשים בו:</p><ul><li><code>grep Failed auth.log</code> מציגה רק שורות שיש בהן את המילה Failed.</li><li><code>grep -c Failed auth.log</code> סופרת את השורות האלה במקום להציג אותן.</li></ul>",
    task: "כמה ניסיונות התחברות נכשלו הלילה?",
    learned: ["שתי מילים חשובות בלוג: Failed · Accepted", "חיפוש וספירה עם grep"],
    chips: [["grep Failed auth.log", "מציגה רק התחברויות שנכשלו"], ["grep Accepted auth.log", "מציגה רק התחברויות שהצליחו"], ["grep -c Accepted auth.log", "סופרת כמה התחברויות הצליחו"]],
  },
  {
    short: "ספירה", title: "מי מנסה לפרוץ?",
    tldr: "מחברים פקודות עם | כדי לספור ולמיין, ומגלים מי מנסה לפרוץ.",
    noa: "עכשיו נבין מי עומד מאחורי כל הניסיונות האלה. כאן מתחילים לחשוב כמו אנליסטים.",
    lesson:
      "<p>הרבה ניסיונות כושלים הם בדרך כלל ניחוש סיסמאות. יש לזה שתי שיטות נפוצות:</p><ul><li><b>Brute force</b>: הרבה סיסמאות על חשבון אחד.</li><li><b>Password spraying</b>: מעט סיסמאות על הרבה חשבונות, כדי שאף חשבון לא יינעל.</li></ul>" +
      "<p>כדי לראות מי מנסה, מחברים כמה פקודות עם <code>|</code>. הסימן הזה נקרא צינור (pipe), והוא מעביר את הפלט של פקודה אחת לפקודה הבאה. כך סופרים ניסיונות כושלים לפי שם משתמש, שהוא המילה ה-9 בשורה:</p>" +
      "<pre>grep Failed auth.log | awk '{print $9}' | sort | uniq -c | sort -nr</pre>" +
      "<p><code>awk</code> בוחרת מילה מכל שורה, <code>sort</code> ממיינת, <code>uniq -c</code> סופרת כפילויות, ו-<code>sort -nr</code> מסדרת מהגדול לקטן.</p>",
    task: "שנו את הפקודה כך שתספור לפי כתובת IP, המילה ה-11 בשורה. מאיזו כתובת הגיעו הכי הרבה ניסיונות?",
    learned: ["ניחוש סיסמאות: Brute force · Password spraying", "צינור פקודות: awk · sort · uniq"],
    chips: [["grep Failed auth.log | head -3", "מציגה 3 ניסיונות כושלים, כדי לראות את מבנה השורה"], ["grep Failed auth.log | awk '{print $9}' | sort | uniq -c | sort -nr", "סופרת ניסיונות כושלים לפי שם משתמש"], ["grep Failed auth.log | wc -l", "סופרת את כל השורות שעברו בצינור"]],
  },
  {
    short: "האירוע", title: "ההתראה הגיעה",
    tldr: "מי ניסה להיכנס זה מעניין. מי הצליח זה מה שחשוב.",
    noa: "זה אמיתי. מישהו שינה משימה מתוזמנת בשער ה-VPN, ובעוד 30 דקות היא תמחק נתונים. אני סומכת עליכם.",
    lesson: "<p>החפיפה נגמרה. השתמשו בכל מה שלמדתם: מי ניסה להיכנס, ובעיקר מי הצליח. מלאו את דוח הממצאים.</p>",
    learned: ["זיהוי Password spraying בלוג אמיתי", "הצלבת לוגים עם מידע ארגוני", "איך מתגוננים: MFA והגבלת ניסיונות"],
    chips: [["grep Accepted auth.log", "מציגה את כל ההתחברויות שהצליחו"], ["cat roster.txt", "סידור המשמרות, הכוננים והחופשות"], ["cat badge.log", "מי נכנס למשרד ומי יצא"], ["grep Failed auth.log | awk '{print $11}' | sort | uniq -c | sort -nr", "סופרת ניסיונות כושלים לפי כתובת IP"]],
    final: {
      caseHtml: '<div class="tag"><span>INC-0417</span><b>SEV-1</b></div><p>אתם האנליסטים בתורנות. תהליך מחיקה זדוני יתחיל כשהשעון יגיע לאפס. מצאו איזה חשבון נפרץ ומאיזו כתובת IP התוקף התחבר.</p>',
      chart: true,
      fields: [{ label: "החשבון שנפרץ", placeholder: "username" }, { label: "כתובת ה-IP של התוקף", placeholder: "0.0.0.0" }],
      alerts: ["[02:00:04] ALERT  crontab changed on vpn-gw01 by a user account", "[02:00:04] ALERT  scheduled job /tmp/.w runs at 02:30", "[02:00:05] SOC    case-0417 opened and assigned to analyst"],
      go: "השעון רץ. מצאו את החשבון שנפרץ ואת כתובת ה-IP של התוקף.",
      clockLabel: "WIPE IN",
      winTitle: "החדירה נעצרה!",
      winHtml: "<p>החשבון של מיכל שני ננעל, והכתובת <code>203.0.113.77</code> נחסמה. עד שהגעתם, התוקף כבר הספיק לארוז את תיקיית הכספים ולהוסיף משימה מתוזמנת.</p>",
      debriefHtml:
        '<div><h3>מה קרה</h3><div class="tl"><time>23:12</time><span>בוטנט רועש ניסה סיסמאות על root ו-admin. הוא יצר את הקפיצה הגדולה בגרף, ולא הצליח.</span>' +
        "<time>01:38</time><span>התוקף ניסה מעט סיסמאות על חשבונות רבים: password spraying.</span>" +
        "<time>01:47</time><span>התחברות מוצלחת ל-m.shani, עובדת שנמצאת בחופשה.</span>" +
        "<time>01:52</time><span>התוקף השתמש ב-sudo כדי לארוז את <code>/srv/finance</code>.</span>" +
        "<time>01:55</time><span>הוא ערך את crontab, כנראה כדי לתזמן את המחיקה.</span></div></div>" +
        '<div><h3>איך מתגוננים מזה במציאות</h3><ul class="plain"><li>מחייבים אימות רב-שלבי, כדי שסיסמה שנחשפה לא תספיק לבדה.</li><li>מגבילים ניסיונות לפי כתובת IP ולא רק לפי חשבון, כי spraying נשאר מתחת לסף הנעילה.</li><li>משווים התחברויות לנתוני HR ומשמרות. התחברות של עובד בחופשה צריכה להקפיץ התראה.</li></ul></div>',
      loseText: "הזמן נגמר לפני שהתוקף נחסם, והמשימה המתוזמנת רצה.",
      loseTip: "הקפיצה הגדולה בגרף היא לא בהכרח החשובה. מי הצליח להתחבר?",
    },
  },
];

const room2: Omit<Level, "n" | "room" | "idx">[] = [
  {
    short: "פישינג", title: "מה זה פישינג?",
    tldr: "מייל מתחזה לוחץ עליכם לפעול מהר, מגיע משולח מוזר ומבקש פרטים.",
    noa: "בשלב הקודם גילינו שמישהו נכנס עם הסיסמה של מיכל. עכשיו נבין איך הוא השיג אותה. מתחילים מהבסיס.",
    lesson:
      "<p><b>פישינג</b> (phishing) הוא מייל או הודעה שמתחזים לגורם אמין, כדי לגרום לכם ללחוץ על קישור, לפתוח קובץ או למסור סיסמה.</p>" +
      "<p>סימני אזהרה נפוצים:</p><ul><li><b>לחץ ודחיפות</b>: \"תוך שעה\", \"הסיסמה תפוג היום\".</li><li><b>שולח מוזר</b>: כתובת שלא שייכת לחברה, או דומה לה מאוד.</li><li><b>בקשה לפרטים</b>: סיסמה, אשראי או קוד אימות.</li></ul>" +
      "<p>כל מייל מתחיל ב<b>כותרות</b> (headers), ואחריהן התוכן:</p><pre>From: IT Support &lt;it@company.example&gt;\nSubject: עדכון מערכת\nDate: Thu, 30 Oct 2026 09:12</pre>" +
      "<p>בתיק יש 8 מיילים מתיבת הדואר של מיכל. פותחים אותם עם <code>cat</code>, למשל <code>cat mail-01.eml</code>.</p>",
    task: "פתחו את <code>mail-04.eml</code>. מאיזו כתובת מייל הוא נשלח?",
    learned: ["מה זה פישינג ואיך מזהים אותו", "ממה בנוי מייל: כותרות ותוכן"],
    chips: [["cat mail-04.eml", "מציגה את מייל 4 במלואו"], ["head -n 6 mail-01.eml", "מציגה רק את הכותרות של מייל 1"]],
  },
  {
    short: "כותרות", title: "מי באמת שלח?",
    tldr: "את From קל לזייף. Reply-To ו-SPF מספרים מי באמת שלח.",
    noa: "את שורת From קל מאוד לזייף. בואו נראה מה עוד מסתתר בכותרות.",
    lesson:
      "<p>בשורת <code>From</code> אפשר לכתוב כמעט כל שם וכתובת. לכן בודקים גם כותרות נוספות:</p><ul>" +
      "<li><code>Reply-To</code>: לאן תגיע תשובה אם תלחצו \"השב\". אצל מתחזים היא בדרך כלל שונה מה-From.</li>" +
      "<li><code>Return-Path</code>: השרת ששלח את המייל בפועל.</li>" +
      "<li><code>SPF</code>: בדיקה אם השרת ששלח מורשה לשלוח בשם הדומיין. <code>spf=fail</code> הוא סימן אזהרה.</li>" +
      "<li><code>DKIM</code>: חתימה דיגיטלית שמוכיחה שהמייל לא שונה בדרך.</li></ul>" +
      "<p>כדי לחפש בכל המיילים בבת אחת משתמשים בכוכבית: <code>mail-*.eml</code> פירושו \"כל הקבצים שמתחילים ב-mail- ונגמרים ב-.eml\".</p><pre>grep From: mail-*.eml</pre>",
    task: "כמה מיילים נכשלו בבדיקת SPF?",
    learned: ["כותרות שחושפות מתחזים: Reply-To · Return-Path", "בדיקות אימות: SPF · DKIM"],
    chips: [["grep From: mail-*.eml", "מציגה את השולח של כל מייל"], ["grep Reply-To mail-*.eml", "מציגה לאן הולכות התשובות"], ["grep Authentication mail-*.eml", "מציגה את תוצאות בדיקות SPF ו-DKIM"]],
  },
  {
    short: "קישורים", title: "לאן הקישור באמת מוביל?",
    tldr: "הטקסט של קישור יכול להראות כתובת אחת ולהוביל לאחרת.",
    noa: "רוב המתקפות נשענות על קישור אחד. עכשיו נלמד לבדוק לאן הוא מוביל לפני שלוחצים.",
    lesson:
      "<p>לקישור במייל יש שני חלקים: הטקסט שרואים, והכתובת האמיתית שמסתתרת אחרי <code>href</code>. הם לא חייבים להיות זהים:</p>" +
      '<pre>&lt;a href="https://evil.example/login"&gt;https://bank.example&lt;/a&gt;</pre>' +
      "<p>מי שלוחץ על \"bank.example\" מגיע בפועל ל-evil.example. גם הכתובת האמיתית יכולה להטעות:</p><ul>" +
      "<li><b>אותיות דומות</b>: rn נראה כמו m, ו-0 כמו o.</li><li><b>מילים נוספות</b>: company-login.example הוא לא company.example.</li><li><b>תת-דומיין מטעה</b>: company.example.evil.example שייך בעצם ל-evil.example.</li></ul>" +
      "<p>כך מציגים את כל הקישורים: <code>grep href mail-*.eml</code></p>",
    task: "ב-<code>mail-08.eml</code> הטקסט של הקישור שונה מהכתובת האמיתית. לאיזה דומיין הקישור באמת מוביל?",
    learned: ["טקסט הקישור מול הכתובת האמיתית", "דומיינים מתחזים: אותיות דומות ומילים נוספות"],
    chips: [["grep href mail-*.eml", "מציגה את כל הקישורים בכל המיילים"], ["cat mail-08.eml", "מציגה את מייל 8 במלואו"]],
  },
  {
    short: "הפריצה", title: "המייל שפתח את הדלת",
    tldr: "מייל חשוד הוא לא הוכחה. לוג הגלישה מראה מי באמת לחץ ושלח סיסמה.",
    noa: "התוקף שלח את אותו קמפיין לכל החברה, וגל נוסף יוצא בעוד 20 דקות. מצאו את המייל ולאן נשלחה הסיסמה, כדי שנחסום אותו.",
    lesson: "<p>עכשיו בלי חפיפה. בתיק יש גם <code>proxy.log</code>: רשימת האתרים שהמחשב של מיכל גלש אליהם. הצליבו בין המיילים לגלישה.</p>",
    learned: ["זיהוי מייל מתחזה מתוחכם", "הצלבת מיילים עם לוג גלישה", "איך מתגוננים: בדיקת דומיין, מנהל סיסמאות ודיווח"],
    chips: [["cat proxy.log", "האתרים שהמחשב של מיכל גלש אליהם"], ["grep href mail-*.eml", "כל הקישורים בכל המיילים"], ["grep From: mail-*.eml", "השולח של כל מייל"]],
    final: {
      caseHtml: '<div class="tag"><span>INC-0418</span><b>SEV-1</b></div><p>מישהו התחבר בשם מיכל, כלומר הוא השיג את הסיסמה שלה. מצאו איזה מייל גרם לזה ולאיזה דומיין נשלחה הסיסמה. גל מיילים נוסף יוצא כשהשעון יגיע לאפס.</p>',
      fields: [{ label: "המייל המתחזה (שם הקובץ)", placeholder: "mail-00.eml" }, { label: "הדומיין שאליו נשלחה הסיסמה", placeholder: "example.com" }],
      alerts: ["[09:10:11] ALERT  same sender domain seen in 41 mailboxes", "[09:10:12] ALERT  next delivery wave scheduled in 20 minutes", "[09:10:15] SOC    case-0418 opened and assigned to analyst"],
      go: "השעון רץ. מצאו את המייל המתחזה ואת הדומיין שאליו נשלחה הסיסמה.",
      clockLabel: "NEXT WAVE",
      winTitle: "הקמפיין נחסם!",
      winHtml: "<p>הדומיין <code>noctume-portal.example</code> נחסם בכל החברה, ו-41 העובדים שקיבלו את המייל קיבלו אזהרה. מיכל מחליפה סיסמה ומגדירה אימות דו-שלבי.</p>",
      debriefHtml:
        '<div><h3>מה קרה</h3><div class="tl"><time>30/10 16:41</time><span>המייל המתחזה הגיע מ-noctume.example: האותיות rn הוחלפו ב-m.</span>' +
        "<time>16:44</time><span>מיכל לחצה על קישור שהציג כתובת של החברה, אבל הוביל לאתר אחר.</span>" +
        "<time>16:45</time><span>היא הזינה סיסמה (בקשת POST), והאתר העביר אותה לאתר האמיתי כדי שלא תחשוד.</span>" +
        "<time>02/11 01:47</time><span>התוקף התחבר עם הסיסמה. את ההמשך כבר ראיתם בשלב 1.</span></div></div>" +
        '<div><h3>איך מתגוננים מזה במציאות</h3><ul class="plain"><li>בודקים את הדומיין של השולח, ועומדים עם העכבר על קישור לפני שלוחצים.</li><li>מנהל סיסמאות לא ימלא סיסמה באתר מזויף, כי הדומיין לא תואם.</li><li>אימות דו-שלבי הופך סיסמה גנובה לחסרת ערך.</li><li>מדווחים על מייל חשוד: לתוקף מספיק עובד אחד.</li></ul></div>',
      loseText: "גל המיילים הבא יצא לכל החברה לפני שהדומיין נחסם.",
      loseTip: "הצליבו את proxy.log עם המיילים. מי שלח טופס, ולאן?",
    },
  },
];

export const LEVELS: Level[] = [room1, room2, STAGE3, STAGE4, STAGE5, STAGE6]
  .flatMap((stage, s) => stage.map((l, i) => ({ ...l, room: s + 1, idx: i + 1 })))
  .map((l, i) => ({ ...l, n: i + 1 }));
export const LEVEL_COUNT = LEVELS.length;
export const levelLabel = (l: Level) => `שלב ${l.room} · משימה ${l.idx} מתוך 4`;

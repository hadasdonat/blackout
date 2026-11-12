export interface Entry { key: string; show: string; desc: string; ex?: string; room?: number }

export const COMMANDS: Entry[] = [
  { key: "ls", show: "ls", desc: "מציגה את רשימת הקבצים בתיקייה.", ex: "ls" },
  { key: "ls -a", show: "ls -a", desc: "מציגה גם קבצים נסתרים, שהשם שלהם מתחיל בנקודה.", ex: "ls -a" },
  { key: "cat", show: "cat <קובץ>", desc: "מציגה קובץ שלם.", ex: "cat README.txt" },
  { key: "head", show: "head <קובץ>", desc: "מציגה את 10 השורות הראשונות. עם -n 3 רק 3 שורות.", ex: "head -n 3 README.txt" },
  { key: "tail", show: "tail <קובץ>", desc: "מציגה את 10 השורות האחרונות.", ex: "tail -n 3 README.txt" },
  { key: "grep", show: "grep <מילה> <קובץ>", desc: "מציגה רק שורות שיש בהן את המילה.", ex: "grep Accepted auth.log", room: 1 },
  { key: "grep -c", show: "grep -c <מילה> <קובץ>", desc: "סופרת כמה שורות מכילות את המילה, במקום להציג אותן.", ex: "grep -c Accepted auth.log", room: 1 },
  { key: "grep -v", show: "grep -v <מילה>", desc: "הפוך: מציגה רק שורות שאין בהן את המילה.", ex: 'grep Accepted auth.log | grep -v "10.0."', room: 1 },
  { key: "grep -i", show: "grep -i <מילה>", desc: "מחפשת בלי הבדל בין אותיות גדולות לקטנות.", ex: "grep -i failed auth.log | head -3", room: 1 },
  { key: "grep -l", show: "grep -l <מילה> <קבצים>", desc: "מציגה רק את שמות הקבצים שיש בהם את המילה.", ex: "grep -l href mail-*.eml", room: 2 },
  { key: "*", show: "mail-*.eml", desc: "כוכבית מחליפה כל רצף תווים, כך שהפקודה רצה על כל הקבצים המתאימים.", ex: "grep Subject: mail-*.eml", room: 2 },
  { key: "|", show: "פקודה | פקודה", desc: "צינור (pipe): מעביר את הפלט של פקודה אחת לפקודה הבאה.", ex: "cat README.txt | wc -l" },
  { key: "awk", show: "awk '{print $N}'", desc: "בוחרת את המילה ה-N מכל שורה.", ex: "grep Failed auth.log | awk '{print $9}' | head -5", room: 1 },
  { key: "cut", show: "cut -d ' ' -f N", desc: "כמו awk: חותכת כל שורה לפי תו מפריד ובוחרת חלק.", ex: "cat proxy.log | cut -d ' ' -f 5", room: 2 },
  { key: "sort", show: "sort", desc: "ממיינת שורות. עם -nr ממיינת מספרים מהגדול לקטן.", ex: "cat README.txt | sort" },
  { key: "uniq -c", show: "uniq -c", desc: "סופרת שורות זהות שמופיעות ברצף. לכן קודם ממיינים.", ex: "grep Failed auth.log | awk '{print $11}' | sort | uniq -c", room: 1 },
  { key: "wc -l", show: "wc -l", desc: "סופרת כמה שורות הגיעו אליה.", ex: "cat README.txt | wc -l" },
  { key: "iprep", show: "iprep <IP>", desc: "בודקת מוניטין של כתובת IP, כמו באתר AbuseIPDB: ציון סיכון מ-0 עד 100, ספק, מדינה ודיווחים קודמים.", ex: "iprep 198.51.100.23" },
  { key: "whois", show: "whois <דומיין>", desc: "מראה מתי נרשם דומיין ועל שם מי. דומיין שנרשם לפני כמה ימים הוא סימן אזהרה.", ex: "whois noctume-portal.example" },
  { key: "urlscan", show: "urlscan <דומיין>", desc: "סורקת אתר בלי להיכנס אליו, כמו urlscan.io: כותרת הדף, איפה הוא מאוחסן ומה הוא עושה.", ex: "urlscan noctume-portal.example" },
  { key: "vt", show: "vt <קובץ>", desc: "בודקת קובץ מול עשרות מנועי אנטי-וירוס, כמו VirusTotal. אפשר לכתוב שם קובץ או טביעת אצבע.", ex: "vt invoice_2026.pdf.exe", room: 4 },
  { key: "sandbox", show: "sandbox <קובץ>", desc: "מראה מה קובץ עשה כשהריצו אותו בסביבה מבודדת: אילו קבצים יצר ולאן התחבר.", ex: "sandbox invoice_2026.pdf.exe", room: 4 },
  { key: "urldecode", show: "urldecode", desc: "מתרגמת קידוד של כתובות אינטרנט: %27 הופך לגרש ' ו-%20 לרווח.", ex: "grep %27 access.log | urldecode", room: 5 },
  { key: "man", show: "man <פקודה>", desc: "מציגה בטרמינל את ההסבר על פקודה מהמילון.", ex: "man grep" },
  { key: "history", show: "history", desc: "מציגה את הפקודות שהקלדתם. החצים למעלה ולמטה מחזירים אותן.", ex: "history" },
  { key: "clear", show: "clear", desc: "מנקה את המסך.", ex: "clear" },
  { key: "hint", show: "hint", desc: "נותנת רמז לשלב. מורידה כוכב, ובאתגר הסיום גם 2 דקות.", ex: "hint" },
  { key: "submit", show: "submit <א> <ב>", desc: "שולחת את שתי התשובות באתגר הסיום. אפשר גם בטופס שבצד." },
  { key: "help", show: "help", desc: "רשימה קצרה של כל הפקודות.", ex: "help" },
];

export const TERMS: Entry[] = [
  { key: "log", show: "לוג (log)", desc: "יומן שבו מערכת רושמת שורה על כל אירוע." },
  { key: "Failed / Accepted", show: "Failed / Accepted", desc: "התחברות שנכשלה מול התחברות שהצליחה." },
  { key: "Brute force", show: "Brute force", desc: "ניחוש הרבה סיסמאות על חשבון אחד." },
  { key: "Password spraying", show: "Password spraying", desc: "ניחוש מעט סיסמאות על הרבה חשבונות, כדי לא לגרום לנעילה." },
  { key: "From", show: "From", desc: "השולח שמוצג במייל. קל לזייף." },
  { key: "Reply-To", show: "Reply-To", desc: "לאן תגיע תשובה למייל. אצל מתחזים לרוב שונה מה-From." },
  { key: "Return-Path", show: "Return-Path", desc: "השרת ששלח את המייל בפועל." },
  { key: "SPF", show: "SPF", desc: "בודק אם השרת ששלח מורשה לשלוח בשם הדומיין." },
  { key: "DKIM", show: "DKIM", desc: "חתימה דיגיטלית שמוכיחה שהמייל לא שונה בדרך." },
  { key: "href", show: "href", desc: "הכתובת האמיתית שאליה קישור מוביל, גם אם הטקסט שלו אחר." },
  { key: "POST", show: "POST", desc: "בקשה ששולחת מידע לאתר, למשל טופס עם סיסמה." },
  { key: "Threat intel", show: "מודיעין איומים", desc: "מידע משותף על כתובות, דומיינים וקבצים שכבר נקשרו לתוקפים." },
  { key: "Hash", show: "Hash (טביעת אצבע)", desc: "מחרוזת שמזהה קובץ באופן ייחודי. שינוי של תו אחד בקובץ משנה אותה לגמרי." },
  { key: "Sandbox", show: "Sandbox", desc: "סביבה מבודדת שבה מריצים קובץ חשוד כדי לראות מה הוא עושה, בלי לסכן מחשב אמיתי." },
  { key: "Persistence", show: "Persistence", desc: "דרך שבה נוזקה דואגת לרוץ שוב אחרי הפעלה מחדש, למשל משימה מתוזמנת." },
  { key: "SQL Injection", show: "SQL Injection", desc: "הזרקת קוד לשאילתה שהאתר שולח למסד הנתונים, דרך שדה או כתובת." },
  { key: "Status code", show: "קוד תשובה", desc: "200 הצליח, 404 הדף לא נמצא, 500 שגיאה בשרת." },
  { key: "User-Agent", show: "User-Agent", desc: "השם שהדפדפן או הכלי מציג לאתר. כלי תקיפה אוטומטיים לפעמים מסגירים את עצמם בו." },
  { key: "DNS", show: "DNS", desc: "ספר הטלפונים של האינטרנט: מתרגם שם כמו example.com לכתובת IP." },
  { key: "C2", show: "C2 (שרת שליטה)", desc: "השרת שממנו התוקף שולט בנוזקה. הנוזקה פונה אליו שוב ושוב." },
  { key: "Beaconing", show: "Beaconing", desc: "פנייה קבועה של נוזקה לשרת השליטה, למשל כל 60 שניות." },
  { key: "Exfiltration", show: "Exfiltration", desc: "הוצאת מידע מהארגון אל שרת של התוקף." },
  { key: "Ransomware", show: "כופרה (Ransomware)", desc: "נוזקה שמצפינה קבצים ודורשת כופר כדי לשחרר אותם." },
  { key: "MFA", show: "MFA", desc: "אימות רב-שלבי: סיסמה ועוד משהו, כמו קוד בטלפון." },
];

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A one-line explanation of what a typed command does, shown while typing. */
export function describe(line: string): string {
  const parts = line.split("|").map((s) => s.trim()).filter(Boolean);
  const last = parts.at(-1);
  if (!last) return "";
  let best: Entry | undefined;
  for (const d of COMMANDS) {
    if (d.key === "|" || d.key === "*") continue;
    if (new RegExp(`^${escRe(d.key)}(\\s|$)`).test(last) && (!best || d.key.length > best.key.length)) best = d;
  }
  if (!best) {
    const first = last.split(/\s+/)[0];
    best = COMMANDS.find((d) => d.key.split(" ")[0] === first);
  }
  if (!best) return "";
  return (parts.length > 1 ? `צינור של ${parts.length} פקודות. האחרונה: ` : "") + `${best.show} · ${best.desc}`;
}

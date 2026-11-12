/**
 * A fictional threat-intelligence database. The terminal tools (iprep, whois,
 * vt, urlscan, sandbox) read from it, the way analysts use AbuseIPDB, WHOIS,
 * VirusTotal, urlscan.io and a malware sandbox in real investigations.
 * Every name, address and file here is made up.
 */
export interface IpRecord { score: number; country: string; isp: string; reports: number; usage: string }
export interface DomainRecord { created: string; registrar: string; owner: string }
export interface UrlRecord { title: string; ip: string; summary: string[]; verdict: "malicious" | "suspicious" | "clean" }
export interface FileRecord { name: string; size: string; detections: number; engines: number; family: string; firstSeen: string; sandbox: string[] }

/** A stable, fake SHA-256 so the same file always has the same fingerprint. */
export function fakeSha(seed: string): string {
  let h1 = 0x811c9dc5, out = "";
  for (let round = 0; out.length < 64; round++) {
    for (const ch of `${seed}:${round}`) { h1 ^= ch.charCodeAt(0); h1 = Math.imul(h1, 0x01000193) >>> 0; }
    out += h1.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

export const IPS: Record<string, IpRecord> = {
  "203.0.113.77": { score: 97, country: "NL", isp: "BulletHost Ltd (AS64501)", reports: 412, usage: "SSH brute force, password spraying" },
  "198.51.100.23": { score: 88, country: "BR", isp: "VeloNet Broadband", reports: 1203, usage: "Botnet scanner, SSH brute force" },
  "198.51.100.61": { score: 0, country: "IL", isp: "HomeNet Israel", reports: 0, usage: "Residential broadband" },
  "198.51.100.140": { score: 0, country: "IL", isp: "HomeNet Israel", reports: 0, usage: "Residential broadband" },
  "203.0.113.80": { score: 95, country: "NL", isp: "BulletHost Ltd (AS64501)", reports: 37, usage: "Phishing site hosting" },
  "203.0.113.140": { score: 93, country: "NL", isp: "BulletHost Ltd (AS64501)", reports: 58, usage: "Malware command and control (C2)" },
  "203.0.113.141": { score: 90, country: "NL", isp: "BulletHost Ltd (AS64501)", reports: 22, usage: "Web attacks, SQL injection" },
  "203.0.113.142": { score: 91, country: "NL", isp: "BulletHost Ltd (AS64501)", reports: 19, usage: "Data exfiltration staging server" },
  "198.51.100.77": { score: 72, country: "US", isp: "ScanCloud Hosting", reports: 640, usage: "Automated vulnerability scanner" },
  "198.51.100.150": { score: 96, country: "RO", isp: "FastFlux VPS SRL", reports: 81, usage: "Malware command and control (C2), backup server" },
  "192.0.2.10": { score: 0, country: "US", isp: "Microsoft Azure", reports: 0, usage: "Cloud services" },
  "192.0.2.20": { score: 0, country: "US", isp: "Google LLC", reports: 0, usage: "Public DNS resolver" },
  "192.0.2.30": { score: 0, country: "US", isp: "Zoom Video Communications", reports: 0, usage: "Video conferencing" },
  "192.0.2.55": { score: 35, country: "CH", isp: "SecureVPN AG", reports: 14, usage: "Commercial VPN exit node" },
  "198.51.100.200": { score: 8, country: "US", isp: "FastCDN Inc", reports: 2, usage: "Content delivery network" },
};

export const DOMAINS: Record<string, DomainRecord> = {
  "nocturne.example": { created: "2009-03-14", registrar: "Example Registrar Inc", owner: "Nocturne Data Ltd" },
  "noctume.example": { created: "2026-10-27", registrar: "CheapNames LLC", owner: "REDACTED FOR PRIVACY" },
  "noctume-portal.example": { created: "2026-10-28", registrar: "CheapNames LLC", owner: "REDACTED FOR PRIVACY" },
  "mail-noctume.example": { created: "2026-10-27", registrar: "CheapNames LLC", owner: "REDACTED FOR PRIVACY" },
  "pkg-track.example": { created: "2026-09-02", registrar: "CheapNames LLC", owner: "REDACTED FOR PRIVACY" },
  "prize-claims.example": { created: "2025-12-19", registrar: "QuickDomains", owner: "REDACTED FOR PRIVACY" },
  "hr-weekly.example": { created: "2016-05-02", registrar: "Example Registrar Inc", owner: "HR Weekly Media" },
  "update-check.example": { created: "2026-10-29", registrar: "CheapNames LLC", owner: "REDACTED FOR PRIVACY" },
  "cdn-sync.example": { created: "2026-10-29", registrar: "CheapNames LLC", owner: "REDACTED FOR PRIVACY" },
  "zoom.example": { created: "2011-06-30", registrar: "Example Registrar Inc", owner: "Zoom Video Communications" },
};

export const URLS: Record<string, UrlRecord> = {
  "noctume-portal.example": { title: "Nocturne Data · Sign in", ip: "203.0.113.80", verdict: "malicious", summary: ["דף התחברות שמעתיק את הלוגו והעיצוב של Nocturne Data", "הטופס שולח שם משתמש וסיסמה אל /login באותו אתר", "אחרי השליחה, מעביר את הגולש לאתר האמיתי portal.nocturne.example"] },
  "portal.nocturne.example": { title: "Nocturne Data Portal", ip: "192.0.2.10", verdict: "clean", summary: ["הפורטל הרשמי של החברה", "תעודת אבטחה תקפה על שם Nocturne Data Ltd"] },
  "pkg-track.example": { title: "404 Not Found", ip: "198.51.100.200", verdict: "suspicious", summary: ["הדף כבר לא קיים", "הדומיין שימש בעבר לקמפיין הונאת משלוחים"] },
  "prize-claims.example": { title: "Claim your prize!", ip: "198.51.100.200", verdict: "malicious", summary: ["טופס שמבקש פרטי כרטיס אשראי"] },
};

const FILE_LIST: { name: string; size: string; detections: number; family: string; firstSeen: string; sandbox: string[] }[] = [
  { name: "Zoom_Installer.exe", size: "84 MB", detections: 0, family: "-", firstSeen: "2026-08-01", sandbox: ["מתקין את Zoom בתיקיית Program Files", "מתחבר ל-zoom.example בלבד", "לא נמצאה התנהגות חשודה"] },
  { name: "invoice_2026.pdf.exe", size: "412 KB", detections: 52, family: "Nightjar (trojan downloader)", firstSeen: "2026-10-30", sandbox: [
    "1. מציג מסמך PDF ריק כדי שהקורבן לא יחשוד",
    "2. מפעיל PowerShell מוסתר עם פקודה מוצפנת (-enc)",
    "3. יוצר את הקובץ C:\\Users\\ronen\\AppData\\Roaming\\OneDriveSync\\sync.exe",
    "4. מתחבר אל update-check.example (203.0.113.140) בפורט 443, כל 60 שניות",
    "5. דואג לרוץ שוב אחרי הפעלה מחדש של המחשב (persistence)",
  ] },
  { name: "team_photo.jpg", size: "2.1 MB", detections: 0, family: "-", firstSeen: "2026-11-02", sandbox: ["קובץ תמונה רגיל. לא רץ כקוד."] },
  { name: "budget_q4.xlsx", size: "96 KB", detections: 0, family: "-", firstSeen: "2026-11-04", sandbox: ["גיליון Excel בלי מאקרו", "לא נמצאה התנהגות חשודה"] },
  { name: "free_pdf_converter.exe", size: "6.3 MB", detections: 3, family: "PUA (adware)", firstSeen: "2025-04-11", sandbox: ["מתקין תוסף פרסומות לדפדפן", "לא מתחבר לשרתים זדוניים מוכרים", "3 מנועים בלבד מזהים: כנראה תוכנה לא רצויה, לא נוזקה"] },
];
export const FILES_INTEL: Record<string, FileRecord> = Object.fromEntries(
  FILE_LIST.map((f) => [fakeSha(f.name), { ...f, engines: 70 }]),
);
export const shaOf = (name: string) => fakeSha(name);

/**
 * Password rules, shared by the sign-up form (live checklist) and the server
 * (the real check). Kept short and human: length matters most.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

// The most common passwords and keyboard walks; anything here is refused.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789", "1234567890", "11111111", "00000000",
  "qwerty123", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "abc12345", "abcd1234", "iloveyou", "admin123", "welcome1",
  "letmein1", "sunshine1", "princess1", "football1", "monkey123", "dragon123", "blackout", "blackout1", "blackout123",
  "cyber123", "hacker123", "a1b2c3d4", "zxcvbnm1", "asdfghjk", "q1w2e3r4", "aa123456", "israel123", "shalom123",
]);

export interface PasswordCheck { id: string; label: string; ok: boolean }

export function passwordChecks(password: string, nickname = ""): PasswordCheck[] {
  const p = password, lower = p.toLowerCase(), nick = nickname.trim().toLowerCase();
  return [
    { id: "length", label: `לפחות ${PASSWORD_MIN} תווים`, ok: p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX },
    { id: "letter", label: "לפחות אות אחת", ok: /\p{L}/u.test(p) },
    { id: "digit", label: "לפחות ספרה אחת", ok: /\d/.test(p) },
    { id: "common", label: "לא סיסמה נפוצה ולא השם שלכם", ok: p.length > 0 && !COMMON.has(lower) && !(nick.length >= 3 && lower.includes(nick)) && !/^(.)\1+$/.test(p) },
  ];
}

export const passwordProblem = (password: string, nickname = ""): string | null =>
  passwordChecks(password, nickname).find((c) => !c.ok)?.label ?? null;

/** Nicknames are compared after Unicode normalization, so look-alike spellings count as taken. */
export const normalizeNickname = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ");

const RESERVED = ["admin", "administrator", "root", "system", "moderator", "blackout", "noa", "נועה", "מנהל", "מנהלת", "מנהלה", "support"];
export const reservedNickname = (s: string) => RESERVED.includes(normalizeNickname(s).toLowerCase());

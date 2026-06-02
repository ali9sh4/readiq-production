// Iraqi mobile phone validation + normalization.
//
// Shared by the web profile self-serve edit (app/user_dashboard/profile) and
// the admin instructor edit (InstructorDetailDialog -> updateInstructorPhone).
// Phone is an OPTIONAL field: empty / unset input is valid and normalizes to
// "" (an explicit "no phone on file"). This module is a pure function with no
// server-only imports, so it is safe to import into the client profile page.
//
// CANONICAL STORED FORMAT: local Iraqi mobile, "07XXXXXXXXX" (11 digits, no
// country code). Chosen to match the existing business-number convention in
// app/wallet/topup/constants.ts ("07886552919"); topupWhatsappIntl() already
// derives the +964 international form from a local number when a wa.me link is
// needed, so storing the local form keeps one consistent shape across the app.
//
// Accepts on input (then normalizes down to the canonical 07… form):
//   07XXXXXXXXX       — already canonical
//   +9647XXXXXXXXX    — international (E.164)
//   009647XXXXXXXXX   — international with 00 trunk
//   9647XXXXXXXXX     — bare country code
// Spaces, dashes, parentheses are stripped before matching.

export type PhoneResult =
  | { ok: true; value: string } // canonical "07XXXXXXXXX", or "" when unset
  | { ok: false; error: string };

const IRAQI_LOCAL_RE = /^07\d{9}$/;

export function normalizeIraqiPhone(
  raw: string | null | undefined
): PhoneResult {
  // Optional field: null/undefined is valid and means "no phone".
  if (raw == null) return { ok: true, value: "" };

  // Strip formatting characters; a leading "+" is preserved for the +964 case.
  const stripped = raw.replace(/[\s\-().]/g, "");
  if (stripped === "") return { ok: true, value: "" };

  // Collapse any accepted international prefix to the local 0-trunk form.
  let digits = stripped;
  if (digits.startsWith("+964")) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("00964")) {
    digits = "0" + digits.slice(5);
  } else if (digits.startsWith("964")) {
    digits = "0" + digits.slice(3);
  }

  if (!IRAQI_LOCAL_RE.test(digits)) {
    return {
      ok: false,
      error: "رقم هاتف غير صالح. استخدم الصيغة 07XXXXXXXXX",
    };
  }

  return { ok: true, value: digits };
}

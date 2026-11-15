/**
 * Programmatic claim verifier for Step 5 openers (client-side hard gate).
 *
 * Copied verbatim from the lead-profiler app (src/lib/claim-verifier.ts) —
 * pure logic, no server dependencies. The MCP package runs this AFTER the
 * API returns an opener: if the LLM fabricated a count, location, or metric
 * that cannot be traced to user_services or the observation, the opener is
 * rejected and regenerated (up to N times) before it is ever shown as final.
 */

import type { UserServices, LeadObservation } from "./types.js";

export interface ClaimCheckResult {
  passed: boolean;
  rejected_claims: RejectedClaim[];
  warnings: string[];
}

interface RejectedClaim {
  claim_text: string;
  claim_type: "count_with_noun" | "percentage_metric" | "worked_with_count" | "other";
  reason: string;
  pattern_matched: string;
}

// Arabic + English numerals
const NUM = "(\\d+|[٠-٩]+)";

// Nouns that, when paired with a number, indicate a social-proof style claim
const SOCIAL_PROOF_NOUNS_EN = [
  "doctors?", "clinics?", "clients?", "customers?", "stores?",
  "dentists?", "lawyers?", "businesses?", "companies?", "patients?",
  "practices?", "shops?", "boutiques?", "agencies?", "students?",
  "teachers?", "engineers?", "restaurants?", "salons?", "gyms?",
].join("|");

const SOCIAL_PROOF_NOUNS_AR = [
  "طبيب", "أطباء", "عياد", "عملاء", "زباين", "زبائن",
  "متاجر", "شركات", "محلات", "صالونات", "مطاعم",
  "محام", "مهندس", "طلاب", "معلم",
].join("|");

// Gulf cities (English + Arabic transliterations)
const GULF_CITIES_EN = [
  "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar",
  "Dhahran", "Qatif", "Tabuk", "Abha", "Khamis Mushait",
  "Buraidah", "Hail", "Hofuf", "Jubail", "Najran", "Yanbu",
  "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah",
  "Doha", "Manama", "Kuwait City", "Muscat",
].join("|");

const GULF_CITIES_AR = [
  "الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر",
  "الظهران", "القطيف", "تبوك", "أبها", "خميس مشيط",
  "بريدة", "حائل", "الأحساء", "الهفوف", "الجبيل", "نجران", "ينبع",
  "دبي", "أبوظبي", "الشارقة", "عجمان", "رأس الخيمة", "الفجيرة",
  "الدوحة", "المنامة", "مدينة الكويت", "مسقط",
].join("|");

// Patterns to scan for
const PATTERNS: Array<{ name: string; regex: RegExp; type: RejectedClaim["claim_type"] }> = [
  // English: "3 doctors in Riyadh", "14 dental clinics in Jeddah"
  {
    name: "count_with_noun_in_location_en",
    regex: new RegExp(`\\b${NUM}\\s+(${SOCIAL_PROOF_NOUNS_EN})\\s+in\\s+(${GULF_CITIES_EN})`, "gi"),
    type: "count_with_noun",
  },
  // English: "I've worked with 14 dental clinics"
  {
    name: "worked_with_count_en",
    regex: new RegExp(`I(?:'ve| have)?\\s+(?:worked\\s+with|helped|built\\s+for|served|worked\\s+on)\\s+${NUM}\\s+`, "gi"),
    type: "worked_with_count",
  },
  // English: "22%", "40% increase", etc.
  {
    name: "percentage_en",
    regex: new RegExp(`\\b${NUM}\\s*%`, "g"),
    type: "percentage_metric",
  },
  // Arabic: "٣ عيادات في الرياض" or "3 عيادات في الرياض"
  {
    name: "count_with_noun_in_location_ar",
    regex: new RegExp(`(${NUM})\\s*(${SOCIAL_PROOF_NOUNS_AR})\\s*(?:في|بـ|ب)\\s*(${GULF_CITIES_AR})`, "gu"),
    type: "count_with_noun",
  },
  // Arabic: "ساعدت ٤ أطباء" / "عملت مع ٣ عيادات"
  {
    name: "worked_with_count_ar",
    regex: new RegExp(`(?:ساعدت|عملت\\s+مع|بنيت\\s+لـ|صممت\\s+لـ)\\s+${NUM}\\s+`, "gu"),
    type: "worked_with_count",
  },
  // Arabic: "٢٢٪" or "22%"
  {
    name: "percentage_ar",
    regex: new RegExp(`(${NUM})\\s*[٪%]`, "gu"),
    type: "percentage_metric",
  },
];

// ---------------------------------------------------------------------------
// Salutation-name check — the greeting must not invent a person
// ---------------------------------------------------------------------------

const SALUTATION_STOPWORDS = new Set([
  // English generic addressees + honorifics
  "there", "everyone", "friend", "friends", "team", "sir", "madam", "boss",
  "folks", "all", "i", "you", "mr", "mrs", "ms", "dr",
  // Arabic honorifics / generic addressees
  "أستاذ", "أستاذة", "أخي", "أختي", "صديقي", "عمي", "خالي",
]);

const EN_GREETING_RE = /^\s*(?:hello|hi|hey|dear|good\s+(?:morning|afternoon|evening))\b[\s,،!–—-]*/i;
const EN_NAME_RE = /^([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)/;
const AR_GREETING_RE = /^\s*(?:السلام\s+عليكم(?:\s+ورحمة\s+الله(?:\s+وبركاته)?)?|أهلا(?:\s*وسهلا)?|مرحباً?|صباح\s+الخير|مساء\s+الخير)[\s,،!–—-]*/u;
const AR_NAME_RE = /^([\u0621-\u064A]{2,})(?:\s+([\u0621-\u064A]{2,}))?/u;

/**
 * If the opener opens with a greeting + personal name, that name must exist
 * in the source data. The model has been observed inventing names ("Hello Priya")
 * for leads whose owner name was never established.
 */
function checkSalutation(
  openerText: string,
  sourceBlob: string,
  rejected: RejectedClaim[],
): void {
  const text = openerText.trim();
  if (!text) return;

  // A captured "name" only counts as a name if it is followed by a separator
  // (comma, dash, colon, end) — otherwise it is just the first word of a sentence.
  const SEP_AFTER_RE = /^\s*(?:[،,;:!؟?—–-]|$)/;

  let name: string | null = null;

  const en = EN_GREETING_RE.exec(text);
  if (en) {
    const rest = text.slice(en[0].length);
    const nm = EN_NAME_RE.exec(rest);
    if (nm && SEP_AFTER_RE.test(rest.slice(nm[0].length))) name = nm[1];
  } else {
    const ar = AR_GREETING_RE.exec(text);
    if (ar) {
      const rest = text.slice(ar[0].length);
      const nm = AR_NAME_RE.exec(rest);
      if (nm && SEP_AFTER_RE.test(rest.slice(nm[0].length))) name = nm[1];
      // A leading و (wa-) means the word is part of the greeting phrase, not a name
      if (name && name.startsWith("و")) return;
    }
  }

  if (!name) return;

  const key = name.toLowerCase();
  if (key.length < 2) return;
  if (SALUTATION_STOPWORDS.has(key)) return;

  if (!sourceBlob.includes(key)) {
    rejected.push({
      claim_text: `salutation name "${name}"`,
      claim_type: "other",
      reason: `the name "${name}" does not appear anywhere in user_services or the observation — the greeting invented a person`,
      pattern_matched: "salutation_name",
    });
  }
}

/**
 * Build a single source-text blob from user_services + observation data,
 * so we can do simple substring checks.
 */
function buildSourceBlob(userServices: UserServices, observation: LeadObservation): string {
  const parts: string[] = [];
  // Lead identity fields — a greeting may legitimately address the lead by name
  parts.push(observation.lead_name ?? "");
  parts.push(observation.profession ?? "");
  parts.push(observation.apparent_subculture ?? "");
  parts.push(observation.westernization_signals ?? "");
  parts.push(userServices.primary ?? "");
  parts.push(userServices.secondary ?? "");
  parts.push(userServices.track_record ?? "");
  parts.push(userServices.service_depth ?? "");
  for (const ex of userServices.past_work_examples ?? []) {
    parts.push(ex);
  }
  // Observation notes
  const n = observation.observation_notes;
  parts.push(n.pace, n.people_orientation, n.content_shape, n.engagement, n.self_presentation, n.pressure_tells);
  // Digital presence audit
  const a = observation.digital_presence_audit;
  if (a) {
    parts.push(
      a.website_notes ?? "",
      a.booking_notes ?? "",
      a.google_reviews_notes ?? "",
      a.competitor_digital_presence ?? "",
      a.customer_complaint_pattern ?? "",
    );
  }
  parts.push(observation.additional_context ?? "");
  return parts.join(" \n ").toLowerCase();
}

/**
 * Check if a number appears in the source blob.
 * Handles Arabic and ASCII numerals.
 */
function numberInSource(num: string, sourceBlob: string): boolean {
  const lower = num.toLowerCase();
  if (sourceBlob.includes(lower)) return true;
  // Convert Arabic numerals to ASCII and try again
  const ascii = lower.replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 0x30));
  if (ascii !== lower && sourceBlob.includes(ascii)) return true;
  return false;
}

/**
 * Check if a city name appears in the source blob.
 */
function cityInSource(city: string, sourceBlob: string): boolean {
  return sourceBlob.includes(city.toLowerCase());
}

/**
 * Verify every specific claim in the opener against the source data.
 */
export function verifyOpener(
  openerText: string,
  userServices: UserServices,
  observation: LeadObservation,
): ClaimCheckResult {
  const sourceBlob = buildSourceBlob(userServices, observation);
  const rejected: RejectedClaim[] = [];
  const warnings: string[] = [];

  for (const { name, regex, type } of PATTERNS) {
    // Reset regex lastIndex for global regexes
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(openerText)) !== null) {
      const fullMatch = match[0];

      // Extract the number from the match (group 1 or first digit group)
      const numGroup = match[1] || match[0].match(/\d+|[٠-٩]+/)?.[0] || "";

      // For patterns with a location (groups 3 or 2 depending on pattern), extract it
      const locationGroup = match[3] || match[2] || "";

      // Verify the number appears in the source
      const numOk = numberInSource(numGroup, sourceBlob);

      // Verify the location appears in the source (if a location was matched)
      const locationOk = !locationGroup || cityInSource(locationGroup, sourceBlob);

      if (!numOk || !locationOk) {
        const reasons: string[] = [];
        if (!numOk) reasons.push(`number "${numGroup}" not found in user_services or observation_notes`);
        if (!locationOk) reasons.push(`location "${locationGroup}" not found in source data`);

        rejected.push({
          claim_text: fullMatch,
          claim_type: type,
          reason: reasons.join("; "),
          pattern_matched: name,
        });
      } else {
        // Number + location both verifiable — but flag for human review if it's a percentage
        if (type === "percentage_metric") {
          warnings.push(
            `Percentage "${fullMatch}" found in opener — verify this number appears in your user_services or observation notes before sending.`,
          );
        }
      }
    }
  }

  // Greeting must not address a person the sources never established
  checkSalutation(openerText, sourceBlob, rejected);

  return {
    passed: rejected.length === 0,
    rejected_claims: rejected,
    warnings,
  };
}

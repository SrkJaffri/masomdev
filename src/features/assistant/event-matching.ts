/**
 * Tolerant event-name matching for the MASOM Assistant.
 *
 * Visitors ask in English, Roman Urdu, or a mixture, with wildly varying
 * spellings ("shahadat" vs "martyrdom", "Zehra" vs "Zahra", "Ashura" vs
 * "Ashoora", "Zain-ul-Abideen" vs "zainulabideen"). This module maps both the
 * question and the stored MASOM title onto the same canonical tokens and
 * scores the overlap.
 *
 * It matches NAMES ONLY — it never decides a date. The Gregorian/Hijri date of
 * a matched event always comes from the calendar engine.
 *
 * Pure and dependency-free so it stays cheap and predictable.
 */

/** Pure noise: honorifics, Arabic connectors, and Urdu/English question words. */
const DROP_TOKENS = new Set([
  // Honorific suffixes as they appear in MASOM titles.
  "as", "sa", "ra", "swt", "saww", "sawa", "pbuh", "aj", "ajtf", "la", "ref",
  // Arabic/Persian connectors inside compound names (Zain-ul-Abideen, Ibne).
  "e", "ul", "us", "uz", "ud", "un", "an", "al", "ibne", "ibn", "bin", "binte",
  "bint", "ibn e", "tul",
  // Roman Urdu question scaffolding.
  "kab", "kya", "kaun", "kaunsi", "konsi", "kis", "kitni", "hai", "hain", "ho",
  "hoga", "hogi", "hoti", "hota", "ka", "ki", "ke", "ko", "mein", "me", "par",
  "aur", "wala", "wali", "din", "tarikh", "tareekh", "saal", "batao", "bata",
  // English question scaffolding.
  "when", "what", "which", "date", "day", "year", "is", "are", "the", "of",
  "on", "in", "to", "and", "for", "does", "do", "fall", "falls", "happen",
  "occur", "this", "next", "tell", "about", "me", "please",
]);

/**
 * Tokens that rank but are not distinguishing on their own: every second MASOM
 * event contains "Imam" or "Wiladat". A question made only of these is
 * genuinely ambiguous and must be sent back for clarification.
 */
const GENERIC_TOKENS = new Set([
  "imam", "hazrat", "bibi", "shehzadi", "syed", "syeda", "sayeda", "sayedda",
  "maula", "mowla", "janab", "prophet", "holy", "masoom", "masooma",
  "wiladat", "shahadat", "wafat", "ziarat", "shab", "eid", "jashn", "majlis",
  "battle", "wedding", "mourning", "historical", "soyem", "mehndi", "namaz",
  "program", "event", "islamic",
]);

/**
 * Spelling/vocabulary variants → one canonical token. The canonical form is
 * whichever spelling the MASOM calendar itself uses, so stored titles and
 * visitor questions converge.
 */
const TOKEN_ALIASES: Record<string, string> = {
  // --- Event types -------------------------------------------------------
  wilaadat: "wiladat", wilada: "wiladat", birth: "wiladat", birthday: "wiladat",
  milad: "wiladat", meelad: "wiladat", paidaish: "wiladat", jashn: "wiladat",
  jashne: "wiladat",
  martyrdom: "shahadat", martyr: "shahadat", shahaadat: "shahadat",
  shahadhat: "shahadat", shahid: "shahadat", shaheed: "shahadat",
  wafaat: "wafat", death: "wafat", demise: "wafat", rehlat: "wafat",
  ziyarat: "ziarat", ziyara: "ziarat",
  night: "shab", eed: "eid",
  // --- Names -------------------------------------------------------------
  hassan: "hasan",
  hussein: "hussain", husain: "hussain", husayn: "hussain", husein: "hussain",
  hussian: "hussain", hussyn: "hussain",
  mohammad: "mohammad", muhammad: "mohammad", mohammed: "mohammad",
  muhammed: "mohammad", mohamad: "mohammad",
  zehra: "zehra", zahra: "zehra", zahraa: "zehra",
  fatema: "fatima", fathima: "fatima", fatimah: "fatima",
  asqari: "askari",
  taki: "taqi",
  kadhim: "kazim", kadim: "kazim", moosa: "moosa", musa: "moosa", moosaa: "moosa",
  reza: "raza", ridha: "raza", rida: "raza",
  jaffar: "jafar", jaffer: "jafar", jafer: "jafar", jaafar: "jafar",
  sadeq: "sadiq", sadaq: "sadiq",
  baqar: "baqir", bakir: "baqir",
  abidin: "abideen", abedin: "abideen", zayn: "zain",
  mehdi: "mehdi", mahdi: "mehdi", mahdee: "mehdi",
  kasim: "qasim", qasem: "qasim",
  asgar: "asghar",
  zaynab: "zainab", zenab: "zainab",
  sakinah: "sakina",
  khadijah: "khadija",
  masuma: "masooma", masoomah: "masooma",
  // --- Occasions ---------------------------------------------------------
  fitar: "fitr",
  adha: "azha", adhaa: "azha", azhaa: "azha", bakra: "azha", bakrid: "azha",
  ghadir: "ghadeer",
  mubahala: "mubahila", mubahela: "mubahila",
  arbaen: "arbaeen", arbain: "arbaeen", chehlum: "arbaeen", chehlam: "arbaeen",
  chaliswan: "arbaeen",
  ashura: "ashoora", ashoor: "ashoora", ashurah: "ashoora",
  qader: "qadr", quadr: "qadr",
  barat: "baraat", braat: "baraat",
  mairaj: "meraj", miraj: "meraj", meiraj: "meraj", meraaj: "meraj",
  bisat: "besat", baisat: "besat", "be'sat": "besat",
  moharram: "muharram",
  ramadan: "ramzan", ramadhan: "ramzan",
  karbala: "karbala",
};

/** Lowercase, de-accent, and split on anything that is not a letter or digit. */
export function normalizeTokens(value: string): string[] {
  return value
    .normalize("NFD")
    // Strip combining marks so accented input still matches plain ASCII titles.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function canonicalize(tokens: string[]): string[] {
  const result: string[] = [];
  for (const raw of tokens) {
    if (DROP_TOKENS.has(raw)) continue;
    const token = TOKEN_ALIASES[raw] ?? raw;
    if (DROP_TOKENS.has(token)) continue;
    // Single letters survive normalization of things like "S.A." — drop them.
    if (token.length < 2) continue;
    result.push(token);
  }
  return result;
}

export type MatchCandidate = {
  id: string;
  title: string;
  category: string;
};

export type ScoredMatch<T extends MatchCandidate> = {
  candidate: T;
  score: number;
};

export type MatchOutcome<T extends MatchCandidate> = {
  matches: ScoredMatch<T>[];
  /**
   * True when the question contained only generic words ("wiladat kab hai",
   * "eid"), so the assistant must ask which event is meant instead of guessing.
   */
  needsMoreDetail: boolean;
};

/**
 * Scores every candidate against the visitor's phrasing.
 *
 * score = share of the question's canonical tokens present in the title
 *       + 0.6 when the whole question appears inside the title (exact phrase)
 *       + up to 0.2 for a tight title (fewer unmatched title words)
 *
 * Only candidates within 0.15 of the best score are returned, so an
 * unmistakable match comes back alone and a real tie comes back as a list for
 * the assistant to disambiguate.
 */
export function matchEvents<T extends MatchCandidate>(
  query: string,
  candidates: T[],
  limit = 5,
): MatchOutcome<T> {
  const queryTokens = canonicalize(normalizeTokens(query));
  if (queryTokens.length === 0) return { matches: [], needsMoreDetail: true };

  const querySquashed = queryTokens.join("");
  const specificQueryTokens = queryTokens.filter((token) => !GENERIC_TOKENS.has(token));

  const scored: ScoredMatch<T>[] = [];

  for (const candidate of candidates) {
    const haystack = `${candidate.title} ${candidate.category}`;
    const titleTokens = canonicalize(normalizeTokens(haystack));
    if (titleTokens.length === 0) continue;

    const titleTokenSet = new Set(titleTokens);
    const titleSquashed = titleTokens.join("");

    const matchedTokens = queryTokens.filter(
      // Substring fallback catches compounds the tokenizer split differently
      // ("zainulabideen" vs "zain ul abideen").
      (token) => titleTokenSet.has(token) || titleSquashed.includes(token),
    );
    if (matchedTokens.length === 0) continue;

    // A question with a real name must hit that name — otherwise "Wiladat Imam
    // Hasan Askari" would half-match every other "Wiladat: Imam ..." event.
    if (specificQueryTokens.length > 0) {
      const hitSpecific = specificQueryTokens.some(
        (token) => titleTokenSet.has(token) || titleSquashed.includes(token),
      );
      if (!hitSpecific) continue;
    }

    let score = matchedTokens.length / queryTokens.length;
    if (titleSquashed.includes(querySquashed)) score += 0.6;
    score += 0.2 * (matchedTokens.length / titleTokens.length);

    scored.push({ candidate, score });
  }

  if (scored.length === 0) {
    return { matches: [], needsMoreDetail: specificQueryTokens.length === 0 };
  }

  scored.sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title));

  const best = scored[0].score;
  const matches = scored.filter((entry) => entry.score >= best - 0.15).slice(0, limit);

  return {
    matches,
    // Ambiguous AND unspecific ("wiladat kab hai") — ask rather than list 20.
    needsMoreDetail: specificQueryTokens.length === 0 && matches.length > 1,
  };
}

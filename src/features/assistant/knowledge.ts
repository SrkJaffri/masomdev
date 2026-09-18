import { siteConfig } from "@/config/site";

/**
 * MASOM site knowledge base.
 *
 * Curated, in-repo facts for the parts of the website that are NOT stored in
 * the database (mission, contacts, committee, forms, donation instructions).
 * Everything here is transcribed from the live MASOM pages — nothing is
 * invented — and each entry carries the page it came from so the assistant can
 * always point the visitor at the source.
 *
 * WHY LEXICAL, NOT EMBEDDINGS
 *   Structured facts (dates, timings, programs) must never be answered from
 *   prose. This knowledge base intentionally contains NO calendar dates, NO
 *   prayer timings and NO program listings — those come only from the
 *   database tools. Keeping the search deterministic and keyword-scored means
 *   it cannot "nearly match" a date question and pre-empt the calendar tool.
 */

export type KnowledgeEntry = {
  id: string;
  title: string;
  /** Site path the facts came from, returned with every answer. */
  path: string;
  /** Extra match terms, including common Roman Urdu phrasings. */
  keywords: string[];
  content: string;
};

const { contact } = siteConfig;

export const knowledgeBase: KnowledgeEntry[] = [
  {
    id: "about-masom",
    title: "About MASOM",
    path: "/",
    keywords: [
      "about",
      "masom",
      "who",
      "organization",
      "imambargah",
      "shia",
      "community",
      "full form",
      "kaun",
      "kya hai",
      "taaruf",
    ],
    content: [
      "MASOM stands for the Midwest Association of Shia Organized Muslims.",
      "MASOM operates the MASOM Imambargah in Chicago, Illinois, serving the Shia Muslim community of the Midwest.",
      `The Imambargah is located at ${contact.address.full}.`,
    ].join(" "),
  },
  {
    id: "mission",
    title: "Our Mission",
    path: "/our-mission",
    keywords: [
      "mission",
      "goal",
      "goals",
      "purpose",
      "objective",
      "aims",
      "vision",
      "maqsad",
      "mission kya hai",
    ],
    content: [
      "MASOM's stated goals are:",
      "(1) To promote religious and educational activities.",
      "(2) To provide religious services and education to the community, including majalis, jashns, marriages and funerals.",
      "(3) To promote unity and cooperation among the community.",
      "(4) To celebrate and commemorate Islamic occasions, including daily congregation prayers, Friday prayers, Eid reunions, Majalis, processions and jashans.",
    ].join(" "),
  },
  {
    id: "contact",
    title: "Contact MASOM",
    path: "/contacts",
    keywords: [
      "contact",
      "phone",
      "call",
      "email",
      "address",
      "location",
      "where",
      "directions",
      "map",
      "visit",
      "secretary",
      "rabta",
      "pata",
      "kahan",
      "number",
    ],
    content: [
      `Phone: ${contact.phone}.`,
      `Email: ${contact.email} (Secretary of MASOM).`,
      `Address: ${contact.address.full}.`,
      "The Contact page also has a contact form and a Google Map with directions to the Imambargah.",
    ].join(" "),
  },
  {
    id: "committee",
    title: "Executive Committee",
    path: "/our-members",
    keywords: [
      "committee",
      "executive",
      "president",
      "vice president",
      "secretary",
      "treasurer",
      "members",
      "leadership",
      "office bearers",
      "sadar",
      "zimmedar",
    ],
    content: [
      "MASOM's Executive Committee: President — Mussaddiq (Akhter) Naqvi; Vice President — Imran Aziz Zaidi;",
      "Secretary — Ahmed Abbas; Executive Secretary — Nasir Hussain; Treasurer — Ali Nasir.",
      "Contact numbers for each officer are listed on the Our Committee page.",
    ].join(" "),
  },
  {
    id: "sub-committees",
    title: "Sub Committees",
    path: "/our-members",
    keywords: [
      "sub committee",
      "subcommittee",
      "committees",
      "volunteer",
      "ladies committee",
      "youth",
      "funeral",
      "ziarat",
      "program committee",
      "parking",
      "security",
    ],
    content: [
      "MASOM sub committees include: Program, Building, Taburuk, Fundraising, Finance, Audit, Aalim,",
      "Wadi E MASOM, Funeral, Ziarat, Ladies, IT/AV/Communication, Safety and Security, Parking,",
      "Procession, Public Relations and Youth Committees.",
      "Members of each committee are listed on the Our Committee page. To volunteer or support a committee, contact MASOM.",
    ].join(" "),
  },
  {
    id: "forms",
    title: "Online Forms",
    path: "/forms",
    keywords: [
      "form",
      "forms",
      "membership",
      "join",
      "member banna",
      "application",
      "private program",
      "booking",
      "reserve",
      "pdf",
      "download",
    ],
    content: [
      "The Online Forms page has three downloadable MASOM PDF documents:",
      "Membership Guidelines (membership guidelines and information),",
      "Membership Form (the official MASOM membership form),",
      "and Private Program (the private program application form).",
      `For help with a form, email ${contact.email}.`,
    ].join(" "),
  },
  {
    id: "donate",
    title: "Donations",
    path: "/donate",
    keywords: [
      "donate",
      "donation",
      "give",
      "contribute",
      "sadaqa",
      "sadaqat",
      "fitra",
      "khums",
      "zelle",
      "quickpay",
      "check",
      "cheque",
      "mail",
      "chanda",
      "paise",
      "how to pay",
      "support",
    ],
    content: [
      "MASOM accepts donations and Sadaqat in two approved ways.",
      "1) Zelle / Quickpay (Preferred): log in to your own bank or Zelle account and send payment to the MASOM email donate@masom.com.",
      "2) Regular Mail: send checks to MASOM, 4353 W Lawrence Ave, Chicago, IL, 60630.",
      "Note: for Sadaqa and Fitra, please mention Syed or Non-Syed in the Zelle memo or on your check.",
      "The Donate page also has an online form to share donation details with MASOM — it is a submission form and does not process payment.",
      "MASOM never collects card numbers, CVV codes, bank account numbers or online-banking passwords on the website.",
    ].join(" "),
  },
  {
    id: "calendar-page",
    title: "Hijri Prayer Calendar",
    path: "/hijricalendar2026",
    keywords: [
      "calendar",
      "hijri calendar",
      "prayer calendar",
      "namaz calendar",
      "pdf calendar",
      "download calendar",
      "timetable",
      "taqweem",
    ],
    content: [
      "The Hijri Prayer Calendar page shows MASOM's official monthly prayer timings alongside the Hijri dates,",
      "with Islamic events marked on their days. A printable PDF of the calendar can be downloaded from that page.",
      "Actual dates, timings and events must always be looked up with the calendar tools, never quoted from memory.",
    ].join(" "),
  },
  {
    id: "programs-page",
    title: "Program Calendar",
    path: "/events-schedule",
    keywords: [
      "program",
      "programs",
      "events",
      "schedule",
      "majlis",
      "jashn",
      "event schedule",
      "upcoming",
      "kya program",
    ],
    content: [
      "The Program Calendar page lists MASOM's published programs — majalis, jashns and community events —",
      "with their dates, times, locations and posters. Specific programs must be fetched with the programs tool.",
    ].join(" "),
  },
  {
    id: "stay-connected",
    title: "Stay Connected",
    path: "/",
    keywords: [
      "whatsapp",
      "group",
      "newsletter",
      "email announcements",
      "facebook",
      "instagram",
      "youtube",
      "social",
      "subscribe",
      "updates",
      "follow",
    ],
    content: [
      "MASOM shares updates through its WhatsApp events group, email announcements, and social media",
      "(Facebook, Instagram and YouTube). Links to join are on the MASOM homepage and in the site footer.",
    ].join(" "),
  },
  {
    id: "services",
    title: "Religious Services",
    path: "/our-mission",
    keywords: [
      "services",
      "majlis",
      "majalis",
      "jashn",
      "marriage",
      "nikah",
      "shadi",
      "funeral",
      "janaza",
      "namaz e jumma",
      "friday prayer",
      "jumma",
      "congregation",
      "eid",
      "procession",
      "juloos",
    ],
    content: [
      "MASOM provides religious services and education to the community, including majalis, jashns, marriages and funerals.",
      "MASOM also holds daily congregation prayers, Friday prayers, Eid reunions, Majalis, processions and jashans at the Imambargah.",
      `To arrange a service, contact MASOM at ${contact.phone} or ${contact.email}.`,
      "A Private Program application form is available on the Online Forms page.",
    ].join(" "),
  },
  {
    id: "mis",
    title: "MASOM Islamic School (MIS)",
    path: "/MIS",
    keywords: [
      "mis",
      "islamic school",
      "school",
      "madrasa",
      "madressa",
      "weekend school",
      "education",
      "classes",
      "registration",
      "enroll",
      "enrolment",
      "enrollment",
      "bachon",
      "taleem",
    ],
    content: [
      "MASOM Islamic School (MIS) is MASOM's weekend Islamic education program in Chicago.",
      "Classes are held every Saturday from 11 AM to 3 PM.",
      "MIS teaches Aa'aqid (Islamic beliefs), Fiqh (Islamic laws), Akhlaq (Islamic ethics) and Tareekh (Islamic history).",
      "The program's objective is to help students become true Shi'a Muslims by gaining knowledge of the Pure Islam and implementing it in daily life.",
      "The MIS page has the registration form, the school calendar and the school's contact details.",
    ].join(" "),
  },
  {
    id: "constitution",
    title: "MASOM By-Laws",
    path: "/",
    keywords: ["constitution", "bylaws", "by-laws", "rules", "aaeen", "qawaneen"],
    content: [
      "MASOM's constitution and by-laws are published as a PDF, linked from the site footer.",
    ].join(" "),
  },
];

/** Lowercase tokens of 2+ characters, punctuation stripped. */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

/** English stop words that would otherwise match every entry. */
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "you", "your", "can", "how", "what", "when",
  "where", "who", "why", "with", "from", "about", "does", "did", "was", "were",
  "has", "have", "this", "that", "there", "please", "tell", "know", "get",
  "hai", "hain", "kya", "ka", "ki", "ke", "ko", "me", "mein", "aur",
]);

export type KnowledgeMatch = {
  title: string;
  path: string;
  content: string;
  score: number;
};

/**
 * Deterministic keyword search over the curated entries. Keyword hits score
 * higher than body hits, and multi-word keyword phrases score highest so
 * "how to donate" reliably lands on the Donate entry.
 */
export function searchKnowledge(topic: string, limit = 3): KnowledgeMatch[] {
  const normalized = topic.toLowerCase();
  const tokens = tokenize(topic).filter((token) => !STOP_WORDS.has(token));
  if (tokens.length === 0) return [];

  const matches: KnowledgeMatch[] = [];

  for (const entry of knowledgeBase) {
    let score = 0;

    for (const keyword of entry.keywords) {
      // Whole-phrase hit ("private program", "how to pay") — strongest signal.
      if (keyword.includes(" ") && normalized.includes(keyword)) {
        score += 6;
        continue;
      }
      if (tokens.includes(keyword)) score += 4;
    }

    const contentTokens = new Set(tokenize(`${entry.title} ${entry.content}`));
    for (const token of tokens) {
      if (contentTokens.has(token)) score += 1;
    }

    if (score > 0) {
      matches.push({ title: entry.title, path: entry.path, content: entry.content, score });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

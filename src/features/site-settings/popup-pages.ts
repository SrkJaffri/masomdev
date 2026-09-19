/**
 * The REAL public MASOM routes the popup may target, derived from the
 * src/app/(website) route tree. This list is the single source of truth for
 * both the admin checkbox UI and the server-side validation — the server
 * never trusts client-supplied route arrays, it filters against this set.
 *
 * Add a public route here (path only, never a label) and the admin UI picks
 * it up automatically. /coming-soon and /2026 (a legacy redirect) are
 * intentionally not offered.
 */
export const POPUP_PAGE_OPTIONS = [
  { label: "Homepage", path: "/" },
  { label: "Hijri Calendar", path: "/hijricalendar2026" },
  { label: "Events / Programs", path: "/events-schedule" },
  { label: "Donate", path: "/donate" },
  { label: "Contacts", path: "/contacts" },
  { label: "MASOM Islamic School (MIS)", path: "/MIS" },
  { label: "Our Mission", path: "/our-mission" },
  { label: "Our Members", path: "/our-members" },
  { label: "Online Forms", path: "/forms" },
] as const;

export type PopupPageOption = (typeof POPUP_PAGE_OPTIONS)[number];

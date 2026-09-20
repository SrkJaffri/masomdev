import "server-only";

import {
  ADVERTISEMENT_OPTIONS,
  CONGREGATION_AREA_OPTIONS,
  FOOD_SERVICE_OPTIONS,
  LOGISTICS_OPTIONS,
  RECURRENCE_OPTIONS,
} from "./constants";
import type { PrivateProgramValues } from "./schema";

/**
 * Builds the application notification sent to the MASOM Secretary.
 *
 * Every applicant-supplied value passes through `escapeHtml` before it reaches
 * the HTML body — the email is assembled as a string, so an unescaped value
 * would be live markup in the Secretary's mail client. A plain-text
 * alternative is produced from the same data for clients that prefer it.
 */

const BRAND = "#5cb8b2";
const INK = "#0e0d12";
const MUTED = "#5b5b63";
const BORDER = "#e4e4e8";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then turn newlines into <br> — used only for the summary textarea. */
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function labelFor(
  options: readonly { value: string; label: string }[],
  value: string,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function labelsFor(
  options: readonly { value: string; label: string }[],
  selected: readonly string[],
): string[] {
  // Iterate the option list (not the payload) so the email always lists items
  // in the printed form's order, regardless of click order.
  return options.filter((option) => selected.includes(option.value)).map((option) => option.label);
}

const yesNo = (selected: readonly string[], value: string) =>
  selected.includes(value) ? "Yes" : "No";

/** `2026-09-20` → `Sunday, September 20, 2026` (no timezone shift). */
function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

/** `19:30` → `7:30 PM`. */
function formatTime(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

type Row = { label: string; value: string; multiline?: boolean };

type Section = { title: string; rows: Row[] };

/** Normalises one submission into the ordered sections both formats render. */
function buildSections(data: PrivateProgramValues, submittedAt: Date): Section[] {
  const areas = labelsFor(CONGREGATION_AREA_OPTIONS, data.congregationAreas);

  const applicationDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(submittedAt);

  const scheduleRows: Row[] = [
    { label: "Recurrence", value: labelFor(RECURRENCE_OPTIONS, data.recurrence) },
  ];
  if (data.recurrence === "other" && data.otherSchedule.trim()) {
    scheduleRows.push({ label: "Other Schedule", value: data.otherSchedule.trim() });
  }
  scheduleRows.push(
    { label: "Start Date", value: formatDate(data.startDate) },
    { label: "End Date", value: formatDate(data.endDate) },
    {
      label: "Program Timing",
      value: `${formatTime(data.startTime)} – ${formatTime(data.endTime)}`,
    },
  );

  return [
    {
      title: "Application Details",
      rows: [
        { label: "Application Date", value: `${applicationDate} (Central Time)` },
        { label: "Applicant Name", value: data.applicantName },
        { label: "Applicant Email", value: data.email },
        { label: "Applicant Phone", value: data.phone },
      ],
    },
    { title: "Program Schedule", rows: scheduleRows },
    {
      title: "Program Information",
      rows: [
        { label: "Program Title", value: data.programTitle },
        { label: "Summary", value: data.summary, multiline: true },
        { label: "Speaker", value: data.speaker.trim() || "Not provided" },
        { label: "Estimated Attendees", value: data.attendees.trim() || "Not provided" },
      ],
    },
    {
      title: "Facility",
      rows: [
        {
          label: "Congregation Area(s)",
          value: areas.length ? areas.join(", ") : "None selected",
        },
      ],
    },
    {
      title: "Food / Taburruk",
      rows: FOOD_SERVICE_OPTIONS.map((option) => ({
        label: option.label,
        value: yesNo(data.foodService, option.value),
      })),
    },
    {
      title: "Logistical Components",
      rows: LOGISTICS_OPTIONS.map((option) => ({
        label: option.label,
        value: yesNo(data.logistics, option.value),
      })),
    },
    {
      title: "Advertisement",
      rows: ADVERTISEMENT_OPTIONS.map((option) => ({
        label: option.label,
        value: yesNo(data.advertisement, option.value),
      })),
    },
    {
      title: "Agreement",
      rows: [
        { label: "Rules Accepted", value: "Yes" },
        { label: "Electronic Signature", value: data.electronicSignature },
        { label: "Agreement Date", value: formatDate(data.agreementDate) },
      ],
    },
  ];
}

const DISCLAIMER =
  "This submission is an application and does not by itself constitute approval or " +
  "confirmation of facility reservation.";

const OFFICE_NOTE = "MASOM Office Use fields remain to be completed internally.";

/** Also surfaces the food/logistics/ad selections the applicant did NOT pick. */
export function buildPrivateProgramEmail(data: PrivateProgramValues, submittedAt: Date) {
  const sections = buildSections(data, submittedAt);
  const subject = `Private Program Application — ${data.programTitle}`;

  // --- Plain text --------------------------------------------------------
  const textLines: string[] = ["MASOM", "Private Program Application", ""];
  for (const section of sections) {
    textLines.push(section.title.toUpperCase());
    for (const row of section.rows) {
      if (row.multiline) {
        textLines.push(`${row.label}:`, row.value);
      } else {
        textLines.push(`${row.label}: ${row.value}`);
      }
    }
    textLines.push("");
  }
  textLines.push(DISCLAIMER, "", OFFICE_NOTE, "", "Source: MASOM Website — Private Program Application");
  const text = textLines.join("\n");

  // --- HTML --------------------------------------------------------------
  const sectionsHtml = sections
    .map((section) => {
      const rowsHtml = section.rows
        .map((row) => {
          const value = row.multiline
            ? escapeMultiline(row.value)
            : escapeHtml(row.value);
          return `
            <tr>
              <td style="padding:8px 0;vertical-align:top;width:210px;color:${MUTED};font-size:13px;">${escapeHtml(row.label)}</td>
              <td style="padding:8px 0;vertical-align:top;color:${INK};font-size:14px;font-weight:600;line-height:1.55;">${value}</td>
            </tr>`;
        })
        .join("");

      return `
        <tr>
          <td style="padding:22px 28px 4px 28px;">
            <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${BRAND};">${escapeHtml(section.title)}</p>
            <div style="height:1px;background:${BORDER};margin:8px 0 4px 0;"></div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
    <tr>
      <td style="background:${INK};padding:26px 28px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${BRAND};">MASOM</p>
        <h1 style="margin:8px 0 0 0;font-size:21px;line-height:1.3;color:#ffffff;font-weight:700;">Private Program Application</h1>
        <p style="margin:8px 0 0 0;font-size:13px;color:rgba(255,255,255,.7);">${escapeHtml(data.programTitle)}</p>
      </td>
    </tr>
    ${sectionsHtml}
    <tr>
      <td style="padding:20px 28px 26px 28px;">
        <div style="border-radius:10px;background:#fbf9f3;border:1px solid #ece6d6;padding:14px 16px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:${INK};">${escapeHtml(DISCLAIMER)}</p>
          <p style="margin:8px 0 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(OFFICE_NOTE)}</p>
        </div>
        <p style="margin:16px 0 0 0;font-size:11px;color:${MUTED};">Source: MASOM Website — Private Program Application</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

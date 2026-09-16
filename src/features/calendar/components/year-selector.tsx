"use client";

import { ChevronDown } from "lucide-react";

import { calendarBasePath, supportedCalendarYears } from "@/features/calendar/config";
import { cn } from "@/lib/utils";

type YearSelectorProps = {
  /** Currently displayed Gregorian year. */
  selectedYear: number;
  /** Currently displayed month, carried through the URL when switching. */
  selectedMonth: number;
  className?: string;
};

/**
 * Accessible year selector next to the month selector. Same pattern: a plain
 * HTML form/select navigating to `${calendarBasePath}?year=Y&month=M` (GET) —
 * works without JavaScript and is fully keyboard operable. The selected month
 * is preserved so switching years lands on the same month view.
 */
export function YearSelector({ selectedYear, selectedMonth, className }: YearSelectorProps) {
  return (
    <form
      method="get"
      action={calendarBasePath}
      className={cn("flex items-center gap-3", className)}
    >
      {/* Keep the month in the URL when only the year changes. */}
      <input type="hidden" name="month" value={selectedMonth} />
      <label htmlFor="calendar-year" className="text-sm font-semibold text-foreground">
        Year
      </label>
      <div className="relative">
        <select
          id="calendar-year"
          name="year"
          defaultValue={selectedYear}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="cursor-pointer appearance-none rounded-xl border border-border bg-card py-2 pr-10 pl-3.5 text-sm font-semibold text-foreground shadow-card transition-colors hover:border-brand-400 focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {supportedCalendarYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {/* No-JS / keyboard fallback so the form still submits without scripting. */}
      <button type="submit" className="sr-only">
        View year
      </button>
    </form>
  );
}

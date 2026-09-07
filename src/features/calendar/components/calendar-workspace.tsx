"use client";

import { CalendarIcon, ClockIcon, MoonIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DayManager } from "@/features/calendar/components/day-manager";
import { EventManager } from "@/features/calendar/components/event-manager";
import { HijriMonthManager } from "@/features/calendar/components/hijri-month-manager";
import { HijriOverrideManager } from "@/features/calendar/components/hijri-override-manager";
import type {
  CalendarDayAdminItem,
  CalendarEventAdminItem,
  HijriMonthAdminItem,
  HijriOverrideAdminItem,
} from "@/features/calendar/types";
import { cn } from "@/lib/utils";

type Tab = "timings" | "months" | "overrides" | "events";

const TABS: { key: Tab; label: string; icon: typeof ClockIcon }[] = [
  { key: "timings", label: "Prayer timings", icon: ClockIcon },
  { key: "months", label: "Hijri months", icon: MoonIcon },
  { key: "overrides", label: "Hijri overrides", icon: SparklesIcon },
  { key: "events", label: "Events", icon: CalendarIcon },
];

const VALID_TABS: Tab[] = ["timings", "months", "overrides", "events"];

/** Initial tab from ?tab=… (used by the dashboard Create-new → calendar flow). */
function initialTab(): Tab {
  if (typeof window === "undefined") return "timings";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return VALID_TABS.includes(requested as Tab) ? (requested as Tab) : "timings";
}

/** Whether the route was opened with a create intent (?create=1). */
function createRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("create");
}

export function CalendarWorkspace({
  year,
  days,
  months,
  overrides,
  events,
}: {
  year: number;
  days: CalendarDayAdminItem[];
  months: HijriMonthAdminItem[];
  overrides: HijriOverrideAdminItem[];
  events: CalendarEventAdminItem[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [autoCreate, setAutoCreate] = useState<boolean>(createRequested);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Calendar"
        description={`Manage the ${year} prayer timings, Hijri dates and Islamic events shown on the public Hijri calendar.`}
      />

      <div className="flex flex-wrap gap-1 border-b border-border/60">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setAutoCreate(false);
            }}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === key
                ? "border-brand-500 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "timings" ? <DayManager days={days} year={year} /> : null}
      {tab === "months" ? <HijriMonthManager months={months} /> : null}
      {tab === "overrides" ? <HijriOverrideManager overrides={overrides} /> : null}
      {tab === "events" ? <EventManager events={events} autoCreate={autoCreate} /> : null}
    </div>
  );
}
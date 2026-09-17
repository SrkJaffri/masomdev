import { CalendarWorkspace } from "@/features/calendar/components/calendar-workspace";
import { adminCalendarYear } from "@/features/calendar/config";
import {
  getAllCalendarDays,
  getAllCalendarEvents,
  getAllHijriMonths,
  getAllHijriOverrides,
} from "@/features/calendar/queries";

export default async function AdminCalendarPage() {
  const [days, months, overrides, events] = await Promise.all([
    getAllCalendarDays(adminCalendarYear),
    getAllHijriMonths(),
    getAllHijriOverrides(),
    getAllCalendarEvents(),
  ]);

  return (
    <CalendarWorkspace
      year={adminCalendarYear}
      days={days}
      months={months}
      overrides={overrides}
      events={events}
    />
  );
}

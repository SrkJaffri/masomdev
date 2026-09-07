import {
  CalendarDaysIcon,
  CalendarIcon,
  ImageIcon,
  MegaphoneIcon,
} from "lucide-react";

import { CmsInfoStrip } from "@/components/admin/admin-cms-info-strip";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CreateNewDropdown } from "@/components/admin/create-new-dropdown";
import {
  DashboardStatCard,
  type StatCardAccent,
} from "@/components/admin/dashboard-stat-card";
import { RecentActivityCard } from "@/components/admin/recent-activity-card";
import { RecentLoginCard } from "@/components/admin/recent-login-card";
import { TodayPrayerCard } from "@/components/admin/today-prayer-card";
import { getAnnouncementCounts } from "@/features/announcements/queries";
import { getBannerCounts } from "@/features/banners/queries";
import {
  getCalendarEventCounts,
  getTodayTimings,
} from "@/features/calendar/queries";
import { getProgramCounts } from "@/features/programs/queries";
import { requireAdmin } from "@/features/auth/guard";
import { getNextPrayerCandidates } from "@/features/prayer-calendar/lib/next-prayer";
import { getLatestLogin, getRecentActivity } from "@/lib/cms/activity";

type StatCard = {
  label: string;
  href: string;
  icon: typeof ImageIcon;
  total: number;
  liveCount: number;
  liveLabel: string;
  accent: StatCardAccent;
};

/** Right-aligned current-date badge (Gregorian + Hijri), from live calendar data. */
function DateHijriBadge({
  gregorianDate,
  hijriDate,
}: {
  gregorianDate: string | null;
  hijriDate: string | null;
}) {
  if (!gregorianDate) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3.5 py-2 shadow-sm">
      <CalendarIcon aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
      <div className="text-left">
        <p className="text-sm leading-tight font-semibold text-foreground">
          {gregorianDate}
        </p>
        {hijriDate ? (
          <p className="mt-0.5 text-xs leading-tight font-medium text-brand-700 dark:text-brand-300">
            {hijriDate}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();

  const [
    banners,
    programs,
    announcements,
    calendarEvents,
    recentActivity,
    latestLogin,
    today,
    nextPrayerCandidates,
  ] = await Promise.all([
    getBannerCounts(),
    getProgramCounts(),
    getAnnouncementCounts(),
    getCalendarEventCounts(),
    getRecentActivity(5),
    getLatestLogin(user.id),
    getTodayTimings(),
    getNextPrayerCandidates(),
  ]);

  const serverNow = Date.now();

  const stats: StatCard[] = [
    {
      label: "Banners",
      href: "/admin/banners",
      icon: ImageIcon,
      total: banners.total,
      liveCount: banners.active,
      liveLabel: "active",
      accent: "teal",
    },
    {
      label: "Programs",
      href: "/admin/programs",
      icon: CalendarDaysIcon,
      total: programs.total,
      liveCount: programs.published,
      liveLabel: "published",
      accent: "blue",
    },
    {
      label: "Announcements",
      href: "/admin/announcements",
      icon: MegaphoneIcon,
      total: announcements.total,
      liveCount: announcements.active,
      liveLabel: "active",
      accent: "violet",
    },
    {
      label: "Calendar events",
      href: "/admin/calendar",
      icon: CalendarIcon,
      total: calendarEvents.total,
      liveCount: calendarEvents.active,
      liveLabel: "active events",
      accent: "amber",
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Manage your community, all in one place."
      >
        <DateHijriBadge
          gregorianDate={today.gregorianDate}
          hijriDate={today.hijriDate}
        />
        <CreateNewDropdown />
      </AdminPageHeader>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <DashboardStatCard key={stat.href} {...stat} />
        ))}
      </div>

      {/* Prayer hero — full width */}
      <TodayPrayerCard timings={today} candidates={nextPrayerCandidates} />

      {/* Recent activity + recent login */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RecentActivityCard records={recentActivity} now={serverNow} />
        </div>
        <div className="lg:col-span-2">
          <RecentLoginCard login={latestLogin} now={serverNow} />
        </div>
      </div>

      <CmsInfoStrip />
    </div>
  );
}
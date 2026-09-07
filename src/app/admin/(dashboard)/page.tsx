import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ImageIcon,
  MegaphoneIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { RecentActivityCard } from "@/components/admin/recent-activity-card";
import { RecentLoginCard } from "@/components/admin/recent-login-card";
import { TodayPrayerCard } from "@/components/admin/today-prayer-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAnnouncementCounts } from "@/features/announcements/queries";
import { getBannerCounts } from "@/features/banners/queries";
import { getCalendarEventCounts } from "@/features/calendar/queries";
import { getProgramCounts } from "@/features/programs/queries";
import { requireAdmin } from "@/features/auth/guard";
import { getLatestLogin, getRecentActivity } from "@/lib/cms/activity";

type StatCard = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  total: number;
  liveCount: number;
  liveLabel: string;
};

export default async function AdminDashboardPage() {
  const { user } = await requireAdmin();

  const [banners, programs, announcements, calendarEvents, recentActivity, latestLogin] =
    await Promise.all([
      getBannerCounts(),
      getProgramCounts(),
      getAnnouncementCounts(),
      getCalendarEventCounts(),
      getRecentActivity(5),
      getLatestLogin(user.id),
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
    },
    {
      label: "Programs",
      href: "/admin/programs",
      icon: CalendarDaysIcon,
      total: programs.total,
      liveCount: programs.published,
      liveLabel: "published",
    },
    {
      label: "Announcements",
      href: "/admin/announcements",
      icon: MegaphoneIcon,
      total: announcements.total,
      liveCount: announcements.active,
      liveLabel: "active",
    },
    {
      label: "Calendar",
      href: "/admin/calendar",
      icon: CalendarIcon,
      total: calendarEvents.total,
      liveCount: calendarEvents.active,
      liveLabel: "active events",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage what appears on the MASOM homepage.
          </p>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-sm text-muted-foreground shadow-sm">
          <SparklesIcon aria-hidden="true" className="size-3.5 text-brand-600" />
          Welcome back,{" "}
          <span className="font-semibold text-foreground">{user.email}</span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.href}
              href={stat.href}
              className="group rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all duration-200 outline-none hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-elevated focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-100 text-brand-700 transition-colors duration-200 group-hover:bg-brand-500 group-hover:text-white">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600"
                />
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {stat.total}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{stat.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stat.liveCount} {stat.liveLabel}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Today's Prayer & Hijri + Recent Login */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TodayPrayerCard />
        <RecentLoginCard login={latestLogin} now={serverNow} />
      </div>

      {/* Recent activity — latest 5 */}
      <RecentActivityCard records={recentActivity} now={serverNow} />

      {/* How the CMS falls back — compact info strip */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How the CMS works</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">Banners</span> and{" "}
            <span className="font-medium text-foreground">Programs</span> you publish here
            replace the website&apos;s built-in defaults — until you add your own, the
            homepage keeps showing the existing MASOM content.
          </p>
          <p>
            <span className="font-medium text-foreground">Announcements</span> appear in the
            news ticker at the top of the homepage. When there are none, the ticker is hidden
            automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

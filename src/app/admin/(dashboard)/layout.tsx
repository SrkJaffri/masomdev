import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { getAnnouncementCounts } from "@/features/announcements/queries";
import { getBannerCounts } from "@/features/banners/queries";
import { getCalendarEventCounts } from "@/features/calendar/queries";
import { getNewsletterCounts } from "@/features/newsletter/queries";
import { getProgramCounts } from "@/features/programs/queries";
import { requireAdmin } from "@/features/auth/guard";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireAdmin();

  // The four lean count queries are React-cached, so the sidebar badges and the
  // dashboard stat cards share ONE fetch per request — no duplicate counts.
  const [banners, programs, announcements, calendarEvents, newsletter] = await Promise.all([
    getBannerCounts(),
    getProgramCounts(),
    getAnnouncementCounts(),
    getCalendarEventCounts(),
    getNewsletterCounts(),
  ]);

  const metadataName =
    typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim() !== ""
      ? user.user_metadata.name.trim()
      : null;

  return (
    <AdminShell
      userEmail={user.email ?? ""}
      displayName={metadataName ?? "Administrator"}
      counts={{
        banners: banners.total,
        programs: programs.total,
        announcements: announcements.total,
        calendar: calendarEvents.total,
        newsletter: newsletter.subscribed,
      }}
    >
      {children}
    </AdminShell>
  );
}
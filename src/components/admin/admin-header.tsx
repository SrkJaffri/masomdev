"use client";

import { ExternalLinkIcon, HomeIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminThemeToggle } from "@/components/admin/admin-theme";

/** Current-page label for the breadcrumb (longest match wins). */
const PAGE_LABELS: Array<[string, string]> = [
  ["/admin/banners", "Banners"],
  ["/admin/programs", "Programs"],
  ["/admin/announcements", "Announcements"],
  ["/admin/calendar", "Calendar"],
  ["/admin", "Dashboard"],
];

/** Thin sticky workspace header: breadcrumb left, theme + view-website right.
 * No search — intentionally. */
export function AdminHeader({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const pathname = usePathname();
  const page =
    PAGE_LABELS.find(([href]) => pathname.startsWith(href))?.[1] ?? "Dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-[#fcfcfc]/90 px-4 backdrop-blur dark:bg-[#121116]/90 md:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation menu"
        title="Open navigation menu"
        className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <MenuIcon className="size-4" aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <HomeIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="hidden text-muted-foreground sm:inline">Workspace</span>
        <span aria-hidden="true" className="hidden text-muted-foreground/50 sm:inline">
          /
        </span>
        <span className="truncate font-semibold text-foreground">{page}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
        >
          View website
          <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
        </Link>
        <AdminThemeToggle />
      </div>
    </header>
  );
}
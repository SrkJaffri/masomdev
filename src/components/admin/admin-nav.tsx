"use client";

import {
  CalendarIcon,
  CalendarDaysIcon,
  ImageIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  MegaphoneIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

type AdminNavLink = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const links: AdminNavLink[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  { href: "/admin/programs", label: "Programs", icon: CalendarDaysIcon },
  { href: "/admin/announcements", label: "Announcements", icon: MegaphoneIcon },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarIcon },
];

/**
 * Renders inside each admin <Link>. `useLinkStatus` (Next.js 15.3+) reports
 * the Link's optimistic navigation state, so the clicked item acknowledges
 * the click immediately (<100ms) with a small spinner in place of its icon
 * while the destination loads — without trapping focus or blocking keyboard
 * navigation.
 */
function AdminNavLink({ link }: { link: AdminNavLink }) {
  const { pending } = useLinkStatus();
  const Icon = link.icon;

  return (
    <>
      {pending ? (
        <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <Icon className="size-4" aria-hidden="true" />
      )}
      {link.label}
      {pending ? <span className="sr-only">Loading {link.label}…</span> : null}
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Admin sections">
      {links.map((link) => {
        const isActive =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-500 text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <AdminNavLink link={link} />
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import {
  CalendarIcon,
  CalendarDaysIcon,
  ImageIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  LogOutIcon,
  MegaphoneIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  XIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { ComponentType, SVGProps } from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { signOutAction } from "@/features/auth/actions";
import type { AdminCounts } from "@/components/admin/admin-shell";
import { cn } from "@/lib/utils";

export const SIDEBAR_STORAGE_KEY = "masom-admin-sidebar-collapsed";

type NavAccent = "teal" | "blue" | "violet" | "amber";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: NavAccent;
  /** Count badge value; undefined hides the badge. */
  countKey?: keyof AdminCounts;
};

type NavSection = { label: string; items: NavItem[] };

const ACCENT_BADGE: Record<NavAccent, string> = {
  teal: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

const ACCENT_DOT: Record<NavAccent, string> = {
  teal: "bg-brand-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
};

function buildSections(): NavSection[] {
  return [
    {
      label: "Overview",
      items: [
        { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, accent: "teal" },
      ],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/banners", label: "Banners", icon: ImageIcon, accent: "teal", countKey: "banners" },
        { href: "/admin/programs", label: "Programs", icon: CalendarDaysIcon, accent: "blue", countKey: "programs" },
        { href: "/admin/announcements", label: "Announcements", icon: MegaphoneIcon, accent: "violet", countKey: "announcements" },
        { href: "/admin/calendar", label: "Calendar", icon: CalendarIcon, accent: "amber", countKey: "calendar" },
      ],
    },
  ];
}

/** Renders inside each nav <Link> — useLinkStatus (Next 15.3+) reports the
 * Link's optimistic pending state, so the clicked item acknowledges the click
 * immediately with a spinner while the destination loads. */
function NavLinkContent({
  item,
  count,
  collapsed,
}: {
  item: NavItem;
  count: number | undefined;
  collapsed: boolean;
}) {
  const { pending } = useLinkStatus();
  const Icon = item.icon;

  return (
    <>
      {pending ? (
        <Loader2Icon
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Icon className="size-4 shrink-0" aria-hidden="true" />
      )}
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
      {count !== undefined && count > 0 ? (
        collapsed ? (
          <span
            aria-hidden="true"
            className={cn("absolute right-2.5 top-2.5 size-1.5 rounded-full", ACCENT_DOT[item.accent])}
          />
        ) : (
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold tabular-nums",
              ACCENT_BADGE[item.accent],
            )}
          >
            {count}
          </span>
        )
      ) : null}
      {pending ? <span className="sr-only">Loading {item.label}…</span> : null}
    </>
  );
}

function SidebarLink({
  item,
  count,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  count: number | undefined;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        collapsed && "justify-center px-0",
        isActive
          ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <NavLinkContent item={item} count={count} collapsed={collapsed} />
    </Link>
  );
}

/** The navigation list + section labels. Shared by the desktop sidebar and the
 * mobile drawer so both always show the same items, states and counts. */
export function SidebarNav({
  counts,
  collapsed,
  onNavigate,
}: {
  counts: AdminCounts;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-3">
      {buildSections().map((section) => (
        <div key={section.label}>
          {collapsed ? (
            <div aria-hidden="true" className="mx-2 my-2 border-t border-border/60" />
          ) : (
            <p className="px-3 pt-3 pb-2 text-[0.6875rem] font-bold tracking-[0.16em] text-muted-foreground/70 uppercase">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <SidebarLink
                  item={item}
                  count={item.countKey ? counts[item.countKey] : undefined}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SignOutRow({ collapsed }: { collapsed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title={collapsed ? "Sign out" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60",
        collapsed && "justify-center px-0",
      )}
    >
      {pending ? (
        <Loader2Icon className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
      )}
      {collapsed ? (
        <span className="sr-only">Sign out</span>
      ) : (
        <span>{pending ? "Signing out…" : "Sign out"}</span>
      )}
    </button>
  );
}

/** Bottom utility area: help, profile and sign out. Shared by desktop + mobile. */
export function SidebarBottom({
  collapsed,
  displayName,
  userEmail,
}: {
  collapsed: boolean;
  displayName: string;
  userEmail: string;
}) {
  const initials =
    displayName === "Administrator"
      ? userEmail.replace(/@.*$/, "").slice(0, 2).toUpperCase() || "AD"
      : displayName
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

  return (
    <div className={cn("shrink-0 space-y-1 border-t border-border/60 px-3 py-3", collapsed && "px-2")}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5",
          collapsed ? "justify-center px-0" : "bg-muted/40",
        )}
        title={collapsed ? `${displayName} · ${userEmail}` : undefined}
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white"
        >
          {initials}
        </span>
        {!collapsed ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {displayName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{userEmail}</span>
          </span>
        ) : null}
      </div>

      <form action={signOutAction} className={cn(collapsed && "flex justify-center")}>
        <SignOutRow collapsed={collapsed} />
      </form>
    </div>
  );
}

/** Desktop fixed sidebar with expand/collapse. The preference persists in
 * localStorage (masom-admin-sidebar-collapsed); the width animates only after
 * the saved state is loaded so a refresh never flashes the wrong width. */
export function AdminSidebar({
  userEmail,
  displayName,
  counts,
  collapsed,
  ready,
  onToggle,
}: {
  userEmail: string;
  displayName: string;
  counts: AdminCounts;
  collapsed: boolean;
  ready: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      aria-label="Admin sidebar"
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/70 bg-[#fcfcfc] shadow-nav dark:bg-[#121116] lg:flex",
        collapsed ? "w-[76px]" : "w-60",
        ready && "transition-[width] duration-200 ease-out",
      )}
    >
      {/* Branding + collapse toggle */}
      <div
        className={cn(
          "flex shrink-0 items-center border-b border-border/60",
          collapsed ? "flex-col gap-3 py-4" : "h-16 justify-between gap-2 px-5",
        )}
      >
        {collapsed ? (
          <Link
            href="/admin"
            title="MASOM Admin"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold tracking-widest text-white shadow-sm transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
          >
            M
          </Link>
        ) : (
          <Link href="/admin" className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <p className="text-sm font-bold tracking-[0.32em] text-[#0f4c3a] dark:text-brand-300">
              M A S O M
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Admin</p>
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-muted-foreground shadow-sm transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftCloseIcon className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <SidebarNav counts={counts} collapsed={collapsed} />

      <SidebarBottom collapsed={collapsed} displayName={displayName} userEmail={userEmail} />
    </aside>
  );
}

/** Mobile navigation: a left drawer with the same items, counts and controls. */
export function AdminSidebarMobile({
  userEmail,
  displayName,
  counts,
  open,
  onOpenChange,
}: {
  userEmail: string;
  displayName: string;
  counts: AdminCounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[288px] gap-0 bg-[#fcfcfc] p-0 dark:bg-[#121116] sm:max-w-sm"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 pr-4 pl-5">
          <Link href="/admin" onClick={() => onOpenChange(false)} className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <p className="text-sm font-bold tracking-[0.32em] text-[#0f4c3a] dark:text-brand-300">
              M A S O M
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">Admin</p>
          </Link>
          <SheetCloseButton onClose={() => onOpenChange(false)} />
        </div>
        <SidebarNav counts={counts} collapsed={false} onNavigate={() => onOpenChange(false)} />
        <SidebarBottom collapsed={false} displayName={displayName} userEmail={userEmail} />
      </SheetContent>
    </Sheet>
  );
}

function SheetCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close navigation menu"
      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <XIcon className="size-4" aria-hidden="true" />
    </button>
  );
}
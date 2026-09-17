"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import {
  AdminSidebar,
  AdminSidebarMobile,
  SIDEBAR_STORAGE_KEY,
} from "@/components/admin/admin-sidebar";
import { NavigationProgress } from "@/components/admin/navigation-progress";
import { cn } from "@/lib/utils";

export type AdminCounts = {
  banners: number;
  programs: number;
  announcements: number;
  calendar: number;
  newsletter: number;
  contact: number;
};

type AdminShellProps = {
  userEmail: string;
  displayName: string;
  counts: AdminCounts;
  children: ReactNode;
};

/**
 * The persistent admin application shell: fixed sidebar (desktop) + drawer
 * (mobile), sticky workspace header and the route content area. Stays mounted
 * between route navigations so the shell never flickers. Sidebar width and the
 * content offset animate together from one collapsed flag (localStorage-persisted).
 */
export function AdminShell({
  userEmail,
  displayName,
  counts,
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load the saved sidebar preference after first paint — initial render is
  // always expanded, so there is no hydration mismatch and no width flash.
  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      // localStorage unavailable — stay expanded.
    }
    setCollapsed(saved);
    setReady(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Persistence unavailable — still collapse for this session.
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f9f9] dark:bg-[#0e0d12]">
      <NavigationProgress />

      <AdminSidebar
        userEmail={userEmail}
        displayName={displayName}
        counts={counts}
        collapsed={collapsed}
        ready={ready}
        onToggle={toggleCollapsed}
      />

      <AdminSidebarMobile
        userEmail={userEmail}
        displayName={displayName}
        counts={counts}
        open={mobileOpen}
        onOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          "flex min-h-screen flex-col",
          ready && "transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[76px]" : "lg:pl-60",
        )}
      >
        <AdminHeader onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 md:px-6 md:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
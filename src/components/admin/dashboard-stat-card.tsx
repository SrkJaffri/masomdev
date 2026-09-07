import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

export type StatCardAccent = "teal" | "blue" | "violet" | "amber";

const ACCENT_ICON: Record<StatCardAccent, string> = {
  teal: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

type DashboardStatCardProps = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  total: number;
  liveCount: number;
  liveLabel: string;
  accent: StatCardAccent;
};

/**
 * Premium dashboard stat card: tinted icon badge, large count, status line and
 * an arrow that shifts on hover. The whole card links to its module.
 */
export function DashboardStatCard({
  label,
  href,
  icon: Icon,
  total,
  liveCount,
  liveLabel,
  accent,
}: DashboardStatCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-all duration-200 outline-none hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-elevated focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start justify-between">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-11 place-items-center rounded-xl",
            ACCENT_ICON[accent],
          )}
        >
          <Icon className="size-5" />
        </span>
        <ArrowRightIcon
          aria-hidden="true"
          className="size-4 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600"
        />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-foreground tabular-nums">
        {total}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {liveCount} {liveLabel}
      </p>
    </Link>
  );
}
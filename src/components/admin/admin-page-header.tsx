import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, date badge, dropdowns…). */
  children?: ReactNode;
  className?: string;
};

/**
 * Shared page title block for every admin module — one visual language across
 * /admin, banners, programs, announcements and calendar.
 */
export function AdminPageHeader({
  title,
  description,
  children,
  className,
}: AdminPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
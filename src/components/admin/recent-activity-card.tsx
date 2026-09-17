import {
  ActivityIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ImageIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityModule, ActivityRecord } from "@/lib/cms/activity";
import { formatRelativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

const MODULE_META: Record<
  ActivityModule,
  { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }
> = {
  banner: { label: "Banner", icon: ImageIcon },
  program: { label: "Program", icon: CalendarDaysIcon },
  announcement: { label: "Announcement", icon: MegaphoneIcon },
  calendar: { label: "Calendar", icon: CalendarIcon },
  newsletter: { label: "Newsletter", icon: MailIcon },
  contact: { label: "Contact message", icon: MessageSquareIcon },
};

function actionMeta(action: string): {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className: string;
} {
  const lower = action.toLowerCase();
  if (lower.includes("deleted")) {
    return {
      label: "Deleted",
      icon: Trash2Icon,
      className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    };
  }
  if (lower.includes("updated")) {
    return {
      label: "Updated",
      icon: PencilIcon,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    };
  }
  if (lower.includes("created")) {
    return {
      label: "Created",
      icon: PlusIcon,
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    };
  }
  return {
    label: action.charAt(0).toUpperCase() + action.slice(1),
    icon: ActivityIcon,
    className: "bg-muted text-muted-foreground",
  };
}

type RecentActivityCardProps = {
  records: ActivityRecord[];
  /** Server-side "now" so all relative times share one clock. */
  now: number;
};

/** Latest admin actions as a clean card table — Action / Content / Time. */
export function RecentActivityCard({ records, now }: RecentActivityCardProps) {
  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <ActivityIcon aria-hidden="true" className="size-4 text-brand-600" />
          <div>
            <h2 id="recent-activity-heading" className="text-sm font-bold text-foreground">
              Recent activity
            </h2>
            <p className="text-xs text-muted-foreground">
              Latest changes to your content.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[0.6875rem] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          Latest {Math.min(records.length, 5)}
        </span>
      </header>

      {records.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No recent activity yet — changes you make in the admin panel will
            appear here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="w-24 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const moduleMeta = MODULE_META[record.module] ?? MODULE_META.calendar;
                const action = actionMeta(record.action);
                const ActionIcon = action.icon;
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-lg",
                            action.className,
                          )}
                        >
                          <ActionIcon className="size-3.5" />
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {moduleMeta.label} {action.label}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[16rem] truncate text-sm text-muted-foreground">
                        {record.description ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <time
                        dateTime={record.created_at}
                        className="text-xs font-semibold text-muted-foreground tabular-nums"
                      >
                        {formatRelativeTime(record.created_at, now)}
                      </time>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
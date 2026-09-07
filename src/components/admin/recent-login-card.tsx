import { ClockIcon, FingerprintIcon, MapPinIcon } from "lucide-react";

import { maskIp } from "@/lib/auth/login-audit";
import type { AdminLoginRecord } from "@/lib/cms/activity";
import { formatRelativeTime } from "@/lib/format/relative-time";

type RecentLoginCardProps = {
  login: AdminLoginRecord | null;
  /** Server-side "now" so the timestamp matches the page render. */
  now: number;
};

/**
 * The current admin's latest successful sign-in: country initials badge,
 * location, masked IP, browser and relative time. Uses only data the CMS
 * already collected — no new tracking.
 */
export function RecentLoginCard({ login, now }: RecentLoginCardProps) {
  const hasLocation = Boolean(login?.country_name || login?.country_code);
  const masked = maskIp(login?.ip_address);
  const locationLine = [login?.city, login?.region].filter(Boolean).join(", ");
  const initials = login?.country_code
    ? login.country_code.slice(0, 2).toUpperCase()
    : null;

  return (
    <section
      aria-labelledby="recent-login-heading"
      className="flex h-full flex-col rounded-2xl border border-border/70 bg-card shadow-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <FingerprintIcon aria-hidden="true" className="size-4 text-brand-600" />
          <div>
            <h2 id="recent-login-heading" className="text-sm font-bold text-foreground">
              Recent login
            </h2>
            <p className="text-xs text-muted-foreground">
              Your most recent login session.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.6875rem] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
          Current session
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        {login ? (
          <>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
              >
                {initials ?? <MapPinIcon className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {login.country_name ?? login.country_code ?? "Location unavailable"}
                </p>
                {locationLine ? (
                  <p className="truncate text-sm text-muted-foreground">{locationLine}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {hasLocation ? "Region unavailable" : ""}
                  </p>
                )}
              </div>
            </div>

            <dl className="space-y-2 text-sm">
              {masked ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">IP address</dt>
                  <dd className="font-mono font-medium text-foreground tabular-nums">
                    {masked}
                  </dd>
                </div>
              ) : null}
              {login.user_agent_summary ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Browser</dt>
                  <dd className="font-medium text-foreground">
                    {login.user_agent_summary}
                  </dd>
                </div>
              ) : null}
            </dl>

            <p className="mt-auto flex items-center gap-1.5 border-t border-border/40 pt-3 text-xs font-semibold text-muted-foreground">
              <ClockIcon aria-hidden="true" className="size-3.5" />
              Logged in{" "}
              <time dateTime={login.created_at} className="font-bold text-foreground">
                {formatRelativeTime(login.created_at, now)}
              </time>
            </p>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No login recorded yet — your next successful sign-in will appear here.
          </p>
        )}
      </div>
    </section>
  );
}
/**
 * Route-level loading UI for the admin content area. The App Router keeps the
 * parent layout (sidebar/nav + header) mounted, so only this content fallback
 * swaps in while a child page streams its data.
 *
 * The fallback is held invisible for the first 200ms (pure CSS animation
 * delay — no timers, navigation is never delayed) so fast client-side
 * transitions never flash a skeleton: the current page stays visually stable
 * while the next RSC payload loads, and this restrained fallback only fades
 * in for genuinely slow routes.
 */
export default function AdminLoading() {
  return (
    <div
      className="animate-admin-skeleton space-y-6"
      role="status"
      aria-label="Loading admin section"
    >
      {/* Page title placeholder */}
      <div>
        <div className="h-6 w-44 animate-pulse rounded-md bg-muted/60" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted/40" />
      </div>

      {/* Stat / card placeholders */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/30" />
        ))}
      </div>

      {/* Table placeholder */}
      <div className="h-44 animate-pulse rounded-xl bg-muted/30" />

      <span className="sr-only">Loading…</span>
    </div>
  );
}
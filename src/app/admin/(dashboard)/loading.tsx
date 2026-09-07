/**
 * Route-level loading UI for the admin content area. The App Router keeps the
 * parent layout (sidebar + header) mounted, so only this content fallback
 * swaps in while a child page streams its data.
 *
 * The fallback is held invisible for the first 450ms (pure CSS animation
 * delay — no timers, navigation is never delayed) so typical ~300–450ms
 * client-side transitions never flash a skeleton: the current page stays
 * visually stable while the next RSC payload loads, and this restrained
 * fallback only fades in for genuinely slow routes.
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
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted/60" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-muted/40" />
      </div>

      {/* Stat card placeholders */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted/30" />
        ))}
      </div>

      {/* Card placeholder */}
      <div className="h-64 animate-pulse rounded-2xl bg-muted/30" />

      <span className="sr-only">Loading…</span>
    </div>
  );
}
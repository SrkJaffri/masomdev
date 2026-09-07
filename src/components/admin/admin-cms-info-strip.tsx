import { BookOpenIcon } from "lucide-react";

/** Full-width informational strip at the bottom of the admin dashboard. */
export function CmsInfoStrip() {
  return (
    <section
      aria-labelledby="cms-info-heading"
      className="rounded-2xl border border-border/70 bg-card p-5 shadow-card sm:p-6"
    >
      <h2
        id="cms-info-heading"
        className="inline-flex items-center gap-2 text-sm font-bold text-foreground"
      >
        <BookOpenIcon aria-hidden="true" className="size-4 text-brand-600" />
        How the CMS works
      </h2>
      <div className="mt-4 grid gap-x-8 gap-y-4 text-sm text-muted-foreground md:grid-cols-2 md:divide-x md:divide-border/60">
        <p className="md:pr-8">
          <span className="font-medium text-foreground">Banners</span> and{" "}
          <span className="font-medium text-foreground">Programs</span> you publish here
          replace the website&apos;s built-in defaults — until you add your own, the
          homepage keeps showing the existing MASOM content.
        </p>
        <p className="md:pl-8">
          <span className="font-medium text-foreground">Announcements</span> appear in the
          news ticker at the top of the homepage. When there are none, the ticker is hidden
          automatically.
        </p>
      </div>
    </section>
  );
}
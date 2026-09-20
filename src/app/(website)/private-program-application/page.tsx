import { CalendarCheckIcon, FileTextIcon, MailIcon } from "lucide-react";

import { Container } from "@/components/layout/container";
import { ParallaxBackground } from "@/components/website/parallax-background";
import { Reveal } from "@/components/website/reveal";
import { PrivateProgramForm } from "@/features/private-program/components/private-program-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata = createMetadata({
  title: "Private Program Application",
  description: "Submit an application to host a private program at MASOM.",
  path: "/private-program-application",
});

// The agreement date defaults to "today", so the page must be rendered per
// request rather than frozen at build time.
export const dynamic = "force-dynamic";

/** Today in MASOM's local timezone as `YYYY-MM-DD` (the value a date input wants). */
function centralToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const highlights = [
  {
    icon: FileTextIcon,
    title: "Complete the form",
    description: "The same information as MASOM's printed Private Program form.",
  },
  {
    icon: MailIcon,
    title: "Sent to the Secretary",
    description: "Your application is emailed directly to the MASOM Secretary.",
  },
  {
    icon: CalendarCheckIcon,
    title: "MASOM reviews it",
    description: "A representative contacts you once the request has been reviewed.",
  },
];

export default function PrivateProgramApplicationPage() {
  return (
    <>
      {/* Page hero */}
      <section className="relative isolate overflow-hidden bg-ink-900 py-20 sm:py-24 lg:py-28">
        <ParallaxBackground
          src="https://images.pexels.com/photos/38235418/pexels-photo-38235418.jpeg?auto=compress&cs=tinysrgb&w=1920"
          opacity="opacity-50"
        />
        <div className="absolute inset-0 bg-ink-900/70" />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(92,184,178,0.12),transparent_60%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sand-400/40 to-transparent"
          aria-hidden="true"
        />
        <Container className="relative">
          <Reveal className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <span className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.22em] text-brand-400 uppercase">
              <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
              Private Programs
              <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Application for Private Program
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70">
              Use this form to request the use of MASOM facilities for a private program.
              Please complete every required section and review the MASOM guidelines before
              submitting.
            </p>
            <p className="mt-6 rounded-full border border-sand-400/30 bg-white/5 px-5 py-2 text-xs leading-relaxed font-semibold tracking-wide text-sand-200">
              Submitting this application does not automatically confirm or reserve the
              facility.
            </p>
          </Reveal>
        </Container>
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-sand-400/50 to-transparent"
          aria-hidden="true"
        />
      </section>

      {/* How it works */}
      <section className="border-b border-border/60 bg-muted/20 py-10 sm:py-12">
        <Container>
          <div className="grid gap-6 sm:grid-cols-3">
            {highlights.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.07}>
                <div className="flex h-full items-start gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-heading text-base leading-snug font-bold text-foreground">
                      {item.title}
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Application form */}
      <section className="bg-background py-14 sm:py-18 lg:py-20">
        <Container>
          {/* Rendered directly — no scroll reveal. The form is tall, so wrapping
              it in <Reveal> left the whole application invisible until 20% of it
              scrolled into view, which read as a missing form. */}
          <div className="mx-auto max-w-3xl">
            <PrivateProgramForm defaultAgreementDate={centralToday()} />

            <div className="mt-10">
              <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
                Questions about this application? Please contact the Secretary of MASOM at{" "}
                <a
                  href="mailto:secretary@masom.com"
                  className="font-semibold text-brand-600 transition-colors hover:text-brand-500"
                >
                  secretary@masom.com
                </a>
                .
              </p>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

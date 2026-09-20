import { ArrowRightIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { ParallaxBackground } from "@/components/website/parallax-background";
import { Reveal } from "@/components/website/reveal";
import { SectionHeading } from "@/components/website/section-heading";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata = createMetadata({
  title: "Online Forms",
  description:
    "Download MASOM's online forms in PDF format — Membership Guidelines, Membership Form and Private Program application.",
  path: "/forms",
});

type FormDocument = {
  title: string;
  description: string;
  url: string;
  /** Route of the online equivalent, when this form can be submitted on the site. */
  applyUrl?: string;
};

/** Source: masom.com/forms — actual live PDF URLs (wp-content uploads). */
const documents: FormDocument[] = [
  {
    title: "Membership Guidelines",
    description: "Membership guidelines and information",
    url: "https://masom.com/wp-content/uploads/2020/07/MASOM_Membership_Guidelines_2019.pdf",
  },
  {
    title: "Membership Form",
    description: "Official MASOM membership form",
    url: "https://masom.com/wp-content/uploads/2020/07/MASOM_Membership_Form_and_Release_2020.pdf",
  },
  {
    title: "Private Program",
    description: "Private program application form",
    url: "https://masom.com/wp-content/uploads/2020/07/privateProgram.pdf",
    applyUrl: "/private-program-application",
  },
];

export default function FormsPage() {
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
              MASOM Online Forms
              <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Online Forms
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70">
              Forms are available in PDF format.
            </p>
          </Reveal>
        </Container>
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-sand-400/50 to-transparent"
          aria-hidden="true"
        />
      </section>

      {/* Document grid */}
      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Online Form Submission"
              title="Available Forms"
              description="View and download MASOM PDF forms."
            />
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc, index) => (
              <Reveal key={doc.title} delay={index * 0.07}>
                <article className="group relative flex h-full flex-col rounded-2xl border border-border/60 bg-card p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-elevated">
                  <div className="flex items-start justify-between">
                    <span className="flex size-13 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 transition-colors duration-300 group-hover:bg-brand-500/15">
                      <FileTextIcon className="size-6" aria-hidden="true" />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.14em] text-destructive uppercase">
                      PDF
                    </span>
                  </div>

                  <h2 className="mt-6 font-heading text-xl leading-snug font-bold text-foreground">
                    {doc.title}
                  </h2>
                  <span
                    className="mt-3 block h-0.5 w-10 rounded-full bg-brand-500 transition-all duration-300 group-hover:w-16"
                    aria-hidden="true"
                  />
                  <p className="mt-4 flex-1 text-base leading-relaxed text-muted-foreground">
                    {doc.description}
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    {doc.applyUrl ? (
                      <Link
                        href={doc.applyUrl}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                      >
                        Apply Online
                        <ArrowRightIcon className="size-4" aria-hidden="true" />
                      </Link>
                    ) : null}
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        doc.applyUrl
                          ? "inline-flex items-center gap-2 rounded-xl border border-border/70 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brand-500/50 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                          : "inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                      }
                    >
                      View PDF
                      <ExternalLinkIcon className="size-4" aria-hidden="true" />
                    </a>
                    <a
                      href={doc.url}
                      download
                      className="inline-flex items-center gap-2 rounded-xl border border-border/70 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-brand-500/50 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                      Download
                      <DownloadIcon className="size-4" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15} className="mt-10">
            <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
              Need a printed copy or have questions about a form? Please contact the Secretary of
              MASOM at{" "}
              <a
                href="mailto:secretary@masom.com"
                className="font-semibold text-brand-600 transition-colors hover:text-brand-500"
              >
                secretary@masom.com
              </a>
              .
            </p>
          </Reveal>
        </Container>
      </section>
    </>
  );
}

import { ExternalLinkIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";

import { Container } from "@/components/layout/container";
import { ParallaxBackground } from "@/components/website/parallax-background";
import { Reveal } from "@/components/website/reveal";
import { siteConfig } from "@/config/site";
import { ContactForm } from "@/features/contact/components/contact-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata = createMetadata({
  title: "Contact Us",
  description:
    "Contact the Secretary of MASOM at (773) 283-9718 or secretary@masom.com, or visit the MASOM Imambargah at 4353 West Lawrence Avenue, Chicago, IL 60630.",
  path: "/contacts",
});

const { contact } = siteConfig;

export default function ContactsPage() {
  return (
    <>
      {/* Page hero */}
      <section className="relative isolate overflow-hidden bg-ink-900 py-20 sm:py-24 lg:py-28">
        <ParallaxBackground
          src="https://images.pexels.com/photos/7428026/pexels-photo-7428026.jpeg?auto=compress&cs=tinysrgb&w=1920"
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
              MASOM Imambargah
              <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Contact Us
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70">
              Contact the Secretary of MASOM.
            </p>
          </Reveal>
        </Container>
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-sand-400/50 to-transparent"
          aria-hidden="true"
        />
      </section>

      {/* Contact information + form | map */}
      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            {/* LEFT: get in touch + form */}
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.22em] text-brand-600 uppercase">
                  <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
                  Secretary of MASOM
                </span>
                <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
                  Get in Touch
                </h2>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
                  We&apos;d love to hear from you — reach out for questions, suggestions or more
                  information.
                </p>
              </Reveal>

              <Reveal delay={0.06} className="mt-8">
                <ul className="grid gap-4 sm:grid-cols-2">
                  <li className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-elevated">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                      <PhoneIcon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        Phone
                      </p>
                      <a
                        href={contact.phoneHref}
                        className="mt-1 block font-heading text-lg leading-snug font-bold text-foreground transition-colors hover:text-brand-600"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-elevated">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                      <MailIcon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        Email
                      </p>
                      <a
                        href={`mailto:${contact.email}`}
                        className="mt-1 block font-heading text-lg leading-snug font-bold break-all text-foreground transition-colors hover:text-brand-600"
                      >
                        {contact.email}
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-elevated sm:col-span-2">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                      <MapPinIcon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        Address
                      </p>
                      <a
                        href={contact.address.mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group mt-1 block font-heading text-lg leading-snug font-bold text-foreground transition-colors hover:text-brand-600"
                      >
                        {contact.address.lines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </a>
                    </div>
                  </li>
                </ul>
              </Reveal>

              <Reveal delay={0.1} className="mt-12">
                <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Contact Form</h2>
                <ContactForm />
              </Reveal>
            </div>

            {/* RIGHT: map */}
            <Reveal delay={0.12}>
              <div className="lg:sticky lg:top-8">
                <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Find Us</h2>
                <div className="relative mt-6 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
                  <iframe
                    src={contact.address.mapEmbedUrl}
                    title={`Google Map showing ${contact.address.full}`}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-[26rem] w-full border-0 sm:h-[30rem] lg:h-[34rem]"
                  />

                  {/* Floating location card */}
                  <div className="absolute right-4 bottom-4 left-4 rounded-2xl border border-border/60 bg-background/95 p-5 shadow-elevated backdrop-blur-sm">
                    <p className="font-heading text-base font-bold text-foreground">MASOM</p>
                    <address className="mt-1 not-italic">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {contact.address.lines[0]}
                        <br />
                        {contact.address.lines[1]}
                      </p>
                    </address>
                    <a
                      href={contact.address.mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-500"
                    >
                      Open in Google Maps
                      <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}

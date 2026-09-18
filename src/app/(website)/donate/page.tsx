import {
  BanknoteIcon,
  HandHeartIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  SendIcon,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { ParallaxBackground } from "@/components/website/parallax-background";
import { Reveal } from "@/components/website/reveal";
import { SectionHeading } from "@/components/website/section-heading";
import { siteConfig } from "@/config/site";
import { DonationForm } from "@/features/donations/components/donation-form";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata = createMetadata({
  title: "Donate",
  description:
    "Support MASOM — donate to the Midwest Association of Shia Organized Muslims through Zelle/Quickpay or by regular mail, or submit your donation information online.",
  path: "/donate",
});

const { contact } = siteConfig;

function MethodCard({
  icon,
  iconLabel,
  title,
  children,
}: {
  icon: ReactNode;
  iconLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-border/60 bg-card p-7 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-elevated">
      <span
        className="flex size-13 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600"
        aria-label={iconLabel}
      >
        {icon}
      </span>
      <h3 className="mt-6 font-heading text-xl leading-snug font-bold text-foreground">{title}</h3>
      <span
        className="mt-3 block h-0.5 w-10 rounded-full bg-brand-500"
        aria-hidden="true"
      />
      <div className="mt-4 flex-1 text-base leading-relaxed text-muted-foreground">{children}</div>
    </article>
  );
}

export default function DonatePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink-900 py-20 sm:py-24 lg:py-28">
        <ParallaxBackground
          src="https://images.pexels.com/photos/6646917/pexels-photo-6646917.jpeg?auto=compress&cs=tinysrgb&w=1920"
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
              Support Your Community
              <span className="h-px w-7 bg-current opacity-50" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Donate to MASOM
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70">
              Please send your donations and Sadaqat to MASOM through Zelle/Quickpay, or by
              regular mail.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#donation-form"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-7 py-3.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
              >
                Support MASOM
                <SendIcon className="size-4" aria-hidden="true" />
              </a>
              <a
                href="#donation-methods"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-brand-400/60 hover:text-brand-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
              >
                Ways to Give
              </a>
            </div>
          </Reveal>
        </Container>
        <div
          className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-sand-400/50 to-transparent"
          aria-hidden="true"
        />
      </section>

      {/* Introduction */}
      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <Container>
          <Reveal>
            <blockquote className="mx-auto max-w-3xl text-center">
              <span
                className="mx-auto block h-10 w-px bg-gradient-to-b from-transparent via-brand-500 to-transparent"
                aria-hidden="true"
              />
              <p className="mt-6 text-xl leading-relaxed text-foreground sm:text-2xl">
                &ldquo;May Allah bless you! Thank you. Those who (in charity) spend of their goods
                by night and by day, in secret and in public, have their reward with their
                Lord.&rdquo;
              </p>
              <span
                className="mx-auto mt-6 block h-10 w-px bg-gradient-to-b from-transparent via-brand-500 to-transparent"
                aria-hidden="true"
              />
            </blockquote>
          </Reveal>

          <Reveal delay={0.08} className="mt-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-base leading-relaxed text-muted-foreground">
                Your donations and Sadaqat help MASOM serve the Shia Muslim community of the
                greater Chicago area — from daily Imambargah programs and religious services to
                community support and outreach.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Please send your donations and Sadaqat* to MASOM through one of the following
                methods:
              </p>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Donation methods */}
      <section id="donation-methods" className="bg-muted/40 py-16 sm:py-20 lg:py-24 scroll-mt-8">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="How to Donate"
              title="Ways to Support MASOM"
              description="Choose whichever method suits you best."
            />
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal delay={0.05}>
              <MethodCard
                icon={<BanknoteIcon className="size-6" aria-hidden="true" />}
                iconLabel="Zelle / Quickpay"
                title="Zelle / Quickpay (Preferred)"
              >
                <p>
                  Please login to your Bank/Zelle account and make payments using our email:{" "}
                  <a
                    href={`mailto:${siteConfig.donation.zelleEmail}`}
                    className="font-semibold text-brand-600 transition-colors hover:text-brand-500"
                  >
                    {siteConfig.donation.zelleEmail}
                  </a>
                  .
                </p>
                <div className="mt-5 flex flex-col items-center gap-3">
                  <Image
                    src={siteConfig.donation.zelleQr.src}
                    alt={siteConfig.donation.zelleQrAlt}
                    width={siteConfig.donation.zelleQr.width}
                    height={siteConfig.donation.zelleQr.height}
                    className="h-auto w-72 max-w-full object-contain sm:w-80"
                    sizes="(max-width: 640px) 90vw, 320px"
                  />
                  <p className="text-center text-sm leading-relaxed text-muted-foreground">
                    Scan the QR code using your bank&apos;s Zelle-enabled app, or send your
                    donation to {siteConfig.donation.zelleEmail}.
                  </p>
                </div>
              </MethodCard>
            </Reveal>

            <Reveal delay={0.1}>
              <MethodCard
                icon={<MailIcon className="size-6" aria-hidden="true" />}
                iconLabel="Regular mail"
                title="Regular Mail"
              >
                <p>
                  Please send your checks to MASOM, 4353 W Lawrence Ave, Chicago, IL, 60630.
                </p>
              </MethodCard>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="mt-8">
            <p className="mx-auto max-w-2xl rounded-2xl border border-sand-400/40 bg-sand-400/10 px-6 py-4 text-center text-sm leading-relaxed text-foreground">
              <strong className="font-bold">Note:</strong> For Sadaqa and Fitra, please mention
              Syed or Non-Syed in the memo.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Donation form */}
      <section id="donation-form" className="bg-background py-16 sm:py-20 lg:py-24 scroll-mt-8">
        <Container>
          <div className="grid items-start gap-12 lg:grid-cols-5 lg:gap-16">
            {/* LEFT: context + contact help */}
            <div className="lg:col-span-2 lg:sticky lg:top-8">
              <Reveal>
                <SectionHeading
                  align="start"
                  eyebrow="Donation Information"
                  title="Tell MASOM About Your Donation"
                  description="Share your donation details online and MASOM will receive them right away. This is a submission form — it does not process payment."
                />

                <div className="mt-8">
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    Questions about your donation?
                  </h3>
                  <ul className="mt-4 space-y-4">
                    <li className="flex items-start gap-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                        <PhoneIcon className="size-4.5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                          Phone
                        </p>
                        <a
                          href={contact.phoneHref}
                          className="mt-0.5 block text-sm font-semibold text-foreground transition-colors hover:text-brand-600"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                        <MailIcon className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                          Email
                        </p>
                        <a
                          href={`mailto:${contact.email}`}
                          className="mt-0.5 block text-sm font-semibold break-all text-foreground transition-colors hover:text-brand-600"
                        >
                          {contact.email}
                        </a>
                      </div>
                    </li>
                    <li className="flex items-start gap-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                        <MapPinIcon className="size-4.5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                          Address
                        </p>
                        <a
                          href={contact.address.mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block text-sm font-semibold text-foreground transition-colors hover:text-brand-600"
                        >
                          {contact.address.lines[0]}
                          <br />
                          {contact.address.lines[1]}
                        </a>
                      </div>
                    </li>
                  </ul>

                  <div className="mt-8 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
                    <div className="flex items-start gap-3">
                      <HandHeartIcon className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        For Sadaqa and Fitra, please mention <strong className="text-foreground">Syed or Non-Syed</strong> in the Zelle memo or on your check.
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* RIGHT: form card */}
            <Reveal delay={0.1} className="lg:col-span-3">
              <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                    <SendIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-heading text-xl font-bold text-foreground">
                      Donation Form
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      We&apos;ll receive your details by email.
                    </p>
                  </div>
                </div>
                <div className="mt-7">
                  <DonationForm />
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Closing note */}
      <section className="border-t border-border/60 bg-muted/40 py-14">
        <Container>
          <Reveal>
            <p className="mx-auto max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
              May Allah reward you for your generosity. If you have any questions about your
              donation, please call{" "}
              <a
                href={contact.phoneHref}
                className="font-semibold text-brand-600 transition-colors hover:text-brand-500"
              >
                {contact.phone}
              </a>{" "}
              or email{" "}
              <a
                href={`mailto:${contact.email}`}
                className="font-semibold text-brand-600 transition-colors hover:text-brand-500"
              >
                {contact.email}
              </a>
              .
            </p>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
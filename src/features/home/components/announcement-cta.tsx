import { ArrowUpRightIcon, MailIcon, MessageCircleIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/website/reveal";
import { getPublicSiteSettings } from "@/features/site-settings/queries";
import { cn } from "@/lib/utils";

const iconById: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "email-announcements": MailIcon,
  "whatsapp-events": MessageCircleIcon,
};

type CtaItem = {
  id: string;
  label: string;
  href: string;
};

/**
 * The two homepage action cards beneath the hero. Visual design is unchanged;
 * visibility, labels and links come from the Site Settings singleton so the
 * admin can toggle/edit them. When both are disabled the whole section (and
 * its negative-margin overlap) collapses cleanly — no empty wrapper.
 */
export async function AnnouncementCta() {
  const settings = await getPublicSiteSettings();

  // Fixed order: 1) Email Announcements, 2) WhatsApp Events Group.
  const ctas: CtaItem[] = [];
  if (settings.email_announcements_enabled) {
    ctas.push({
      id: "email-announcements",
      label: settings.email_announcements_label,
      href: settings.email_announcements_url,
    });
  }
  if (settings.whatsapp_group_enabled) {
    ctas.push({
      id: "whatsapp-events",
      label: settings.whatsapp_group_label,
      href: settings.whatsapp_group_url,
    });
  }

  if (ctas.length === 0) return null;

  return (
    <Container className="relative z-10 -mt-14 sm:-mt-20">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        {ctas.map((cta, index) => {
          const Icon = iconById[cta.id] ?? MailIcon;
          return (
            <Reveal key={cta.id} delay={index * 0.08}>
              <a
                href={cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-card transition-all duration-300",
                  "hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-elevated sm:p-6",
                )}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white">
                  <Icon className="size-6" />
                </span>
                <span className="flex-1 text-base font-bold text-foreground sm:text-lg">
                  {cta.label}
                </span>
                <ArrowUpRightIcon className="size-5 shrink-0 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600" />
              </a>
            </Reveal>
          );
        })}
      </div>
    </Container>
  );
}

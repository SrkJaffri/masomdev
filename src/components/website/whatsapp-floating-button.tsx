import { WhatsAppIcon } from "@/features/home/components/whatsapp-icon";
import { getPublicSiteSettings } from "@/features/site-settings/queries";
import { normalizeWhatsappPhone } from "@/features/site-settings/schema";

import { cn } from "@/lib/utils";

/**
 * Floating "Chat with MASOM" WhatsApp button for public pages only (mounted in
 * the (website) layout — never inside /admin). Rendered entirely on the server:
 * it is just a link, so no client JavaScript ships with it. Visibility, phone,
 * pre-filled message and hover label are all Site-Settings-driven.
 *
 * Positioning: the root layout's Back-to-Top button occupies right-5 bottom-5
 * (44px tall → its top edge sits 64px from the viewport bottom). This button
 * stacks cleanly above it, right-aligned to the same column, and stays clear
 * of dialogs/mobile drawers (z-40 < their z-50).
 */
export async function WhatsAppFloatingButton() {
  const settings = await getPublicSiteSettings();

  // A disabled toggle is authoritative: render nothing at all — no wrapper,
  // no ghost link, no listeners.
  if (!settings.floating_whatsapp_enabled) return null;

  // wa.me wants bare international digits: strip spaces/+()/-. The message is
  // always encoded via URLSearchParams.
  const normalized = normalizeWhatsappPhone(settings.floating_whatsapp_phone);
  const whatsappUrl = `https://wa.me/${normalized}?${new URLSearchParams({
    text: settings.floating_whatsapp_message,
  })}`;

  return (
    <div className="fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 sm:bottom-[4.75rem]">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${settings.floating_whatsapp_label} on WhatsApp`}
        className={cn(
          "group relative grid size-13 place-items-center rounded-full sm:size-14",
          "bg-[#25D366] text-white shadow-elevated",
          "transition-all duration-300 ease-brand",
          "hover:scale-105 hover:bg-[#1FB855] hover:shadow-lg",
          "active:scale-95",
          "focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
          "motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          "animate-in fade-in-0 slide-in-from-bottom-2 duration-700 motion-reduce:animate-none",
        )}
      >
        <WhatsAppIcon className="size-7 sm:size-8" />

        {/* Desktop-only hover/focus label. Decorative — the aria-label already
         * conveys the action, so the tooltip is never required to understand
         * the button and never captures pointers. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute right-full mr-3 hidden rounded-lg bg-ink-900 px-3 py-1.5",
            "text-sm font-medium whitespace-nowrap text-white opacity-0 shadow-elevated sm:block",
            "translate-x-1 transition-all duration-200 ease-brand",
            "group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
            "motion-reduce:transition-none motion-reduce:translate-x-0",
          )}
        >
          {settings.floating_whatsapp_label}
        </span>
      </a>
    </div>
  );
}

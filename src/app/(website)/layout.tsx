import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppFloatingButton } from "@/components/website/whatsapp-floating-button";
import { SiteHeader } from "@/components/layout/site-header";
import { SitePopupMount } from "@/components/website/site-popup-mount";
import { AssistantMount } from "@/features/assistant/components/assistant-mount";

export default function WebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppFloatingButton />
      {/* Public pages only — CMS-controlled announcement popup (no-op while
          disabled: renders nothing and ships no delayed-open client JS). */}
      <SitePopupMount />
      {/* Public pages only — the assistant is never mounted in /admin. */}
      <AssistantMount />
    </div>
  );
}

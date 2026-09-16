import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsAppFloatingButton } from "@/components/website/whatsapp-floating-button";
import { SiteHeader } from "@/components/layout/site-header";
import { CustomCursor } from "@/components/website/custom-cursor";

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
      <CustomCursor />
      <WhatsAppFloatingButton />
    </div>
  );
}

import { NewsletterManager } from "@/features/newsletter/components/newsletter-manager";
import { getNewsletterSubscribers } from "@/features/newsletter/queries";

export default async function AdminNewsletterPage() {
  const subscribers = await getNewsletterSubscribers();
  return <NewsletterManager subscribers={subscribers} />;
}

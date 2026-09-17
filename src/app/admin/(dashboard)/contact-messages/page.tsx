import { ContactMessageManager } from "@/features/contact/components/contact-message-manager";
import { getContactSubmissions } from "@/features/contact/queries";

export default async function AdminContactMessagesPage() {
  const submissions = await getContactSubmissions();
  return <ContactMessageManager submissions={submissions} />;
}

import { DonationIntentManager } from "@/features/donations/components/donation-intent-manager";
import { getDonationIntents } from "@/features/donations/queries";

export default async function AdminDonationIntentsPage() {
  const intents = await getDonationIntents();
  return <DonationIntentManager intents={intents} />;
}

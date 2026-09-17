import { getAuthContext } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logCmsError } from "@/lib/cms/logging";

/**
 * Admin-only CSV export of newsletter subscribers. Reuses getAuthContext() (the
 * same check the admin layout applies) instead of requireAdmin(), because
 * requireAdmin() redirects — wrong semantics for an API route; here we return
 * 401/403 responses. Reads run through the service-role client, so RLS is not
 * the gate — the explicit admin check above is.
 */
export async function GET() {
  const { user, isAdmin } = await getAuthContext();
  if (!user || !isAdmin) {
    return new Response("Unauthorized", { status: user ? 403 : 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("email,status,consent,source,subscribed_at")
    .order("subscribed_at", { ascending: false });

  if (error) {
    logCmsError("newsletter:export", error);
    return new Response("Internal error", { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    email: string;
    status: string;
    consent: boolean;
    source: string | null;
    subscribed_at: string;
  }>;

  const header = ["email", "status", "consent", "source", "subscribed_at"];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.email,
        row.status,
        row.consent ? "yes" : "no",
        row.source ?? "homepage",
        row.subscribed_at,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="masom-newsletter-subscribers.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

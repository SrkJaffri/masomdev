import { getAuthContext } from "@/features/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logCmsError } from "@/lib/cms/logging";

/**
 * Admin-only CSV export of contact submissions. Same authorization approach
 * as the newsletter export: getAuthContext() (401/403 semantics) instead of
 * requireAdmin() (redirect semantics). Fields escape commas, quotes and
 * newlines; internal ids are not exported.
 */
export async function GET() {
  const { user, isAdmin } = await getAuthContext();
  if (!user || !isAdmin) {
    return new Response("Unauthorized", { status: user ? 403 : 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("contact_submissions")
    .select("name,email,message,status,source,submitted_at")
    .order("submitted_at", { ascending: false });

  if (error) {
    logCmsError("contact:export", error);
    return new Response("Internal error", { status: 500 });
  }

  const rows = (data ?? []) as Array<{
    name: string;
    email: string;
    message: string;
    status: string;
    source: string | null;
    submitted_at: string;
  }>;

  const header = ["name", "email", "message", "status", "source", "submitted_at"];
  const escape = (value: string) => `"${value.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [row.name, row.email, row.message, row.status, row.source ?? "contacts-page", row.submitted_at]
        .map(escape)
        .join(","),
    ),
  ];

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="masom-contact-messages.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

"use client";

import { DownloadIcon, MailOpenIcon, MailPlusIcon } from "lucide-react";
import { useMemo, useState, useActionState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SubmitButton } from "@/components/admin/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setSubscriberStatus } from "@/features/newsletter/admin-actions";
import type { NewsletterSubscriber } from "@/features/newsletter/types";
import { idleResult } from "@/lib/cms/validation";

/**
 * Single subscriber row. Each row owns its own action state so the status pill
 * updates only the row that changed (and two rows can act independently).
 */
function SubscriberRow({ subscriber }: { subscriber: NewsletterSubscriber }) {
  const active = subscriber.status === "subscribed";
  const [result, formAction] = useActionState(setSubscriberStatus, idleResult);

  return (
    <TableRow>
      <TableCell className="max-w-xs truncate font-medium text-foreground">
        {subscriber.email}
      </TableCell>
      <TableCell>
        <StatusBadge
          active={active}
          activeLabel="Subscribed"
          inactiveLabel="Unsubscribed"
        />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {subscriber.consent ? "Yes" : "No"}
      </TableCell>
      <TableCell className="capitalize text-muted-foreground">
        {subscriber.source}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {new Date(subscriber.subscribed_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </TableCell>
      <TableCell className="w-36">
        <form action={formAction}>
          <input type="hidden" name="id" value={subscriber.id} />
          <input type="hidden" name="status" value={active ? "unsubscribed" : "subscribed"} />
          <SubmitButton
            variant="outline"
            size="sm"
            pendingLabel="…"
            aria-label={
              active
                ? `Unsubscribe ${subscriber.email}`
                : `Resubscribe ${subscriber.email}`
            }
          >
            {active ? (
              <>
                <MailOpenIcon className="size-4" />
                Unsubscribe
              </>
            ) : (
              <>
                <MailPlusIcon className="size-4" />
                Resubscribe
              </>
            )}
          </SubmitButton>
        </form>
        {result.status === "error" ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {result.message}
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

export function NewsletterManager({
  subscribers,
}: {
  subscribers: NewsletterSubscriber[];
}) {
  const [query, setQuery] = useState("");

  // Client-side email filtering — datasets are small (one row per human
  // subscriber); no need for a server round-trip per keystroke.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter((subscriber) => subscriber.email.includes(q));
  }, [subscribers, query]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Newsletter Subscribers"
        description="Manage people subscribed to MASOM website updates."
      >
        <Button variant="cta" asChild>
          <a href="/api/admin/newsletter/export">
            <DownloadIcon className="size-4" />
            Export CSV
          </a>
        </Button>
      </AdminPageHeader>

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by email…"
        aria-label="Search subscribers by email"
        className="max-w-sm"
      />

      {subscribers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No subscribers yet. Homepage signups will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No subscribers match “{query}”.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-20">Consent</TableHead>
                <TableHead className="w-24">Source</TableHead>
                <TableHead className="w-36">Subscribed On</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((subscriber) => (
                <SubscriberRow key={subscriber.id} subscriber={subscriber} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

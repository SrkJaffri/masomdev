"use client";

import {
  DownloadIcon,
  EyeIcon,
  ReplyIcon,
} from "lucide-react";
import { useMemo, useState, useActionState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SubmitButton } from "@/components/admin/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setContactSubmissionStatus } from "@/features/contact/admin-actions";
import type { ContactStatus, ContactSubmission } from "@/features/contact/types";
import { idleResult } from "@/lib/cms/validation";

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
  archived: "Archived",
};

const STATUS_FILTERS: Array<{ value: "all" | ContactStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "archived", label: "Archived" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: ContactStatus }) {
  const styles: Record<ContactStatus, string> = {
    new: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
    read: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    replied: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    archived: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

/** One status-change form (used in the dialog footer). */
function StatusForm({
  id,
  status,
  label,
  variant = "outline",
}: {
  id: string;
  status: ContactStatus;
  label: string;
  variant?: "outline" | "destructive" | "default";
}) {
  const [, formAction] = useActionState(setContactSubmissionStatus, idleResult);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} pendingLabel="…" size="sm">
        {label}
      </SubmitButton>
    </form>
  );
}

function MessageDialog({
  submission,
  onClose,
}: {
  submission: ContactSubmission | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={submission !== null}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Message from {submission?.name}</DialogTitle>
          <DialogDescription>
            Submitted through the MASOM website contact form.
          </DialogDescription>
        </DialogHeader>

        {submission ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-semibold text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{submission.name}</dd>
              <dt className="font-semibold text-muted-foreground">Email</dt>
              <dd>
                <a
                  href={`mailto:${submission.email}`}
                  className="break-all font-medium text-brand-600 hover:text-brand-500"
                >
                  {submission.email}
                </a>
              </dd>
              <dt className="font-semibold text-muted-foreground">Status</dt>
              <dd>
                <StatusPill status={submission.status} />
              </dd>
              <dt className="font-semibold text-muted-foreground">Source</dt>
              <dd className="capitalize text-muted-foreground">{submission.source}</dd>
              <dt className="font-semibold text-muted-foreground">Submitted</dt>
              <dd className="text-muted-foreground">
                {formatDateTime(submission.submitted_at)}
              </dd>
            </dl>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Message</p>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {submission.message}
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          {submission ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${submission.email}?subject=Re: Your MASOM website message`}>
                  <ReplyIcon className="size-4" />
                  Reply by Email
                </a>
              </Button>
              {submission.status === "new" ? (
                <StatusForm id={submission.id} status="read" label="Mark Read" />
              ) : null}
              {submission.status !== "replied" && submission.status !== "archived" ? (
                <StatusForm id={submission.id} status="replied" label="Mark Replied" />
              ) : null}
              {submission.status !== "archived" ? (
                <StatusForm id={submission.id} status="archived" label="Archive" />
              ) : null}
              {submission.status !== "new" ? (
                <StatusForm id={submission.id} status="new" label="Mark New" />
              ) : null}
            </>
          ) : null}
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactMessageManager({
  submissions,
}: {
  submissions: ContactSubmission[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ContactStatus>("all");
  const [selected, setSelected] = useState<ContactSubmission | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submissions.filter((submission) => {
      if (statusFilter !== "all" && submission.status !== statusFilter) return false;
      if (!q) return true;
      return (
        submission.name.toLowerCase().includes(q) ||
        submission.email.toLowerCase().includes(q) ||
        submission.message.toLowerCase().includes(q)
      );
    });
  }, [submissions, query, statusFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Contact Messages"
        description="Messages submitted through the MASOM website contact form."
      >
        <Button variant="cta" asChild>
          <a href="/api/admin/contact-messages/export">
            <DownloadIcon className="size-4" />
            Export CSV
          </a>
        </Button>
      </AdminPageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email or message…"
          aria-label="Search contact messages"
          className="max-w-sm"
        />
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap gap-1.5"
        >
          {STATUS_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={active}
                className={`h-8 rounded-full px-3.5 text-xs font-bold transition-colors ${
                  active
                    ? "bg-brand-600 text-white"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No contact messages yet. Website form submissions will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No messages match your search or filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-72">Message</TableHead>
                <TableHead className="w-40">Submitted</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium text-foreground">
                    {submission.name}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {submission.email}
                  </TableCell>
                  <TableCell className="max-w-72">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {submission.message}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(submission.submitted_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={submission.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View message from ${submission.name}`}
                      onClick={() => setSelected(submission)}
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MessageDialog submission={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

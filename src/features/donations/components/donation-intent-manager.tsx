"use client";

import { EyeIcon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

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
import { setDonationIntentStatus } from "@/features/donations/admin-actions";
import {
  DONATION_INTENT_SOURCE_LABELS,
  DONATION_INTENT_STATUS_LABELS,
  type DonationIntent,
  type DonationIntentStatus,
} from "@/features/donations/types";
import { idleResult } from "@/lib/cms/validation";

/**
 * Donation intents admin.
 *
 * Every label here is deliberately about INTENT, not payment: this application
 * takes no money, so nothing in this screen may read as a receipt. The amount
 * column is the figure the donor typed, nothing more.
 */

const STATUS_FILTERS: Array<{ value: "all" | DonationIntentStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "registered", label: "Registered" },
  { value: "awaiting_payment", label: "Awaiting Payment" },
  { value: "reviewed", label: "Reviewed" },
  { value: "archived", label: "Archived" },
];

const STATUS_STYLES: Record<DonationIntentStatus, string> = {
  registered: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  awaiting_payment: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  reviewed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  archived: "bg-muted text-muted-foreground",
};

function formatAmount(amount: string | number): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({ status }: { status: DonationIntentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {DONATION_INTENT_STATUS_LABELS[status]}
    </span>
  );
}

function StatusForm({
  id,
  status,
  label,
}: {
  id: string;
  status: DonationIntentStatus;
  label: string;
}) {
  const [, formAction] = useActionState(setDonationIntentStatus, idleResult);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant="outline" pendingLabel="…" size="sm">
        {label}
      </SubmitButton>
    </form>
  );
}

function IntentDialog({
  intent,
  onClose,
}: {
  intent: DonationIntent | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={intent !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Donation entry from {intent?.name}</DialogTitle>
          <DialogDescription>
            A registered intention to donate. No payment has been processed or verified
            by the website.
          </DialogDescription>
        </DialogHeader>

        {intent ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-semibold text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{intent.name}</dd>
              <dt className="font-semibold text-muted-foreground">Email</dt>
              <dd>
                <a
                  href={`mailto:${intent.email}`}
                  className="break-all font-medium text-brand-600 hover:text-brand-500"
                >
                  {intent.email}
                </a>
              </dd>
              {intent.phone ? (
                <>
                  <dt className="font-semibold text-muted-foreground">Phone</dt>
                  <dd className="text-foreground">{intent.phone}</dd>
                </>
              ) : null}
              <dt className="font-semibold text-muted-foreground">Amount</dt>
              <dd className="font-medium text-foreground">
                {formatAmount(intent.amount)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (stated by donor — not charged)
                </span>
              </dd>
              <dt className="font-semibold text-muted-foreground">Type</dt>
              <dd className="text-foreground">{intent.donation_type}</dd>
              <dt className="font-semibold text-muted-foreground">Status</dt>
              <dd>
                <StatusPill status={intent.status} />
              </dd>
              <dt className="font-semibold text-muted-foreground">Source</dt>
              <dd className="text-muted-foreground">
                {DONATION_INTENT_SOURCE_LABELS[intent.source] ?? intent.source}
              </dd>
              <dt className="font-semibold text-muted-foreground">Submitted</dt>
              <dd className="text-muted-foreground">{formatDateTime(intent.submitted_at)}</dd>
            </dl>

            {intent.note ? (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Note</p>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {intent.note}
                </div>
              </div>
            ) : null}

            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              This record is an intention only. Confirm the actual transfer through Zelle,
              your bank statement or the received check before treating it as a donation.
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          {intent ? (
            <>
              {intent.status !== "awaiting_payment" && intent.status !== "archived" ? (
                <StatusForm
                  id={intent.id}
                  status="awaiting_payment"
                  label="Awaiting Payment"
                />
              ) : null}
              {intent.status !== "reviewed" && intent.status !== "archived" ? (
                <StatusForm id={intent.id} status="reviewed" label="Mark Reviewed" />
              ) : null}
              {intent.status !== "archived" ? (
                <StatusForm id={intent.id} status="archived" label="Archive" />
              ) : null}
              {intent.status !== "registered" ? (
                <StatusForm id={intent.id} status="registered" label="Reopen" />
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

export function DonationIntentManager({ intents }: { intents: DonationIntent[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DonationIntentStatus>("all");
  const [selected, setSelected] = useState<DonationIntent | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return intents.filter((intent) => {
      if (statusFilter !== "all" && intent.status !== statusFilter) return false;
      if (!q) return true;
      return (
        intent.name.toLowerCase().includes(q) ||
        intent.email.toLowerCase().includes(q) ||
        intent.donation_type.toLowerCase().includes(q)
      );
    });
  }, [intents, query, statusFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Donation Entries"
        description="Registered intentions to donate, from the website form and the MASOM Assistant. No payments are processed or confirmed here."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, email or type…"
          aria-label="Search donation entries"
          className="max-w-sm"
        />
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
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

      {intents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No donation entries yet. Registrations from the website will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No entries match your search or filter.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-28">Amount</TableHead>
                <TableHead className="w-40">Type</TableHead>
                <TableHead className="w-28">Source</TableHead>
                <TableHead className="w-36">Submitted</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((intent) => (
                <TableRow key={intent.id}>
                  <TableCell className="font-medium text-foreground">{intent.name}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">
                    {intent.email}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-foreground">
                    {formatAmount(intent.amount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {intent.donation_type}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {DONATION_INTENT_SOURCE_LABELS[intent.source] ?? intent.source}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(intent.submitted_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={intent.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`View donation entry from ${intent.name}`}
                      onClick={() => setSelected(intent)}
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

      <IntentDialog intent={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

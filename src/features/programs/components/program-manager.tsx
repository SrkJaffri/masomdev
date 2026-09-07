"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { AdminThumb } from "@/components/admin/admin-thumb";
import { DeleteConfirm } from "@/components/admin/delete-confirm";
import { StatusBadge } from "@/components/admin/status-badge";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createProgram, deleteProgram, updateProgram } from "@/features/programs/actions";
import type { ProgramAdminItem } from "@/features/programs/types";
import { idleResult } from "@/lib/cms/validation";

import { ProgramPosterField } from "./program-poster-field";

type DialogState =
  { mode: "create" } | { mode: "edit"; program: ProgramAdminItem } | null;

type ProgramAction = typeof createProgram;

/** UTC-safe "Friday, Sep 4, 2026" for an ISO date string. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Owns the action state so it can be remounted (via the dialog's key) per open.
 * Without the remount, useActionState keeps the previous "success" result and a
 * stale effect immediately closes the next dialog before it is visible.
 */
function ProgramForm({
  isEdit,
  program,
  action,
  onClose,
}: {
  isEdit: boolean;
  program: ProgramAdminItem | null;
  action: ProgramAction;
  onClose: () => void;
}) {
  const [result, formAction] = useActionState(action, idleResult);

  useEffect(() => {
    if (result.status === "success") onClose();
  }, [result, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit ? <input type="hidden" name="id" value={program!.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={program?.title ?? ""}
          placeholder="e.g. Alwidai Majalis"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={program?.description ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={program?.start_date ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date (optional)</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={program?.end_date ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_time">Start time (optional)</Label>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            defaultValue={program?.start_time?.slice(0, 5) ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_time">End time (optional)</Label>
          <Input
            id="end_time"
            name="end_time"
            type="time"
            defaultValue={program?.end_time?.slice(0, 5) ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input id="location" name="location" defaultValue={program?.location ?? ""} />
      </div>

      <ProgramPosterField
        isEdit={isEdit}
        hasCurrentPoster={Boolean(program?.poster_path)}
        currentPosterUrl={program?.previewUrl ?? null}
        currentPosterAlt={program?.title ?? "Current poster"}
      />

      <div className="space-y-2">
        <Label htmlFor="link_url">Link URL (optional)</Label>
        <Input
          id="link_url"
          name="link_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={program?.link_url ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort_order">Sort order</Label>
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={program?.sort_order ?? 0}
          className="w-28"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is_published"
          name="is_published"
          defaultChecked={program ? program.is_published : true}
        />
        <Label htmlFor="is_published">Published (show on the website)</Label>
      </div>

      {result.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {result.message}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton pendingLabel="Saving…">
          {isEdit ? "Save changes" : "Add program"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function ProgramDialog({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const isEdit = state?.mode === "edit";
  const program = isEdit ? state.program : null;
  const action = isEdit ? updateProgram : createProgram;

  return (
    <Dialog open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit program" : "Add program"}</DialogTitle>
          <DialogDescription>
            Programs shown in the homepage “Upcoming Programs” grid.
          </DialogDescription>
        </DialogHeader>

        <ProgramForm
          key={program?.id ?? "create"}
          isEdit={isEdit}
          program={program}
          action={action}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export function ProgramManager({ programs }: { programs: ProgramAdminItem[] }) {
  const [dialog, setDialog] = useState<DialogState>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Programs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upcoming events and majalis.
          </p>
        </div>
        <Button variant="cta" onClick={() => setDialog({ mode: "create" })}>
          <PlusIcon className="size-4" />
          Add program
        </Button>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No programs yet. The homepage is showing the built-in default programs. Add
            one to take over the Upcoming Programs section.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Poster</TableHead>
                <TableHead>Program</TableHead>
                <TableHead className="w-44">Date</TableHead>
                <TableHead className="w-44">Time</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell>
                    <AdminThumb
                      src={program.previewUrl}
                      alt={program.title}
                      className="h-16 w-12"
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{program.title}</p>
                    {program.location ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {program.location}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(program.start_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {program.timeLabel ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      active={program.is_published}
                      activeLabel="Published"
                      inactiveLabel="Draft"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit program"
                        onClick={() => setDialog({ mode: "edit", program })}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <DeleteConfirm
                        action={deleteProgram}
                        id={program.id}
                        entityLabel="program"
                        name={program.title}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProgramDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

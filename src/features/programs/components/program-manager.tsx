"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
import {
  createProgram as createProgramBase,
  deleteProgram as deleteProgramBase,
  updateProgram as updateProgramBase,
} from "@/features/programs/actions";
import type { ProgramAdminItem, ProgramPosterMedia } from "@/features/programs/types";
import {
  STALE_SERVER_MESSAGE,
  idleResult,
  withSafeAction,
  type ActionResult,
} from "@/lib/cms/validation";

import { ProgramPosterField } from "./program-poster-field";

type DialogState =
  { mode: "create" } | { mode: "edit"; program: ProgramAdminItem } | null;

type ProgramAction = ReturnType<typeof withSafeAction>;

const createProgram = withSafeAction(createProgramBase);
const updateProgram = withSafeAction(updateProgramBase);
const deleteProgram = withSafeAction(deleteProgramBase);

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
 * True when the client-side action wrapper reported a stale server/deployment
 * (framework-level Server Action failure caught before the action ran).
 */
function isStaleServerResult(result: ActionResult): boolean {
  return (
    result.status === "error" &&
    result.message === STALE_SERVER_MESSAGE
  );
}

/**
 * Owns the action state so it can be remounted (via the dialog's key) per open.
 * Without the remount, useActionState keeps the previous "success" result and a
 * stale effect immediately closes the next dialog before it is visible.
 *
 * Entered values are CONTROLLED (via `values` + onInput defaults): React 19
 * resets uncontrolled form fields after every form action completes, so an
 * uncontrolled form would wipe the admin's entries on every validation error.
 * The server echoes the submitted values back in the error result; this form
 * adopts them as the new defaults. Poster selection lives here (lifted state)
 * so a failed submission keeps the picked file/library image.
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

  // ----- Entered-value preservation (React 19) -----
  // React resets uncontrolled form fields when a form action completes, so all
  // fields are CONTROLLED here: state is initialized from the program (or the
  // create defaults) and, after a validation error, the server's echo of what
  // was actually submitted is adopted. Errors can repeat any number of times
  // without losing the admin's entries.
  const [values, setValues] = useState(() => ({
    title: program?.title ?? "",
    description: program?.description ?? "",
    start_date: program?.start_date ?? "",
    end_date: program?.end_date ?? "",
    start_time: program?.start_time?.slice(0, 5) ?? "",
    end_time: program?.end_time?.slice(0, 5) ?? "",
    location: program?.location ?? "",
    link_url: program?.link_url ?? "",
    sort_order: String(program?.sort_order ?? 0),
    is_published: program ? program.is_published : true,
  }));

  useEffect(() => {
    if (result.status === "error" && result.values) {
      setValues((current) => ({ ...current, ...result.values }));
    }
  }, [result]);

  const set = (key: keyof typeof values) => (value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Poster selection — lifted so a failed submission keeps the pick + preview.
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterLibraryItem, setPosterLibraryItem] =
    useState<ProgramPosterMedia | null>(null);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit ? <input type="hidden" name="id" value={program!.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={values.title}
          onChange={(event) => set("title")(event.target.value)}
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
          value={values.description}
          onChange={(event) => set("description")(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            value={values.start_date}
            onChange={(event) => set("start_date")(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date (optional)</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            value={values.end_date}
            onChange={(event) => set("end_date")(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_time">Start time (optional)</Label>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            value={values.start_time}
            onChange={(event) => set("start_time")(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_time">End time (optional)</Label>
          <Input
            id="end_time"
            name="end_time"
            type="time"
            value={values.end_time}
            onChange={(event) => set("end_time")(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          name="location"
          value={values.location}
          onChange={(event) => set("location")(event.target.value)}
        />
      </div>

      <ProgramPosterField
        isEdit={isEdit}
        hasCurrentPoster={Boolean(program?.poster_path)}
        currentPosterUrl={program?.previewUrl ?? null}
        currentPosterAlt={program?.title ?? "Current poster"}
        file={posterFile}
        onFileChange={setPosterFile}
        libraryItem={posterLibraryItem}
        onLibraryItemChange={setPosterLibraryItem}
      />

      <div className="space-y-2">
        <Label htmlFor="link_url">Link URL (optional)</Label>
        <Input
          id="link_url"
          name="link_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={values.link_url}
          onChange={(event) => set("link_url")(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort_order">Sort order</Label>
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min={0}
          value={values.sort_order}
          onChange={(event) => set("sort_order")(event.target.value)}
          className="w-28"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Hidden input guarantees a false is submitted when unchecked —
            otherwise FormData would omit the key and the action's
            boolFromForm would default the echo to false. */}
        <input type="hidden" name="is_published" value={values.is_published ? "true" : "false"} />
        <Switch
          id="is_published"
          checked={values.is_published}
          onCheckedChange={(checked) => set("is_published")(checked)}
        />
        <Label htmlFor="is_published">Published (show on the website)</Label>
      </div>

      {result.status === "error" ? (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"
        >
          <p className="text-sm font-medium text-destructive">{result.message}</p>
          {result.correlationId ? (
            <p className="text-xs text-muted-foreground">
              Reference: {result.correlationId}
            </p>
          ) : null}
          {isStaleServerResult(result) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          ) : null}
        </div>
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

function ProgramDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
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
  // "?create=1" (from the dashboard Create-new dropdown / quick actions) opens
  // the create dialog immediately — the existing form, no duplicated CRUD logic.
  const [dialog, setDialog] = useState<DialogState>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("create")
      ? { mode: "create" }
      : null,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Programs" description="Upcoming events and majalis.">
        <Button variant="cta" onClick={() => setDialog({ mode: "create" })}>
          <PlusIcon className="size-4" />
          Add program
        </Button>
      </AdminPageHeader>

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

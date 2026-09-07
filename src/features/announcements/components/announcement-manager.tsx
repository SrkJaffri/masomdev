"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/features/announcements/actions";
import type { AnnouncementAdminItem } from "@/features/announcements/types";
import { idleResult } from "@/lib/cms/validation";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; announcement: AnnouncementAdminItem }
  | null;

type AnnouncementAction = typeof createAnnouncement;

/** ISO timestamp -> "YYYY-MM-DDTHH:MM" for <input type="datetime-local">. */
function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

function formatWindow(starts: string | null, expires: string | null): string {
  if (!starts && !expires) return "Always";
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (starts && expires) return `${fmt(starts)} – ${fmt(expires)}`;
  if (starts) return `From ${fmt(starts)}`;
  return `Until ${expires!}`;
}

/**
 * Owns the action state so it can be remounted (via the dialog's key) per open.
 * Without the remount, useActionState keeps the previous "success" result and a
 * stale effect immediately closes the next dialog before it is visible.
 */
function AnnouncementForm({
  isEdit,
  announcement,
  action,
  onClose,
}: {
  isEdit: boolean;
  announcement: AnnouncementAdminItem | null;
  action: AnnouncementAction;
  onClose: () => void;
}) {
  const [result, formAction] = useActionState(action, idleResult);

  useEffect(() => {
    if (result.status === "success") onClose();
  }, [result, onClose]);

  return (
    <form action={formAction} className="space-y-4">
      {isEdit ? <input type="hidden" name="id" value={announcement!.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          rows={2}
          defaultValue={announcement?.message ?? ""}
          placeholder="e.g. Muharram programs begin this Friday."
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="link_url">Link URL (optional)</Label>
          <Input
            id="link_url"
            name="link_url"
            type="url"
            inputMode="url"
            placeholder="https://…"
            defaultValue={announcement?.link_url ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="link_label">Link label (optional)</Label>
          <Input
            id="link_label"
            name="link_label"
            placeholder="Learn more"
            defaultValue={announcement?.link_label ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="starts_at">Starts (optional)</Label>
          <Input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(announcement?.starts_at ?? null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expires_at">Expires (optional)</Label>
          <Input
            id="expires_at"
            name="expires_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(announcement?.expires_at ?? null)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort_order">Sort order</Label>
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={announcement?.sort_order ?? 0}
          className="w-28"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is_active"
          name="is_active"
          defaultChecked={announcement ? announcement.is_active : true}
        />
        <Label htmlFor="is_active">Active (show on the website)</Label>
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
          {isEdit ? "Save changes" : "Add announcement"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function AnnouncementDialog({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const isEdit = state?.mode === "edit";
  const announcement = isEdit ? state.announcement : null;
  const action = isEdit ? updateAnnouncement : createAnnouncement;

  return (
    <Dialog open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit announcement" : "Add announcement"}</DialogTitle>
          <DialogDescription>Shown in the homepage news ticker.</DialogDescription>
        </DialogHeader>

        <AnnouncementForm
          key={announcement?.id ?? "create"}
          isEdit={isEdit}
          announcement={announcement}
          action={action}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementManager({
  announcements,
}: {
  announcements: AnnouncementAdminItem[];
}) {
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
      <AdminPageHeader
        title="Announcements"
        description="News ticker messages. The ticker is hidden when none are active."
      >
        <Button variant="cta" onClick={() => setDialog({ mode: "create" })}>
          <PlusIcon className="size-4" />
          Add announcement
        </Button>
      </AdminPageHeader>

      {announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No announcements yet. The news ticker stays hidden until you add one.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead className="w-32">Window</TableHead>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <p className="line-clamp-2 max-w-md font-medium text-foreground">
                      {announcement.message}
                    </p>
                    {announcement.link_url ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {announcement.link_url}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatWindow(announcement.starts_at, announcement.expires_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {announcement.sort_order}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={announcement.is_active} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit announcement"
                        onClick={() => setDialog({ mode: "edit", announcement })}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <DeleteConfirm
                        action={deleteAnnouncement}
                        id={announcement.id}
                        entityLabel="announcement"
                        name={announcement.message.slice(0, 40)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AnnouncementDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

"use client";

import Image from "next/image";
import {
  CheckIcon,
  ImagesIcon,
  Loader2Icon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deleteProgramPosterAction,
  getProgramPosterMediaAction,
} from "@/features/programs/actions";
import type { ProgramPosterMedia } from "@/features/programs/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

type MediaLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Storage name currently selected for the program (for the initial ring). */
  currentName?: string | null;
  onSelect: (item: ProgramPosterMedia) => void;
};

/**
 * Admin media library picker. Lists existing program posters from the
 * `programs` storage bucket. The listing is deliberately LAZY: it is fetched
 * through a server action only when the dialog opens, so /admin/programs never
 * pays the Storage listing cost during a plain page load. Thumbnails render
 * only inside this open dialog (lazy + paged), never on the manager page.
 */
export function MediaLibraryDialog({
  open,
  onOpenChange,
  currentName,
  onSelect,
}: MediaLibraryDialogProps) {
  const [items, setItems] = useState<ProgramPosterMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [pickedName, setPickedName] = useState<string | null>(null);

  // Delete flow: the item awaiting confirmation, the in-flight flag, fresh
  // server-side usage reported at confirm time (stale picker case), and any
  // user-facing error. `notice` is the transient success message.
  const [deleteTarget, setDeleteTarget] = useState<ProgramPosterMedia | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBlockedBy, setDeleteBlockedBy] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const media = await getProgramPosterMediaAction();
      setItems(media);
      setLoadedOnce(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch the library the first time the dialog opens and reset search on
  // every open.
  useEffect(() => {
    if (!open) return;
    if (!loadedOnce) void loadMedia();
    setQuery("");
    setVisible(PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentName]);

  // Once items arrive, mark the currently referenced image as picked.
  useEffect(() => {
    if (!open || !currentName) return;
    if (items.some((item) => item.name === currentName)) {
      setPickedName(currentName);
    }
  }, [items, open, currentName]);

  // Closing the picker discards any pending delete confirmation.
  useEffect(() => {
    if (open) return;
    setDeleteTarget(null);
    setDeleteError(null);
    setDeleteBlockedBy(null);
  }, [open]);

  // The success notice fades out on its own.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const requestDelete = useCallback((item: ProgramPosterMedia) => {
    setDeleteTarget(item);
    setDeleteError(null);
    setDeleteBlockedBy(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteProgramPosterAction(deleteTarget.name);
      if (result.ok) {
        // Remove the card immediately, keep search text + scroll, and clear the
        // selection only if the deleted image was the one picked.
        setItems((current) =>
          current.filter((item) => item.name !== deleteTarget.name),
        );
        setPickedName((current) => (current === deleteTarget.name ? null : current));
        setNotice("Image deleted successfully.");
        setDeleteTarget(null);
      } else if (result.inUse) {
        // A Program started referencing the image after the library loaded —
        // the fresh server-side check wins over the stale picker data.
        setDeleteBlockedBy(result.usedBy ?? []);
        setDeleteError(result.error);
      } else {
        setDeleteError(result.error);
      }
    } catch {
      setDeleteError("Unable to delete this image. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, deleting]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      if (item.name.toLowerCase().includes(term)) return true;
      return item.usedBy.some((title) => title.toLowerCase().includes(term));
    });
  }, [items, query]);

  const visibleItems = filtered.slice(0, visible);
  const picked = pickedName ? items.find((item) => item.name === pickedName) ?? null : null;

  // The confirmation dialog shows usage from the latest data available: the
  // server's fresh check at confirm time (if any) beats the picker snapshot.
  const deleteUsedBy = deleteBlockedBy ?? deleteTarget?.usedBy ?? [];
  const deleteInUse =
    deleteTarget !== null && (deleteBlockedBy !== null || deleteTarget.usedBy.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose program poster</DialogTitle>
          <DialogDescription>
            Reuse an image already stored in the media library — no new upload is
            created.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div
            role="status"
            aria-label="Loading posters"
            className="grid grid-cols-2 gap-3 py-8 sm:grid-cols-3 md:grid-cols-4"
          >
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-xl border border-border/60 bg-muted/40"
              >
                <div className="aspect-[4/5] w-full animate-pulse bg-muted" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted p-2" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Could not load the media library. Please try again.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void loadMedia()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search posters…"
                aria-label="Search posters"
                className="pl-8"
              />
            </div>

            {notice ? (
              <p
                role="status"
                className="rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-xs font-medium text-success"
              >
                {notice}
              </p>
            ) : null}

            {filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                No posters found
                {query.trim() ? ` for “${query.trim()}”` : ""}. Upload a poster
                first and it will appear here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visibleItems.map((item) => {
                  const selected = item.name === pickedName;
                  return (
                    <div key={item.name} className="group relative">
                      <button
                        type="button"
                        onClick={() => setPickedName(item.name)}
                        aria-pressed={selected}
                        aria-label={`Select poster ${item.name}`}
                        className={cn(
                          "w-full overflow-hidden rounded-xl border bg-card text-left outline-none transition-all",
                          "focus-visible:ring-3 focus-visible:ring-ring/50",
                          selected
                            ? "border-ring ring-2 ring-ring/60"
                            : "border-border/60 hover:border-foreground/30",
                        )}
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
                          <Image
                            src={item.url}
                            alt={item.name}
                            fill
                            sizes="(min-width: 768px) 200px, 45vw"
                            loading="lazy"
                            decoding="async"
                            className="object-cover"
                          />
                          {selected ? (
                            <span className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                              <CheckIcon className="size-4" />
                            </span>
                          ) : null}
                        </div>
                        <div className="space-y-0.5 p-2">
                          <p
                            className="truncate text-xs font-medium text-foreground"
                            title={item.name}
                          >
                            {item.name}
                          </p>
                          {item.usedBy.length > 0 ? (
                            <p
                              className="truncate text-[11px] text-muted-foreground"
                              title={`Used by ${item.usedBy.join(", ")}`}
                            >
                              Used by {item.usedBy.length}{" "}
                              {item.usedBy.length === 1 ? "program" : "programs"}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Delete image"
                        aria-label={`Delete poster ${item.name}`}
                        onClick={() => requestDelete(item)}
                        className="absolute top-2 right-2 z-10 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-background hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {visible < filtered.length ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
              >
                Load more posters
              </Button>
            ) : null}
          </>
        )}

        {!loading && !loadError && loadedOnce && items.length === 0 ? (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ImagesIcon className="size-3.5" aria-hidden="true" />
            The library is empty — upload a poster first.
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (picked) onSelect(picked);
              onOpenChange(false);
            }}
          >
            Use Selected Image
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Delete confirmation. Never deletes without an explicit destructive
          confirm, and the server re-checks references at delete time. */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
            setDeleteBlockedBy(null);
          }
        }}
      >
        <AlertDialogContent>
          {deleteTarget ? (
            deleteInUse ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Image in use</AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleteTarget.name} is currently used by{" "}
                    {deleteUsedBy.length}{" "}
                    {deleteUsedBy.length === 1 ? "Program" : "Programs"} and
                    cannot be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteUsedBy.length > 0 ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {deleteUsedBy.map((title) => (
                      <li key={title} className="flex gap-1.5">
                        <span aria-hidden="true">•</span>
                        <span className="truncate" title={title}>
                          {title}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  Remove or replace those Program poster references before
                  deleting this image.
                </p>
                <AlertDialogFooter>
                  <AlertDialogCancel>Close</AlertDialogCancel>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete image?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You&apos;re about to permanently delete:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <p
                  className="truncate rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground"
                  title={deleteTarget.name}
                >
                  {deleteTarget.name}
                </p>
                <AlertDialogDescription>
                  This image is not currently used by any Program. This action
                  cannot be undone.
                </AlertDialogDescription>
                {deleteError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    {deleteError}
                  </p>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                  >
                    {deleting ? (
                      <Loader2Icon
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {deleting ? "Deleting…" : "Delete Image"}
                  </Button>
                </AlertDialogFooter>
              </>
            )
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
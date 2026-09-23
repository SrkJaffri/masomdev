"use client";

import { ImagePlusIcon, ImagesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AdminThumb } from "@/components/admin/admin-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProgramPosterMedia } from "@/features/programs/types";
import { cn } from "@/lib/utils";

import { MediaLibraryDialog } from "./media-library-dialog";

type PosterTab = "keep" | "upload" | "library";

/**
 * Poster section of the Program dialog. The form submits exactly one of:
 *   - no field                  -> create: no poster / edit: keep current
 *   - `poster` file input       -> brand-new upload
 *   - hidden `poster_ref` value -> reuse an existing storage image (no upload)
 *
 * Modes are mutually exclusive in the DOM, so a stale file or hidden ref can
 * never be submitted together.
 *
 * The SELECTED file/library image is owned by the parent form (lifted state)
 * so a failed submission — which re-renders but does not unmount this field —
 * keeps both the selection and its preview intact. Tab state stays local; the
 * whole field remounts (via the dialog key) when the dialog reopens.
 */
export function ProgramPosterField({
  isEdit,
  hasCurrentPoster,
  currentPosterUrl,
  currentPosterAlt,
  file,
  onFileChange,
  libraryItem,
  onLibraryItemChange,
}: {
  isEdit: boolean;
  hasCurrentPoster: boolean;
  currentPosterUrl: string | null;
  currentPosterAlt: string;
  /** The picked upload file (lifted so errors don't lose it). */
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** The picked media-library image (lifted so errors don't lose it). */
  libraryItem: ProgramPosterMedia | null;
  onLibraryItemChange: (item: ProgramPosterMedia | null) => void;
}) {
  // Default: create -> upload; edit with a poster -> keep current.
  const [tab, setTab] = useState<PosterTab>(
    isEdit && hasCurrentPoster ? "keep" : "upload",
  );
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Mirror the lifted file into an object URL for the live preview, freeing
  // the previous URL whenever the file changes or the field unmounts.
  useEffect(() => {
    if (!file) {
      setUploadPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function switchTab(next: PosterTab) {
    if (next === tab) return;
    // Changing modes clears the other selection so only one is ever submitted.
    if (next !== "library" && libraryItem) onLibraryItemChange(null);
    if (next !== "upload") {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      if (file) onFileChange(null);
    }
    setTab(next);
  }

  const tabs: { id: PosterTab; label: string }[] =
    isEdit && hasCurrentPoster
      ? [
          { id: "keep", label: "Keep current" },
          { id: "upload", label: "Replace by upload" },
          { id: "library", label: "Choose from media library" },
        ]
      : [
          { id: "upload", label: "Upload new" },
          { id: "library", label: "Choose from media library" },
        ];

  // A replacement is pending only when the admin actually picked something.
  const replacing = Boolean(uploadPreview || libraryItem);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Poster</Label>
        {isEdit && hasCurrentPoster && tab !== "keep" && !replacing ? (
          <span className="text-xs text-muted-foreground">
            Leave empty to keep current
          </span>
        ) : null}
        {isEdit && hasCurrentPoster && replacing ? (
          <span className="text-xs text-muted-foreground">
            Current poster will be replaced on save
          </span>
        ) : null}
      </div>

      {/* Segmented mode switcher */}
      <div
        className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted/60 p-1"
        role="group"
        aria-label="Poster source"
      >
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            aria-pressed={tab === id}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
              tab === id
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {id === "upload" ? <ImagePlusIcon className="size-3.5" /> : null}
            {id === "library" ? <ImagesIcon className="size-3.5" /> : null}
            {label}
          </button>
        ))}
      </div>

      {/* Keep current: show the existing poster so the admin knows what stays */}
      {tab === "keep" ? (
        <div className="flex items-center gap-3">
          {currentPosterUrl ? (
            <>
              <AdminThumb
                src={currentPosterUrl}
                alt={currentPosterAlt}
                external={!/\.supabase\.co/.test(currentPosterUrl)}
                className="h-24 w-20"
              />
              <p className="text-xs text-muted-foreground">
                The current poster will be kept on save.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              No poster is set — it will stay empty on save.
            </p>
          )}
        </div>
      ) : null}

      {/* Upload new: the original file input (name="poster") */}
      {tab === "upload" ? (
        <div className="space-y-2">
          <Input
            ref={uploadInputRef}
            id="poster"
            name="poster"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          {uploadPreview ? (
            <AdminThumb
              src={uploadPreview}
              alt="New poster preview"
              external
              className="h-24 w-20"
            />
          ) : null}
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 5 MB.</p>
        </div>
      ) : null}

      {/* Media library: reuse an existing image (no duplicate upload) */}
      {tab === "library" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {libraryItem ? (
              <AdminThumb
                src={libraryItem.url}
                alt={libraryItem.name}
                external={!/\.supabase\.co/.test(libraryItem.url)}
                className="h-24 w-20"
              />
            ) : null}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {libraryItem
                  ? `Reusing ${libraryItem.name} — no new upload will be created.`
                  : "Pick an image that is already stored in the media library."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLibraryOpen(true)}
              >
                {libraryItem ? "Change image…" : "Open media library…"}
              </Button>
            </div>
          </div>

          {/* Only submitted once an image is picked */}
          {libraryItem ? (
            <input type="hidden" name="poster_ref" value={libraryItem.name} />
          ) : null}
        </div>
      ) : null}

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={(open) => {
          setLibraryOpen(open);
          if (!open && libraryItem) setTab("library");
        }}
        currentName={libraryItem?.name ?? null}
        onSelect={(item) => {
          onLibraryItemChange(item);
          setTab("library");
        }}
      />
    </div>
  );
}

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
import { createBanner, deleteBanner, updateBanner } from "@/features/banners/actions";
import type { BannerAdminItem, BannerImageSource } from "@/features/banners/types";
import { HERO_DEFAULTS } from "@/features/home/data/hero-slides";
import { idleResult, isValidExternalImageUrl } from "@/lib/cms/validation";
import { cn } from "@/lib/utils";

type DialogState = { mode: "create" } | { mode: "edit"; banner: BannerAdminItem } | null;

type BannerAction = typeof createBanner;

function SourcePicker({
  value,
  onChange,
}: {
  value: BannerImageSource;
  onChange: (source: BannerImageSource) => void;
}) {
  const option = (source: BannerImageSource, label: string) => (
    <button
      type="button"
      aria-pressed={value === source}
      onClick={() => onChange(source)}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        value === source
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Banner image source"
      className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {option("storage", "Upload image")}
      {option("external", "External image URL")}
    </div>
  );
}

function BannerForm({
  isEdit,
  banner,
  action,
  onClose,
}: {
  isEdit: boolean;
  banner: BannerAdminItem | null;
  action: BannerAction;
  onClose: () => void;
}) {
  const [result, formAction] = useActionState(action, idleResult);
  const [source, setSource] = useState<BannerImageSource>(
    banner?.image_source ?? "storage",
  );
  const [externalUrl, setExternalUrl] = useState(
    banner?.image_source === "external" ? (banner.external_url ?? "") : "",
  );
  const [externalBroken, setExternalBroken] = useState(false);
  // CTA state keeps label/url values alive even while a button is hidden,
  // so toggling visibility never erases the stored configuration. New banners
  // start from the approved hero defaults (consistent with the pre-CMS hero).
  const [showPrimaryCta, setShowPrimaryCta] = useState(banner?.show_primary_cta ?? true);
  const [primaryLabel, setPrimaryLabel] = useState(
    banner ? (banner.primary_cta_label ?? "") : HERO_DEFAULTS.primaryCta.label,
  );
  const [primaryUrl, setPrimaryUrl] = useState(
    banner ? (banner.primary_cta_url ?? "") : HERO_DEFAULTS.primaryCta.href,
  );
  const [showSecondaryCta, setShowSecondaryCta] = useState(
    banner?.show_secondary_cta ?? true,
  );
  const [secondaryLabel, setSecondaryLabel] = useState(
    banner ? (banner.secondary_cta_label ?? "") : HERO_DEFAULTS.secondaryCta.label,
  );
  const [secondaryUrl, setSecondaryUrl] = useState(
    banner ? (banner.secondary_cta_url ?? "") : HERO_DEFAULTS.secondaryCta.href,
  );

  useEffect(() => {
    if (result.status === "success") onClose();
  }, [result, onClose]);

  const externalValid =
    externalUrl.trim() === "" || isValidExternalImageUrl(externalUrl.trim());

  return (
    <form action={formAction} className="space-y-4">
      {isEdit ? <input type="hidden" name="id" value={banner!.id} /> : null}
      <input type="hidden" name="image_source" value={source} />

      <div className="space-y-2">
        <Label htmlFor={source === "storage" ? "image" : "external_url"}>
          Banner image {isEdit ? "(leave empty to keep current)" : ""}
        </Label>

        <SourcePicker value={source} onChange={setSource} />

        {source === "storage" ? (
          <>
            {isEdit && banner?.previewUrl ? (
              <AdminThumb
                src={banner.previewUrl}
                alt={banner.image_alt}
                className="h-20 w-32"
              />
            ) : null}
            <Input
              id="image"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              required={!isEdit}
            />
            <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 5 MB.</p>
          </>
        ) : (
          <>
            {externalUrl.trim() !== "" ? (
              externalBroken ? (
                <div className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/50 px-2 text-center text-xs text-muted-foreground">
                  Image could not be loaded
                </div>
              ) : (
                // Plain img: preview only, loaded directly from the approved CDN.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={externalUrl}
                  alt=""
                  onError={() => setExternalBroken(true)}
                  className="h-20 w-32 rounded-md border border-border/60 bg-muted object-cover"
                />
              )
            ) : null}
            <Input
              id="external_url"
              name="external_url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={externalUrl}
              onChange={(event) => {
                setExternalUrl(event.target.value);
                setExternalBroken(false);
              }}
              aria-invalid={!externalValid}
              aria-describedby="external_url_hint"
            />
            <p
              id="external_url_hint"
              className={cn(
                "text-xs",
                externalValid ? "text-muted-foreground" : "font-medium text-destructive",
              )}
            >
              {externalValid
                ? "Any valid HTTPS image URL is allowed."
                : "Enter a valid HTTPS image URL."}
            </p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="eyebrow">Eyebrow (optional)</Label>
        <Input
          id="eyebrow"
          name="eyebrow"
          defaultValue={banner ? (banner.eyebrow ?? "") : HERO_DEFAULTS.eyebrow}
          placeholder="MASOM · Chicago, Illinois"
        />
        <p className="text-xs text-muted-foreground">
          Small text displayed above the hero heading.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title (optional)</Label>
        <Input id="title" name="title" defaultValue={banner?.title ?? ""} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <Switch
            id="show_title"
            name="show_title"
            defaultChecked={banner ? banner.show_title : true}
          />
          <Label htmlFor="show_title">Show Heading</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Display the banner heading over the image. The stored title is never erased.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Hero Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={banner?.description ?? ""}
          placeholder="Visible supporting text displayed over the hero banner."
        />
        <p className="text-xs text-muted-foreground">
          Visible supporting text displayed over the hero banner.
        </p>
      </div>

      {/* Primary CTA */}
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <Switch
            id="show_primary_cta"
            name="show_primary_cta"
            checked={showPrimaryCta}
            onCheckedChange={setShowPrimaryCta}
          />
          <Label htmlFor="show_primary_cta">Show Primary Button</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary_cta_label">Button Label</Label>
            <Input
              id="primary_cta_label"
              name="primary_cta_label"
              value={primaryLabel}
              onChange={(event) => setPrimaryLabel(event.target.value)}
              placeholder="View Programs"
              maxLength={80}
              disabled={!showPrimaryCta}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary_cta_url">Button URL</Label>
            <Input
              id="primary_cta_url"
              name="primary_cta_url"
              value={primaryUrl}
              onChange={(event) => setPrimaryUrl(event.target.value)}
              placeholder="/events-schedule"
              inputMode="url"
              disabled={!showPrimaryCta}
            />
          </div>
        </div>
        {!showPrimaryCta ? (
          <input type="hidden" name="primary_cta_label" value={primaryLabel} />
        ) : null}
        {!showPrimaryCta ? (
          <input type="hidden" name="primary_cta_url" value={primaryUrl} />
        ) : null}
      </div>

      {/* Secondary CTA */}
      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <Switch
            id="show_secondary_cta"
            name="show_secondary_cta"
            checked={showSecondaryCta}
            onCheckedChange={setShowSecondaryCta}
          />
          <Label htmlFor="show_secondary_cta">Show Secondary Button</Label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="secondary_cta_label">Button Label</Label>
            <Input
              id="secondary_cta_label"
              name="secondary_cta_label"
              value={secondaryLabel}
              onChange={(event) => setSecondaryLabel(event.target.value)}
              placeholder="Prayer Calendar"
              maxLength={80}
              disabled={!showSecondaryCta}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondary_cta_url">Button URL</Label>
            <Input
              id="secondary_cta_url"
              name="secondary_cta_url"
              value={secondaryUrl}
              onChange={(event) => setSecondaryUrl(event.target.value)}
              placeholder="/hijricalendar2026"
              inputMode="url"
              disabled={!showSecondaryCta}
            />
          </div>
        </div>
        {!showSecondaryCta ? (
          <input type="hidden" name="secondary_cta_label" value={secondaryLabel} />
        ) : null}
        {!showSecondaryCta ? (
          <input type="hidden" name="secondary_cta_url" value={secondaryUrl} />
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="link_url">Link URL (optional)</Label>
        <Input
          id="link_url"
          name="link_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={banner?.link_url ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sort_order">Sort order</Label>
        <Input
          id="sort_order"
          name="sort_order"
          type="number"
          min={0}
          defaultValue={banner?.sort_order ?? 0}
          className="w-28"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is_active"
          name="is_active"
          defaultChecked={banner ? banner.is_active : true}
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
          {isEdit ? "Save changes" : "Add banner"}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

function BannerDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const isEdit = state?.mode === "edit";
  const banner = isEdit ? state.banner : null;
  const action = isEdit ? updateBanner : createBanner;

  return (
    <Dialog open={state !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit banner" : "Add banner"}</DialogTitle>
          <DialogDescription>
            Banners appear in the homepage hero slider, ordered by sort order.
          </DialogDescription>
        </DialogHeader>

        <BannerForm
          key={banner?.id ?? "create"}
          isEdit={isEdit}
          banner={banner}
          action={action}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export function BannerManager({ banners }: { banners: BannerAdminItem[] }) {
  // "?create=1" (from the dashboard Create-new dropdown / quick actions) opens
  // the create dialog on mount — the existing form, no duplicated CRUD logic.
  const [dialog, setDialog] = useState<DialogState>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("create")
      ? { mode: "create" }
      : null,
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Banners" description="Hero slider images for the homepage.">
        <Button variant="cta" onClick={() => setDialog({ mode: "create" })}>
          <PlusIcon className="size-4" />
          Add banner
        </Button>
      </AdminPageHeader>

      {banners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No banners yet. The homepage is showing the built-in default banners. Add one
            to take over the hero slider.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Preview</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">Order</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner) => (
                <TableRow key={banner.id}>
                  <TableCell>
                    <AdminThumb
                      src={banner.previewUrl}
                      alt={banner.image_alt}
                      external={banner.image_source === "external"}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">
                      {banner.title || banner.image_alt || "Untitled banner"}
                    </p>
                    {banner.link_url ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {banner.link_url}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {banner.sort_order}
                  </TableCell>
                  <TableCell>
                    <StatusBadge active={banner.is_active} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit banner"
                        onClick={() => setDialog({ mode: "edit", banner })}
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <DeleteConfirm
                        action={deleteBanner}
                        id={banner.id}
                        entityLabel="banner"
                        name={banner.title || banner.image_alt}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BannerDialog state={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

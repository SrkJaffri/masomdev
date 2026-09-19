"use client";

import { SaveIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  useCallback,
  useRef,
  useState,
  useTransition,
} from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  removePopupImage,
  updateSiteSettings,
  uploadPopupImage,
} from "@/features/site-settings/actions";
import { POPUP_PAGE_OPTIONS } from "@/features/site-settings/popup-pages";
import type {
  PopupFrequency,
  SiteSettingsFormValues,
} from "@/features/site-settings/types";
import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";

/** One Homepage Actions subsection: toggle + fields. */
function ActionSection({
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label={`Toggle ${title}`}
          />
        </div>
      </div>
      <div
        className={
          enabled
            ? "mt-5 grid gap-4 opacity-100 transition-opacity"
            : "mt-5 grid gap-4 opacity-50 transition-opacity"
        }
        aria-disabled={!enabled}
      >
        {children}
      </div>
    </section>
  );
}

type SaveUiState = { status: "idle" | "success" | "error"; message: string | null };

const IDLE_SAVE_STATE: SaveUiState = { status: "idle", message: null };

const DELAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Website Popup section: image, delay, target pages, frequency and optional
 * click-through. Image upload/remove are their own server actions so the
 * artwork persists immediately (independent of Save Settings), mirroring how
 * banners/programs manage media.
 */
function PopupSection({
  values,
  set,
  onSyncFromServer,
}: {
  values: SiteSettingsFormValues;
  set: <K extends keyof SiteSettingsFormValues>(
    key: K,
    value: SiteSettingsFormValues[K],
  ) => void;
  onSyncFromServer: (values: SiteSettingsFormValues) => void;
}) {
  const router = useRouter();
  const [imageState, setImageState] = useState<SaveUiState>(IDLE_SAVE_STATE);
  const [isUploading, startUploadTransition] = useTransition();
  const [isRemoving, startRemoveTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pages = values.popup_display_pages;
  const allSelected = pages.length === POPUP_PAGE_OPTIONS.length;

  const togglePage = (path: string, checked: boolean) => {
    const next = checked ? [...pages, path] : pages.filter((p) => p !== path);
    set("popup_display_pages", next);
  };

  const handleUpload = useCallback(
    (file: File) => {
      setImageState(IDLE_SAVE_STATE);
      const formData = new FormData();
      formData.append("image", file);
      startUploadTransition(async () => {
        const result = await uploadPopupImage(formData);
        if (result.status === "success") {
          // Adopt the DB-confirmed state into the form so a subsequent Save
          // Settings persists the same image (never an older local value).
          onSyncFromServer({
            ...values,
            popup_image_url: result.path,
            popup_image_preview: result.previewUrl,
          });
          setImageState({ status: "success", message: result.message });
          router.refresh();
        } else {
          setImageState({ status: "error", message: result.message });
        }
        // Allow selecting the same file again after a reset.
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
    },
    [values, onSyncFromServer, router],
  );

  const handleRemove = useCallback(() => {
    setImageState(IDLE_SAVE_STATE);
    startRemoveTransition(async () => {
      const result = await removePopupImage();
      if (result.status === "success") {
        onSyncFromServer({
          ...values,
          popup_image_url: "",
          popup_image_preview: null,
        });
        setImageState({ status: "success", message: result.message });
        router.refresh();
      } else {
        setImageState({ status: "error", message: result.message });
      }
    });
  }, [values, onSyncFromServer, router]);

  return (
    <section aria-labelledby="website-popup-heading" className="space-y-4">
      <div>
        <h2 id="website-popup-heading" className="text-lg font-bold text-foreground">
          Website Popup
        </h2>
        <p className="text-sm text-muted-foreground">
          Promotional image popup shown automatically on selected public pages.
        </p>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Enable Website Popup</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Master toggle — nothing renders on the public site while disabled.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              {values.popup_enabled ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={values.popup_enabled}
              onCheckedChange={(value) => set("popup_enabled", value)}
              aria-label="Toggle website popup"
            />
          </div>
        </div>
      </section>

      <section
        className={cn(
          "rounded-2xl border border-border/60 bg-card p-6",
          !values.popup_enabled && "opacity-50 transition-opacity",
        )}
      >
        <div
          className={cn("grid gap-6", !values.popup_enabled && "pointer-events-none")}
          aria-disabled={!values.popup_enabled}
        >
          {/* Image */}
          <div className="space-y-2">
            <Label>Popup Image</Label>
            {values.popup_image_preview ? (
              <div className="relative w-fit">
                <div className="relative size-40 overflow-hidden rounded-xl border border-border bg-muted">
                  <Image
                    src={values.popup_image_preview}
                    alt="Popup image preview"
                    fill
                    sizes="160px"
                    className="object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex size-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 text-center">
                <p className="px-3 text-xs text-muted-foreground">No image configured</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="popup-image"
                name="popup-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Upload popup image"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isUploading || isRemoving}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-4" aria-hidden="true" />
                    {values.popup_image_preview ? "Replace Image" : "Upload Image"}
                  </>
                )}
              </Button>
              {values.popup_image_preview ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isUploading || isRemoving}
                  onClick={handleRemove}
                >
                  {isRemoving ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                      Removing…
                    </>
                  ) : (
                    <>
                      <Trash2Icon className="size-4" aria-hidden="true" />
                      Remove Image
                    </>
                  )}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG or WebP · up to 5 MB. Recommended: 1:1 square artwork,
              650 × 650 px — the artwork contains its own message, so no extra
              text is added around it.
            </p>
            {imageState.status === "success" && imageState.message ? (
              <p role="status" className="text-sm font-medium text-brand-700 dark:text-brand-300">
                {imageState.message}
              </p>
            ) : null}
            {imageState.status === "error" && imageState.message ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {imageState.message}
              </p>
            ) : null}
          </div>

          {/* Delay */}
          <div className="space-y-2">
            <Label htmlFor="popup-delay">Display Delay</Label>
            <select
              id="popup-delay"
              value={values.popup_delay_seconds}
              onChange={(event) =>
                set("popup_delay_seconds", Number(event.target.value))
              }
              disabled={!values.popup_enabled}
              className="w-48 cursor-pointer appearance-none rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-card transition-colors hover:border-brand-400 focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {DELAY_OPTIONS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} second{seconds === 1 ? "" : "s"} after page load
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              How long to wait after the page loads before the popup opens.
            </p>
          </div>

          {/* Pages */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Display Pages</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {POPUP_PAGE_OPTIONS.map((option) => {
                const checked = pages.includes(option.path);
                return (
                  <label
                    key={option.path}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm transition-colors hover:border-brand-400"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => togglePage(option.path, event.target.checked)}
                      className="size-4 accent-brand-500"
                    />
                    <span className="font-medium text-foreground">{option.label}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("popup_display_pages", POPUP_PAGE_OPTIONS.map((o) => o.path))}
                disabled={allSelected}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("popup_display_pages", [])}
                disabled={pages.length === 0}
              >
                Clear All
              </Button>
              <span className="text-xs text-muted-foreground">
                {pages.length} of {POPUP_PAGE_OPTIONS.length} pages selected
              </span>
            </div>
          </fieldset>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="popup-frequency">Display Frequency</Label>
            <select
              id="popup-frequency"
              value={values.popup_frequency}
              onChange={(event) =>
                set("popup_frequency", event.target.value as PopupFrequency)
              }
              disabled={!values.popup_enabled}
              className="w-72 cursor-pointer appearance-none rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-card transition-colors hover:border-brand-400 focus:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <option value="session">Once per browser session</option>
              <option value="always">Every page load</option>
            </select>
            <p className="text-xs text-muted-foreground">
              “Once per session” remembers the visitor in this browser tab session only —
              updating the popup config or image makes it eligible again.
            </p>
          </div>

          {/* Click-through */}
          <div className="space-y-2">
            <Label htmlFor="popup-link">Click-through URL (optional)</Label>
            <Input
              id="popup-link"
              value={values.popup_link_url}
              onChange={(event) => set("popup_link_url", event.target.value)}
              placeholder="/donate or https://…"
              inputMode="url"
              disabled={!values.popup_enabled}
            />
            <p className="text-xs text-muted-foreground">
              Internal route (e.g. /donate) or approved https:// URL. Leave blank
              for a non-clickable image.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

export function SiteSettingsManager({ settings }: { settings: SiteSettingsFormValues }) {
  const router = useRouter();

  // Single source of truth for every control (Switches are fully controlled).
  // Seeded from server props on first mount; afterwards it only changes
  // through user edits or an authoritative server sync (never a blind reset).
  const [values, setValues] = useState<SiteSettingsFormValues>(settings);

  // updated_at of the newest server state this form has seen. Server props
  // are adopted ONLY when strictly newer, so a router.refresh() transition
  // can never momentarily overwrite the saved state with stale pre-save props.
  const latestServerVersionRef = useRef(settings.updated_at);

  const [saveState, setSaveState] = useState<SaveUiState>(IDLE_SAVE_STATE);
  const [isPending, startSaveTransition] = useTransition();

  const set = useCallback(
    <K extends keyof SiteSettingsFormValues>(key: K, value: SiteSettingsFormValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // Popup image upload/remove actions persist immediately; this folds their
  // DB-confirmed values into the form so a subsequent Save Settings submits
  // the same state (never a stale local value).
  const syncPopupFromServer = useCallback(
    (serverValues: SiteSettingsFormValues) => {
      latestServerVersionRef.current = serverValues.updated_at;
      setValues((prev) => ({ ...prev, ...serverValues }));
    },
    [],
  );

  // Adopt genuinely newer server settings (e.g. edited elsewhere / future
  // cross-surface changes). Same-or-older versions are ignored — notably the
  // stale pre-save props that arrive during the refresh transition.
  if (settings.updated_at > latestServerVersionRef.current) {
    latestServerVersionRef.current = settings.updated_at;
    setValues(settings);
  }

  const handleSave = useCallback(() => {
    if (isPending) return; // No double save / double-click race.

    // Exact local state at click time — the controlled form IS the payload.
    const snapshot = values;
    setSaveState(IDLE_SAVE_STATE);

    startSaveTransition(async () => {
      const result = await updateSiteSettings(snapshot);

      if (result.status === "success") {
        // DB-confirmed state: update the form to the persisted row FIRST.
        latestServerVersionRef.current = result.settings.updated_at;
        setValues(result.settings);
        setSaveState({ status: "success", message: result.message });
        // Then refresh other server-rendered surfaces (sidebar counts,
        // activity). When fresh props arrive, the version guard dedupes them.
        router.refresh();
      } else if (result.status === "error") {
        // Keep the user's unsaved values so they can retry.
        setSaveState({ status: "error", message: result.message });
      }
    });
  }, [isPending, values, router]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Site Settings"
        description="Manage public website actions and contact settings."
      />

      <div className="space-y-6">
        <section aria-labelledby="homepage-actions-heading" className="space-y-4">
          <div>
            <h2 id="homepage-actions-heading" className="text-lg font-bold text-foreground">
              Homepage Actions
            </h2>
            <p className="text-sm text-muted-foreground">
              Control the two action cards under the homepage hero.
            </p>
          </div>

          <ActionSection
            title="Email Announcements"
            description="Links to the MASOM email campaign archive."
            enabled={values.email_announcements_enabled}
            onEnabledChange={(value) => set("email_announcements_enabled", value)}
          >
            <div className="space-y-2">
              <Label htmlFor="email-label">Button Text</Label>
              <Input
                id="email-label"
                name="email_announcements_label"
                value={values.email_announcements_label}
                onChange={(e) => set("email_announcements_label", e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-url">URL</Label>
              <Input
                id="email-url"
                name="email_announcements_url"
                type="url"
                inputMode="url"
                value={values.email_announcements_url}
                onChange={(e) => set("email_announcements_url", e.target.value)}
                placeholder="https://…"
                required
              />
            </div>
          </ActionSection>

          <ActionSection
            title="WhatsApp Events Group"
            description="Invite link for the WhatsApp events group."
            enabled={values.whatsapp_group_enabled}
            onEnabledChange={(value) => set("whatsapp_group_enabled", value)}
          >
            <div className="space-y-2">
              <Label htmlFor="whatsapp-label">Button Text</Label>
              <Input
                id="whatsapp-label"
                name="whatsapp_group_label"
                value={values.whatsapp_group_label}
                onChange={(e) => set("whatsapp_group_label", e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-url">URL</Label>
              <Input
                id="whatsapp-url"
                name="whatsapp_group_url"
                type="url"
                inputMode="url"
                value={values.whatsapp_group_url}
                onChange={(e) => set("whatsapp_group_url", e.target.value)}
                placeholder="https://…"
                required
              />
            </div>
          </ActionSection>

          <ActionSection
            title="Floating WhatsApp Button"
            description="Direct-contact WhatsApp button shown on public pages."
            enabled={values.floating_whatsapp_enabled}
            onEnabledChange={(value) => set("floating_whatsapp_enabled", value)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wa-phone">Phone Number</Label>
                <Input
                  id="wa-phone"
                  name="floating_whatsapp_phone"
                  type="tel"
                  value={values.floating_whatsapp_phone}
                  onChange={(e) => set("floating_whatsapp_phone", e.target.value)}
                  placeholder="+1 773 283 9718"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Formatting (spaces, +, dashes) is fine — it is normalized for wa.me.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-label">Hover Label</Label>
                <Input
                  id="wa-label"
                  name="floating_whatsapp_label"
                  value={values.floating_whatsapp_label}
                  onChange={(e) => set("floating_whatsapp_label", e.target.value)}
                  maxLength={60}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-message">Default Message</Label>
              <Textarea
                id="wa-message"
                name="floating_whatsapp_message"
                rows={3}
                value={values.floating_whatsapp_message}
                onChange={(e) => set("floating_whatsapp_message", e.target.value)}
                maxLength={300}
                required
              />
              <p className="text-xs text-muted-foreground">
                Pre-filled when someone opens the WhatsApp chat.
              </p>
            </div>
          </ActionSection>
        </section>

        <section aria-labelledby="ai-assistant-heading" className="space-y-4">
          <div>
            <h2 id="ai-assistant-heading" className="text-lg font-bold text-foreground">
              AI Support Agent
            </h2>
            <p className="text-sm text-muted-foreground">
              Controls the MASOM Assistant chat widget on public pages. Only the wording
              is managed here — the AI provider key stays a server environment variable
              and is never stored in the CMS.
            </p>
          </div>

          <ActionSection
            title="MASOM Assistant"
            description="Floating chat assistant shown on public pages."
            enabled={values.ai_assistant_enabled}
            onEnabledChange={(value) => set("ai_assistant_enabled", value)}
          >
            <div className="space-y-2">
              <Label htmlFor="ai-name">Assistant Name</Label>
              <Input
                id="ai-name"
                name="ai_assistant_name"
                value={values.ai_assistant_name}
                onChange={(e) => set("ai_assistant_name", e.target.value)}
                maxLength={60}
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown on the chat button and in the chat header.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-welcome">Welcome Message</Label>
              <Textarea
                id="ai-welcome"
                name="ai_assistant_welcome_message"
                rows={3}
                value={values.ai_assistant_welcome_message}
                onChange={(e) => set("ai_assistant_welcome_message", e.target.value)}
                maxLength={500}
                required
              />
              <p className="text-xs text-muted-foreground">
                The first message a visitor sees when the chat opens.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-fallback">Fallback Contact Message</Label>
              <Textarea
                id="ai-fallback"
                name="ai_assistant_fallback_message"
                rows={3}
                value={values.ai_assistant_fallback_message}
                onChange={(e) => set("ai_assistant_fallback_message", e.target.value)}
                maxLength={500}
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown when the assistant cannot answer — point visitors to Contact or
                WhatsApp.
              </p>
            </div>
          </ActionSection>
        </section>

        <PopupSection
          values={values}
          set={set}
          onSyncFromServer={syncPopupFromServer}
        />

        <div className="flex items-center gap-4">
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <SaveIcon className="size-4" aria-hidden="true" />
                Save Settings
              </>
            )}
          </Button>

          {saveState.status === "success" && saveState.message ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm font-medium text-brand-700 dark:text-brand-300"
            >
              {saveState.message}
            </p>
          ) : null}
          {saveState.status === "error" && saveState.message ? (
            <p role="alert" aria-live="assertive" className="text-sm font-medium text-destructive">
              {saveState.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

"use client";

import { SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateSiteSettings } from "@/features/site-settings/actions";
import type { SiteSettingsFormValues } from "@/features/site-settings/types";
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

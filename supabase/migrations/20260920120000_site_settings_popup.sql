-- Site Settings → Website Popup (CMS-controlled promotional modal).
--
-- The popup artwork, delay, target pages, display frequency and optional
-- click-through link are all managed from Admin → Site Settings. This
-- migration only extends the EXISTING site_settings singleton row ('main'),
-- reusing its updated_at trigger and RLS policies — no new table, no new
-- policy. Idempotent.
--
-- SECURITY: this row is publicly readable (site_settings_public_read), so it
-- must only ever hold public presentation values. The image is stored as a
-- storage object path in the dedicated 'popup' bucket (public read,
-- admin-only write, added in 20260920121000_popup_storage.sql) or as an
-- approved absolute https URL.

alter table public.site_settings
  add column if not exists popup_enabled boolean not null default false;

-- Storage object path ("uuid.webp"), absolute https URL, or a "/public"
-- asset path. Seeded with the approved MASOM 650×650 popup artwork that ships
-- in /public so the admin only has to flip the toggle; uploading a new
-- artwork through the CMS replaces this value. The popup still never renders
-- until popup_enabled is turned on AND an image exists.
alter table public.site_settings
  add column if not exists popup_image_url text not null default '/popup.webp';

-- Seconds after page load before the popup opens. Guard-railed to 1–10.
alter table public.site_settings
  add column if not exists popup_delay_seconds integer not null default 3;

-- Public route paths (e.g. '/', '/hijricalendar2026') where the popup may
-- appear. Route paths are stored, never display labels; the admin UI maps
-- labels ↔ paths. Empty array = no eligible page (popup effectively hidden).
alter table public.site_settings
  add column if not exists popup_display_pages text[] not null default array['/']::text[];

-- 'session'  → at most once per browser session (sessionStorage, versioned
--              by settings updated_at so new artwork can show again),
-- 'always'   → on every fresh configured page load.
alter table public.site_settings
  add column if not exists popup_frequency text not null default 'session';

-- Optional click-through: an internal route ("/donate") or an approved
-- https URL. Empty string = the artwork is not clickable. javascript:/data:
-- and other unsafe schemes are rejected by the app-layer validation AND by
-- the constraint below.
alter table public.site_settings
  add column if not exists popup_link_url text not null default '';

-- ===========================================================================
-- GUARD RAILS — a CMS value can never break the approved popup behavior.
-- ===========================================================================
alter table public.site_settings
  drop constraint if exists site_settings_popup_delay_range;
alter table public.site_settings
  add constraint site_settings_popup_delay_range
  check (popup_delay_seconds between 1 and 10);

alter table public.site_settings
  drop constraint if exists site_settings_popup_frequency_allowed;
alter table public.site_settings
  add constraint site_settings_popup_frequency_allowed
  check (popup_frequency in ('session', 'always'));

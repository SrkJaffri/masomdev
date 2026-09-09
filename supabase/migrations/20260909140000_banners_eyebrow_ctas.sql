-- Per-banner hero eyebrow and CTA button controls ("Eyebrow", "Primary/Secondary
-- button" groups in the banner form). All additive; nothing existing is reset.
--
-- Backfill: existing rows receive the exact current approved hero values so the
-- live homepage is pixel-identical after this migration. The eyebrow text
-- matches the JSX source (CSS applies the uppercase styling).
alter table public.banners
  add column if not exists eyebrow text,
  add column if not exists primary_cta_label text,
  add column if not exists primary_cta_url text,
  add column if not exists show_primary_cta boolean not null default true,
  add column if not exists secondary_cta_label text,
  add column if not exists secondary_cta_url text,
  add column if not exists show_secondary_cta boolean not null default true;

update public.banners set eyebrow = 'MASOM · Chicago, Illinois'
where eyebrow is null;

update public.banners set primary_cta_label = 'View Programs'
where primary_cta_label is null;

update public.banners set primary_cta_url = '/events-schedule'
where primary_cta_url is null;

update public.banners set secondary_cta_label = 'Prayer Calendar'
where secondary_cta_label is null;

update public.banners set secondary_cta_url = '/hijricalendar2026'
where secondary_cta_url is null;
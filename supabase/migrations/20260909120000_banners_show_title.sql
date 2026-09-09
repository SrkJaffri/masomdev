-- Per-banner hero heading visibility ("Show Heading" in the banner form).
-- Existing banners keep showing their heading by default.
alter table public.banners
  add column if not exists show_title boolean not null default true;
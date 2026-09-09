-- Per-banner visible hero description ("Hero Description" in the banner form).
-- This is display copy for the hero overlay and is intentionally separate from
-- image_alt, which stays accessibility/alt-only and is never rendered as text.
--
-- Backfill: existing rows receive the current approved default hero copy so
-- the live homepage is pixel-identical after this migration. Rows created
-- afterwards start with NULL (empty) — an intentionally empty description
-- renders no paragraph in the hero.
alter table public.banners
  add column if not exists description text;

update public.banners
set description = 'An Imambargah in Chicago serving the Shia community with majalis, Islamic education, programs and services.'
where description is null;
-- Site settings: a single typed row ('main') holding CMS-controlled public
-- website actions (homepage action cards + floating WhatsApp button).
--
-- The row is backfilled with the CURRENT APPROVED frontend values so deploy
-- changes nothing visually. Public (anon) gets SELECT only — these settings
-- are public website configuration with no secrets. Writes are admin-only
-- via public.is_admin(). updated_at reuses the shared set_updated_at trigger.
-- Idempotent throughout.

-- ===========================================================================
-- TABLE
-- ===========================================================================
create table if not exists public.site_settings (
  id text primary key default 'main'
    constraint site_settings_id_check check (id = 'main'),

  -- Homepage action card 1: Email Announcements
  email_announcements_enabled boolean not null default true,
  email_announcements_label   text not null default 'Email Announcements',
  email_announcements_url     text not null
    default 'https://us13.campaign-archive.com/home/?u=01dfc250f2762204df48c0230&id=06a230bfd1',

  -- Homepage action card 2: WhatsApp Events Group
  whatsapp_group_enabled boolean not null default true,
  whatsapp_group_label   text not null default 'Join Our Whats App Events Group',
  whatsapp_group_url     text not null default 'https://chat.whatsapp.com/LbReeM8ts7VJoC7yMOPqSI',

  -- Floating WhatsApp direct-contact button (public layout)
  floating_whatsapp_enabled boolean not null default true,
  floating_whatsapp_phone   text not null default '+1 773 283 9718',
  floating_whatsapp_message text not null default
    'Assalam-o-Alaikum, I’m reaching out to MASOM through the website. I would like to ask about your programs and services. Thank you.',
  floating_whatsapp_label   text not null default 'Chat with MASOM',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- BACKFILL — guarantee the singleton row exists with current approved values.
-- on conflict do nothing: never overwrite live settings on re-apply.
-- ===========================================================================
insert into public.site_settings (id) values ('main') on conflict (id) do nothing;

-- ===========================================================================
-- UPDATED_AT — reuse the shared trigger.
-- ===========================================================================
drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS — public read, admin write.
-- ===========================================================================
alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policies: the singleton row is created by migration only.

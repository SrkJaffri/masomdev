-- MASOM newsletter subscribers.
--
-- Public visitors subscribe through the homepage form; writes happen ONLY via
-- the server-side server action using the service-role key (never exposed to
-- the browser). Because RLS is enabled and NO anon policies exist, the public
-- (anon) API cannot read, insert, update or delete subscriber rows at all.
-- Admins read/update through the session-aware client (public.is_admin()).
-- There is intentionally NO delete policy: subscriber history is preserved
-- (unsubscribe is a status change, never a row deletion).
-- This migration is idempotent (if not exists / drop policy if exists).

-- ===========================================================================
-- TABLE
-- ===========================================================================
create table if not exists public.newsletter_subscribers (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  consent          boolean not null default false,
  status           text not null default 'subscribed',
  source           text not null default 'homepage',
  subscribed_at    timestamptz not null default now(),
  unsubscribed_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Sanity guards (application validation is the primary gate).
  constraint newsletter_subscribers_email_len check (char_length(email) <= 254),
  constraint newsletter_subscribers_email_shape
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint newsletter_subscribers_status
    check (status in ('subscribed', 'unsubscribed'))
);

-- Case-insensitive uniqueness: User@Example.com and user@example.com are the
-- same subscriber. lower() index — the application also normalizes (trims and
-- lowercases) before persisting; this is the DB-level guarantee.
create unique index if not exists newsletter_subscribers_email_unique
  on public.newsletter_subscribers (lower(email));

-- Fast admin list (newest subscription first).
create index if not exists newsletter_subscribers_subscribed_at_idx
  on public.newsletter_subscribers (subscribed_at desc);

-- Fast "active subscribers" count for the sidebar badge / dashboard.
create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

drop trigger if exists newsletter_subscribers_set_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_set_updated_at
  before update on public.newsletter_subscribers
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS — strict: subscribers contain personal information.
-- ===========================================================================
alter table public.newsletter_subscribers enable row level security;

-- NO anon policies of any kind: public SELECT/INSERT/UPDATE/DELETE are all
-- denied by default. The homepage form inserts through the server action with
-- the service-role key (bypasses RLS server-side only).

drop policy if exists "newsletter_subscribers_admin_read" on public.newsletter_subscribers;
create policy "newsletter_subscribers_admin_read"
  on public.newsletter_subscribers for select
  to authenticated
  using (public.is_admin());

drop policy if exists "newsletter_subscribers_admin_update" on public.newsletter_subscribers;
create policy "newsletter_subscribers_admin_update"
  on public.newsletter_subscribers for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy (service-role server action only) and no delete policy
-- (subscribers are never deleted; unsubscribing is a status change).

-- ===========================================================================
-- ADMIN ACTIVITY — allow the shared audit log to track "newsletter" mutations
-- (unsubscribe / resubscribe). Extends the existing check constraint.
-- ===========================================================================
alter table public.admin_activity drop constraint if exists admin_activity_module_check;
alter table public.admin_activity add constraint admin_activity_module_check
  check (module in ('banner', 'program', 'announcement', 'calendar', 'newsletter'));

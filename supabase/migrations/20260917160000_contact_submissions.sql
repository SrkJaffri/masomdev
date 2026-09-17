-- Contact form submissions (public /contacts form).
--
-- Writes happen ONLY through the server-side server action using the
-- service-role key (never exposed to the browser). RLS is enabled and NO anon
-- policies exist, so the public API cannot read, insert, update or delete
-- submissions at all. Admins read/update through the session-aware client
-- (public.is_admin()). There is intentionally NO delete policy: submissions
-- are archived via status, never deleted (history preserved).
-- This migration is idempotent (if not exists / drop policy if exists).

-- ===========================================================================
-- TABLE
-- ===========================================================================
create table if not exists public.contact_submissions (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  message        text not null,
  consent        boolean not null default false,
  status         text not null default 'new',
  source         text not null default 'contacts-page',
  ip_hash        text,
  user_agent     text,
  submitted_at   timestamptz not null default now(),
  read_at        timestamptz,
  replied_at     timestamptz,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Sanity guards (application validation is the primary gate).
  constraint contact_submissions_name_len check (char_length(name) <= 120),
  constraint contact_submissions_email_len check (char_length(email) <= 254),
  constraint contact_submissions_message_len check (char_length(message) <= 5000),
  constraint contact_submissions_status
    check (status in ('new', 'read', 'replied', 'archived'))
);

-- Admin list defaults to newest first.
create index if not exists contact_submissions_submitted_at_idx
  on public.contact_submissions (submitted_at desc);

-- Badge count (status = 'new') and status filtering.
create index if not exists contact_submissions_status_idx
  on public.contact_submissions (status);

-- Admin search by email.
create index if not exists contact_submissions_email_idx
  on public.contact_submissions (email);

drop trigger if exists contact_submissions_set_updated_at on public.contact_submissions;
create trigger contact_submissions_set_updated_at
  before update on public.contact_submissions
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS — strict: submissions contain visitor personal information.
-- ===========================================================================
alter table public.contact_submissions enable row level security;

-- NO anon policies of any kind: public SELECT/INSERT/UPDATE/DELETE are all
-- denied by default. The contact form inserts through the server action with
-- the service-role key (server-side only).

drop policy if exists "contact_submissions_admin_read" on public.contact_submissions;
create policy "contact_submissions_admin_read"
  on public.contact_submissions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "contact_submissions_admin_update" on public.contact_submissions;
create policy "contact_submissions_admin_update"
  on public.contact_submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy (service-role server action only) and no delete policy
-- (submissions are archived, never deleted).

-- ===========================================================================
-- ADMIN ACTIVITY — allow the shared audit log to track "contact" mutations
-- (mark read / replied / archived). Extends the existing check constraint.
-- ===========================================================================
alter table public.admin_activity drop constraint if exists admin_activity_module_check;
alter table public.admin_activity add constraint admin_activity_module_check
  check (module in ('banner', 'program', 'announcement', 'calendar', 'newsletter', 'contact'));

-- Donation intents: donor information registered through the MASOM Assistant
-- (website chatbot) and, optionally, other website surfaces.
--
-- IMPORTANT SEMANTICS
--   A row here is NOT proof of payment. MASOM does not process payments on the
--   website: the donor registers their information and then completes payment
--   through Zelle/Quickpay or regular mail. The status vocabulary deliberately
--   contains NO 'paid'/'completed' value so no code path can ever claim funds
--   were received.
--
-- WRITE PATH
--   Rows are inserted ONLY by the server-side assistant tool using the
--   service-role key (never exposed to the browser), mirroring the
--   contact_submissions model. RLS is enabled with NO anon policies at all, so
--   the public API cannot read, insert, update or delete donation intents.
--   Admins read/update through the session-aware client (public.is_admin()).
--
-- There is intentionally NO delete policy: intents are archived via status,
-- never deleted (history preserved). Idempotent throughout.

-- ===========================================================================
-- TABLE
-- ===========================================================================
create table if not exists public.donation_intents (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  phone          text,
  -- Informational amount the donor stated. numeric(12,2) matches the Donate
  -- form's validation (up to 7 integer digits + 2 decimals).
  amount         numeric(12, 2) not null,
  -- Mirrors DONATION_PURPOSES on the existing Donate form — no invented funds.
  donation_type  text not null default 'General Donation',
  note           text,
  -- Which surface registered the intent.
  source         text not null default 'website-chatbot',
  -- Payment is ALWAYS outstanding at registration time.
  status         text not null default 'registered',
  -- Deduplication key: one confirmed intent = exactly ONE row, even if the
  -- model repeats the tool call or the visitor double-clicks. Server-generated
  -- from the chat session + normalized donor payload.
  idempotency_key text,
  ip_hash        text,
  user_agent     text,
  submitted_at   timestamptz not null default now(),
  reviewed_at    timestamptz,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Sanity guards (application validation remains the primary gate).
  constraint donation_intents_name_len check (char_length(name) <= 120),
  constraint donation_intents_email_len check (char_length(email) <= 254),
  constraint donation_intents_phone_len check (phone is null or char_length(phone) <= 40),
  constraint donation_intents_note_len check (note is null or char_length(note) <= 1000),
  constraint donation_intents_amount_positive check (amount > 0),
  constraint donation_intents_amount_max check (amount <= 9999999.99),
  constraint donation_intents_source
    check (source in ('website-chatbot', 'website-donate-form')),
  -- NOTE: no 'paid'/'payment_received'/'completed' value exists by design.
  constraint donation_intents_status
    check (status in ('registered', 'awaiting_payment', 'reviewed', 'archived'))
);

-- One row per confirmed intent: the partial unique index makes a duplicate
-- tool call a no-op at the DATABASE level, not just in application code.
create unique index if not exists donation_intents_idempotency_key_idx
  on public.donation_intents (idempotency_key)
  where idempotency_key is not null;

-- Admin list defaults to newest first.
create index if not exists donation_intents_submitted_at_idx
  on public.donation_intents (submitted_at desc);

-- Badge count + status filtering.
create index if not exists donation_intents_status_idx
  on public.donation_intents (status);

-- Admin search by donor email.
create index if not exists donation_intents_email_idx
  on public.donation_intents (email);

drop trigger if exists donation_intents_set_updated_at on public.donation_intents;
create trigger donation_intents_set_updated_at
  before update on public.donation_intents
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS — strict: donation intents contain donor personal information.
-- ===========================================================================
alter table public.donation_intents enable row level security;

-- NO anon policies of any kind: public SELECT/INSERT/UPDATE/DELETE are all
-- denied by default. The assistant tool inserts through the server-side
-- service-role client only.

drop policy if exists "donation_intents_admin_read" on public.donation_intents;
create policy "donation_intents_admin_read"
  on public.donation_intents for select
  to authenticated
  using (public.is_admin());

drop policy if exists "donation_intents_admin_update" on public.donation_intents;
create policy "donation_intents_admin_update"
  on public.donation_intents for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert policy (service-role server tool only) and no delete policy
-- (intents are archived, never deleted).

-- ===========================================================================
-- ADMIN ACTIVITY — allow the shared audit log to track "donation" mutations
-- (mark reviewed / archived). Extends the existing check constraint.
-- ===========================================================================
alter table public.admin_activity drop constraint if exists admin_activity_module_check;
alter table public.admin_activity add constraint admin_activity_module_check
  check (module in (
    'banner', 'program', 'announcement', 'calendar',
    'newsletter', 'contact', 'settings', 'donation'
  ));

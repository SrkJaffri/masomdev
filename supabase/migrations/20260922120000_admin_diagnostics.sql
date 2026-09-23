-- Durable failure diagnostics for admin Server Action mutations.
--
-- WHY: /admin/programs intermittently showed the generic section error for one
-- admin while Vercel Hobby's short log retention expired before the incident
-- could be inspected. This append-only table preserves the minimal, safe
-- fingerprint of every unexpected mutation failure so the NEXT occurrence can
-- be traced (correlation id -> stage + error code) even weeks later.
--
-- WHAT IS STORED (and nothing more):
--   area / operation / stage / error_code / a <=300-char sanitized message /
--   correlation id / timestamp. No tokens, cookies, keys, form payloads, PII
--   or stack traces — the message is sanitized server-side before insert.
--
-- WRITE PATH: exclusively the SECURITY DEFINER RPC log_admin_diagnostic(),
-- gated on public.is_admin(), mirroring log_admin_activity() from the
-- 20260813120800_admin_audit.sql pattern. Reads: admins only, via RLS.
-- This migration is idempotent (drop policy if exists / create or replace).

create table if not exists public.admin_diagnostics (
  id             uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  area           text not null,
  operation      text not null,
  stage          text not null check (stage in
                   ('auth', 'validation', 'stale', 'upload', 'database',
                    'revalidation', 'unknown')),
  error_code     text not null,
  safe_message   text not null,
  created_at     timestamptz not null default now()
);

create index if not exists admin_diagnostics_correlation_idx
  on public.admin_diagnostics (correlation_id);

create index if not exists admin_diagnostics_recent_idx
  on public.admin_diagnostics (created_at desc);

alter table public.admin_diagnostics enable row level security;

drop policy if exists "admin_diagnostics_admin_select" on public.admin_diagnostics;
create policy "admin_diagnostics_admin_select"
  on public.admin_diagnostics for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: append-only through the RPC below.

-- ---------------------------------------------------------------------------
-- RPC: log_admin_diagnostic — the ONLY write path for diagnostic records.
-- SECURITY DEFINER so it can insert despite the lack of INSERT policies;
-- the is_admin() guard means only authorized admins can call it. A trailing
-- guard keeps a runaway message from bloating rows (the app already trims).
-- ---------------------------------------------------------------------------
create or replace function public.log_admin_diagnostic(
  p_correlation_id text,
  p_area           text,
  p_operation      text,
  p_stage          text,
  p_error_code     text,
  p_safe_message   text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.admin_diagnostics
    (correlation_id, area, operation, stage, error_code, safe_message)
  values (
    left(p_correlation_id, 64),
    left(p_area, 64),
    left(p_operation, 64),
    p_stage,
    left(p_error_code, 64),
    left(p_safe_message, 300)
  );
end;
$$;

revoke all on function public.log_admin_diagnostic(text, text, text, text, text, text)
  from public;
grant execute on function
  public.log_admin_diagnostic(text, text, text, text, text, text)
  to authenticated;

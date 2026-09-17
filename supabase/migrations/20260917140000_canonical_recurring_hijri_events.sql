-- MASOM calendar: canonical recurring Hijri event model.
--
-- ROOT CAUSE BEING FIXED
--   Until now every Islamic event was stored as a YEAR-SPECIFIC Hijri copy:
--   the 2026 approved calendar as 1447/1448 rows (migration 20260813120700
--   backfill) and the 2025 calendar as 1446 rows imported from the legacy
--   printed timetable (seed-calendar-2025.mjs + the 13-row patch in
--   migration 20260917130000). The legacy 2025 labels drifted ±1-2 days and
--   carried title variants, so 2025 rendered wrong, extra and missing events
--   (e.g. an extra "Jumatul Wida" on 28 Ramzan; the canonical set has
--   Juma'tul Wida / Yaum-e-Quds on 24 Ramzan).
--
-- THE CANONICAL MODEL
--   The approved 2026 calendar defines THE recurring Islamic event set:
--   same Hijri month + same Hijri day = same event(s) every Hijri year.
--   Recurring events are stored ONCE with hijri_year = NULL and render for
--   any Hijri year whose boundaries resolve a day to that (month, day).
--   Genuine Hijri-year-specific events keep their explicit hijri_year row.
--
-- DRY-RUNNED EXACT EFFECT (audited 2026-09-17 against production data)
--   dedup:      8 rows   hijri_year = 1447 Rajab copies created 2026-09-16
--                          that exactly duplicate an approved 1448 row on the
--                          same (month, day, normalized title, category) —
--                          the recurring row renders both occurrences, so the
--                          later copy is redundant
--   normalize: 84 rows  (1447 m7-12: 44, 1448 m1-7: 40) → hijri_year = NULL,
--              cached event_date refreshed via hijri_to_gregorian(1448, ...)
--   delete:    53 rows  hijri_year = 1446 (legacy 2025 import + the 13-row
--                          20260917130000 patch — superseded)
--             + 27 rows  hijri_year = 1447 months 1-6 whose (month, day)
--                          anchor collides with a NULL recurring anchor
--                          (duplicate copies of Muharram/Safar/Rabi-ul-Awwal
--                          events; their titles were merged into the 1448
--                          approved rows of the same anchor)
--   keep:       1 row   "Prophet (pbuh) enters Madina - building of
--                          Masjid-e-Quba 1 AH" (1447/3/12) — a genuine
--                          Hijri-year-specific historical event (1 AH).
--   FINAL STATE: 85 rows — 84 recurring (NULL) + 1 year-specific.
--
-- SAFETY
--   * The guard assertion below hard-fails the migration if the audited
--     counts drift (a new event must be re-audited first).
--   * The normalized recurring set is EXACTLY the rows that render the
--     approved 2026 calendar, so 2026 output is visually unchanged (the
--     deleted 1447 m1-6 rows never rendered in 2026; the deleted 1446 rows
--     never rendered in 2026).
--   * A full before/after rendered-signature comparison was captured in
--     scripts/tmp-baseline-2026.txt / verified by the post-fix validation.
--   * 2025 prayer timings, Gregorian rows, Hijri boundaries and labels are
--     NOT touched.
--
-- NOTE FOR FRESH ENVIRONMENTS
--   scripts/seed-calendar-2025.mjs no longer imports Islamic events, and
--   seed-calendar.mjs runs AFTER this migration in a fresh env, so no
--   year-specific copies can be recreated.

-- ---------------------------------------------------------------------------
-- 1. Capture the row identity that will be normalized (guarded BEFORE touch).
-- ---------------------------------------------------------------------------
-- 1a. Duplicate 1447 Rajab copies: same (month, day, normalized title,
--     category) as the approved 1448 row. Once the anchor is recurring, the
--     recurring row renders BOTH Hijri years, so the later copy is redundant.
create temp table _dup_1447_copies on commit drop as
select e.id, e.title, e.category, e.hijri_year, e.hijri_month, e.hijri_day
from public.calendar_events e
where e.hijri_year = 1447
  and e.hijri_month between 7 and 12
  and exists (
    select 1
    from public.calendar_events a
    where a.hijri_year = 1448
      and a.hijri_month between 1 and 7
      and a.hijri_month = e.hijri_month
      and a.hijri_day = e.hijri_day
      and a.category = e.category
      and lower(regexp_replace(a.title, '[^a-zA-Z0-9]+', '', 'g'))
        = lower(regexp_replace(e.title, '[^a-zA-Z0-9]+', '', 'g'))
  );

create temp table _recurring_normalized on commit drop as
select id, title, category, hijri_year, hijri_month, hijri_day
from public.calendar_events
where (hijri_year = 1447 and hijri_month between 7 and 12)
   or (hijri_year = 1448 and hijri_month between 1 and 7)
except
select id, title, category, hijri_year, hijri_month, hijri_day
from _dup_1447_copies;

create temp table _delete_1446 on commit drop as
select id, title, hijri_year, hijri_month, hijri_day
from public.calendar_events
where hijri_year = 1446;

create temp table _delete_collision on commit drop as
select e.id, e.title, e.hijri_year, e.hijri_month, e.hijri_day
from public.calendar_events e
where e.hijri_year = 1447
  and e.hijri_month between 1 and 6
  and exists (
    select 1 from _recurring_normalized n
    where n.hijri_month = e.hijri_month and n.hijri_day = e.hijri_day
  );

-- Guards: hard-fail if the audited shape drifted.
do $$
begin
  if (select count(*) from _dup_1447_copies) <> 8 then
    raise exception 'expected 8 duplicate 1447 Rajab copies, found %', (select count(*) from _dup_1447_copies);
  end if;
  if (select count(*) from _recurring_normalized) <> 84 then
    raise exception 'expected 84 approved 2026 rows to normalize, found %', (select count(*) from _recurring_normalized);
  end if;
  if (select count(*) from _delete_1446) <> 53 then
    raise exception 'expected 53 rows with hijri_year = 1446, found %', (select count(*) from _delete_1446);
  end if;
  if (select count(*) from _delete_collision) <> 27 then
    raise exception 'expected 27 year-collision copies, found %', (select count(*) from _delete_collision);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Normalize: the 2026-approved recurring events become hijri_year = NULL.
--    event_date cache is refreshed to the 1448 resolution so the cached value
--    stays consistent (rendering derives dates live; the cache is reference).
--    Migration 20260813120700 tightened hijri_year to NOT NULL once every row
--    carried an anchor; the recurring model re-allows NULL for "every year".
-- ---------------------------------------------------------------------------
alter table public.calendar_events alter column hijri_year drop not null;

update public.calendar_events e
set hijri_year = null,
    event_date = public.hijri_to_gregorian(1448, n.hijri_month, n.hijri_day),
    updated_at = now()
from _recurring_normalized n
where e.id = n.id
  and public.hijri_to_gregorian(1448, n.hijri_month, n.hijri_day) is not null;

-- Any of the 92 that could not be cached keep NULL year but are flagged below.

-- ---------------------------------------------------------------------------
-- 2b. Make hijri_to_gregorian recurring-aware: p_year IS NULL now resolves to
--     the latest published boundary's Hijri year (the current occurrence).
--     Previously a NULL year returned NULL, which would freeze the cache of
--     every recurring row.
-- ---------------------------------------------------------------------------
create or replace function public.hijri_to_gregorian(
  p_year  integer,
  p_month integer,
  p_day   integer
) returns date
language sql
stable
as $$
  with ref as (
    select coalesce(
      p_year,
      (
        select h.hijri_year
        from public.hijri_months h
        where h.is_published
        order by h.gregorian_start desc
        limit 1
      )
    ) as year
  ),
  target as (
    select (ref.year * 12 + (p_month - 1)) as t_idx from ref
  ),
  candidate as (
    select h.gregorian_start as start,
           (h.hijri_year * 12 + (h.hijri_month - 1)) as c_idx
    from public.hijri_months h, target
    where h.is_published
      and (h.hijri_year * 12 + (h.hijri_month - 1)) <= target.t_idx
    order by (h.hijri_year * 12 + (h.hijri_month - 1)) desc
    limit 1
  )
  select coalesce(
    (
      select o.gregorian_date
      from public.hijri_overrides o
      where o.hijri_year = ref.year
        and o.hijri_month = p_month
        and o.hijri_day = p_day
    ),
    (
      select (candidate.start + (
        coalesce((
          select sum(case when ((i % 12) + 1) % 2 = 1 then 30 else 29 end)::int
          from generate_series(candidate.c_idx, (select t_idx from target) - 1) as i
        ), 0) + (p_day - 1)
      ))::date
      from candidate
    )
  )
  from ref
$$;

-- The event_date sync trigger must also refresh RECURRING (hijri_year NULL)
-- rows; the old WHERE skipped them, leaving stale caches forever.
create or replace function public.sync_calendar_event_dates()
returns trigger
language plpgsql
security invoker
as $$
begin
  update public.calendar_events
  set event_date = public.hijri_to_gregorian(hijri_year, hijri_month, hijri_day),
      updated_at = now()
  where hijri_month is not null
    and hijri_day is not null
    and public.hijri_to_gregorian(hijri_year, hijri_month, hijri_day) is not null;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Remove the superseded year-specific copies (proven redundant above).
--    3a. every 2025 legacy/backfill copy (hijri_year = 1446)
--    3b. the 1447 m1-6 duplicates whose anchor now exists as a recurring row
-- ---------------------------------------------------------------------------
delete from public.calendar_events
where id in (select id from _delete_1446);

delete from public.calendar_events
where id in (select id from _delete_collision);

delete from public.calendar_events
where id in (select id from _dup_1447_copies);

-- ---------------------------------------------------------------------------
-- 4. Integrity checks (hard-fail on violation).
-- ---------------------------------------------------------------------------
do $$
declare
  bad_cache int;
  dup_anchor int;
  left_behind int;
begin
  -- every recurring row must have a resolvable cache for the reference year
  select count(*) into bad_cache
  from public.calendar_events
  where hijri_year is null
    and public.hijri_to_gregorian(1448, hijri_month, hijri_day) is null;
  if bad_cache > 0 then
    raise exception '% recurring rows have no 1448 boundary to cache event_date', bad_cache;
  end if;

  -- no duplicate (title-normalized) recurring event on one anchor
  select count(*) into dup_anchor
  from (
    select lower(regexp_replace(title, '[^a-zA-Z0-9]+', '', 'g')) as t,
           hijri_month, hijri_day
    from public.calendar_events
    where hijri_year is null
    group by 1, 2, 3
    having count(*) > 1
  ) d;
  if dup_anchor > 0 then
    raise exception '% duplicate recurring anchors after normalization', dup_anchor;
  end if;

  -- the approved 2026 window must be FULLY normalized (no row left with a
  -- specific year there — e.g. if an anchor lacked a 1448 boundary above)
  select count(*) into left_behind
  from public.calendar_events
  where (hijri_year = 1447 and hijri_month between 7 and 12)
     or (hijri_year = 1448 and hijri_month between 1 and 7);
  if left_behind > 0 then
    raise exception '% approved rows were not normalized (missing 1448 boundaries?)', left_behind;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Audit temp tables (reporting copy, dropped with the transaction).
-- ---------------------------------------------------------------------------
drop table if exists _recurring_normalized;
drop table if exists _delete_1446;
drop table if exists _delete_collision;
drop table if exists _dup_1447_copies;

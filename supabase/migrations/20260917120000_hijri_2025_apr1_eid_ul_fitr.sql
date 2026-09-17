-- MASOM calendar correction: 1 Shawwal 1446 = 2025-04-01 (Eid-ul-Fitr 2025).
--
-- CONTEXT
--   The official printed 2025 timetable labels 2025-04-01 as "30 Ramzan" and
--   jumps straight to "2 Shawwal" on 2025-04-02 — a quirk of the printed
--   table, not a moon-sighting position: Shawwal 1446 unambiguously began on
--   2025-04-01 (Eid-ul-Fitr 2025 in Chicago). The hijri_months boundary for
--   Shawwal 1446 was therefore (correctly) derived as 2025-04-01 by the 2025
--   seed, and the printed "30 Ramzan" label was preserved via hijri_overrides.
--   Admin decision: the boundary wins. The override goes, and the day renders
--   as 1 Shawwal 1446 with the Eid-ul-Fitr 2025 event:
--     2025-03-31 -> 29 Ramzan 1446     (unchanged)
--     2025-04-01 ->  1 Shawwal 1446    (corrected — was shown as 30 Ramzan)
--     2025-04-02 ->  2 Shawwal 1446    (unchanged)
--
-- WHAT THIS DOES
--   1. Deletes ONLY the guarded override row (2025-04-01 = 30 Ramzan 1446).
--      If that row has been manually changed to anything else, it is left
--      untouched rather than discarded.
--   2. Inserts the missing "Eid-ul-Fitr 2025" event anchored to 1 Shawwal
--      1446. The cached event_date is derived live through the same
--      boundaries the app uses (hijri_to_gregorian), and the row is deduped
--      on the exact anchor + title so re-running is a no-op.
--
-- SAFETY
--   * Pure DML, guarded and idempotent — safe to re-run.
--   * The sync trigger from 20260813120700 recomputes cached event_date
--     values automatically when the override is deleted.
--   * Touches nothing else: no month boundaries, no prayer timings, no 2026
--     rows, no RLS.
--
-- NOTE FOR FRESH ENVIRONMENTS
--   scripts/seed-calendar-2025.mjs knows about this correction: it no longer
--   recreates the "30 Ramzan" override for 2025-04-01, so seed + migration
--   can run in either order and converge on the same state.

-- 1. Remove the printed "30 Ramzan" label on 2025-04-01 (guarded delete).
delete from public.hijri_overrides
where gregorian_date = '2025-04-01'
  and hijri_year = 1446
  and hijri_month = 9
  and hijri_day = 30;

-- 2. Add the Eid-ul-Fitr 2025 event, anchored to 1 Shawwal 1446 (idempotent).
insert into public.calendar_events
  (event_date, title, description, category, sort_order, is_active, hijri_year, hijri_month, hijri_day)
select public.hijri_to_gregorian(1446, 10, 1),
       'Eid-ul-Fitr 2025',
       null,
       'Eid',
       0,
       true,
       1446,
       10,
       1
where public.hijri_to_gregorian(1446, 10, 1) is not null
  and not exists (
    select 1
    from public.calendar_events
    where hijri_year = 1446
      and hijri_month = 10
      and hijri_day = 1
      and title = 'Eid-ul-Fitr 2025'
  );

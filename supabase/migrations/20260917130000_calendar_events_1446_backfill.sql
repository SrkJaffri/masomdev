-- MASOM calendar backfill: recurring events missing from the 2025 (1446) set.
--
-- CONTEXT
--   The official printed 2025 timetable (the 2025 seed's only event source)
--   omits several recurring Islamic events that the 2026 calendar carries —
--   most of Dhul-Hijjah's first ten days (Eid-ul-Azha 10, Muslim Ibne Aqeel 9,
--   "Imam Hussain left Makkah" 8, the Prophet's wedding 1), Eid Al-Ghadir 18,
--   and a handful of Rajab/Shaban/Ramzan/Shawwal entries. This is a publishing
--   gap in the legacy source, not a doctrinal difference: each omitted event
--   exists in the 2026 (1447) set at the SAME Hijri (month, day).
--
-- WHAT THIS DOES
--   Inserts the missing 1446 anchors, taking title + category verbatim from
--   the corresponding 1447 row so both years render identically. Each event
--   stays hijri-anchored (year 1446) and the cached event_date is derived
--   through the live boundaries (hijri_to_gregorian), exactly like every
--   other event.
--
-- SAFETY
--   * Pure DML, guarded and idempotent — safe to re-run.
--   * Dedup on the exact (hijri_year, hijri_month, hijri_day, title) anchor;
--     existing rows are never modified or deleted.
--   * The sync trigger from 20260813120700 refreshes cached event_date values
--     automatically after the insert.
--   * Touches nothing else: no boundaries, no prayer timings, no 2026 rows.

insert into public.calendar_events
  (event_date, title, description, category, sort_order, is_active, hijri_year, hijri_month, hijri_day)
select public.hijri_to_gregorian(v.hijri_year, v.hijri_month, v.hijri_day),
       v.title,
       null,
       v.category,
       0,
       true,
       v.hijri_year,
       v.hijri_month,
       v.hijri_day
from (values
  -- Rajab 1446
  (1446,  7, 10, 'Wiladat: Imam Mohammad Taqi (AS)',                    'Wiladat'),
  -- Shaban 1446
  (1446,  8,  1, 'Wiladat: BiBi Zainab S.A.',                           'Wiladat'),
  (1446,  8,  5, 'Wafat: Bibi Fizza (SA)',                              'Wafat'),
  -- Ramzan 1446
  (1446,  9, 12, 'Bible was revealed',                                  'Historical'),
  (1446,  9, 17, 'Battle of Badr was fought',                           'Historical'),
  (1446,  9, 19, 'Subhe Zarbat: Imam Ali Ibne Abi Talib (AS)',          'Historical'),
  -- Shawwal 1446 (1 Shawwal Eid-ul-Fitr already exists as "Eid-ul-Fitr 2025")
  (1446, 10, 10, 'Ghaibat Kubra (Imam Aakhir-uz-Zaman AS) began',       'Historical'),
  (1446, 10, 17, 'Battle of Uhud was fought',                           'Historical'),
  -- Zilhajj 1446
  (1446, 12,  1, 'Wedding: Imam Ali (AS) and Bibi Fatima Zehra (SA)',   'Historical'),
  (1446, 12,  8, 'Imam Hussain left Makkah towards Karbala',            'Historical'),
  (1446, 12,  9, 'Martyrdom: Hazrat Muslim Ibne Aqeel (AS)',            'Martyrdom'),
  (1446, 12, 10, 'Eid-ul-Azha',                                         'Eid'),
  (1446, 12, 18, 'Eid Al-Ghadir',                                       'Eid')
) as v(hijri_year, hijri_month, hijri_day, title, category)
where public.hijri_to_gregorian(v.hijri_year, v.hijri_month, v.hijri_day) is not null
  and not exists (
    select 1
    from public.calendar_events e
    where e.hijri_year = v.hijri_year
      and e.hijri_month = v.hijri_month
      and e.hijri_day = v.hijri_day
      and e.title = v.title
  );

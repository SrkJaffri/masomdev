-- Extend the admin activity log's module whitelist to cover the newsletter
-- module, so admin subscriber status changes appear in the dashboard's
-- "Recent activity" card like every other CMS mutation.
alter table public.admin_activity
  drop constraint if exists admin_activity_module_check;

alter table public.admin_activity
  add constraint admin_activity_module_check
  check (module in ('banner', 'program', 'announcement', 'calendar', 'newsletter'));

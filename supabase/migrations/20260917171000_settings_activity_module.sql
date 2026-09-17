-- Allow the "settings" module in the admin activity log so Site Settings
-- updates appear in the dashboard's Recent Activity card.
alter table public.admin_activity
  drop constraint if exists admin_activity_module_check;

alter table public.admin_activity
  add constraint admin_activity_module_check
  check (module in ('banner', 'program', 'announcement', 'calendar', 'newsletter', 'contact', 'settings'));

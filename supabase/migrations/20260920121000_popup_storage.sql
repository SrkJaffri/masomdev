-- Storage for the Website Popup artwork: a dedicated 'popup' bucket with the
-- exact same security model as the existing 'banners'/'programs' CMS buckets
-- (public READ via the public object URL; INSERT/UPDATE/DELETE restricted to
-- authenticated admins through public.is_admin()). Created as its own bucket —
-- rather than reusing 'banners' — so replacing the popup image never has to
-- reason about hero-slider objects, and cleanup rules stay trivially scoped.
-- Idempotent; pairs with 20260920120000_site_settings_popup.sql.

insert into storage.buckets (id, name, public)
values ('popup', 'popup', true)
on conflict (id) do nothing;

-- Extend the existing media policies to include the new bucket.

drop policy if exists "cms_media_public_read" on storage.objects;
create policy "cms_media_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('banners', 'programs', 'popup'));

drop policy if exists "cms_media_admin_insert" on storage.objects;
create policy "cms_media_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('banners', 'programs', 'popup') and public.is_admin());

drop policy if exists "cms_media_admin_update" on storage.objects;
create policy "cms_media_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('banners', 'programs', 'popup') and public.is_admin())
  with check (bucket_id in ('banners', 'programs', 'popup') and public.is_admin());

drop policy if exists "cms_media_admin_delete" on storage.objects;
create policy "cms_media_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('banners', 'programs', 'popup') and public.is_admin());

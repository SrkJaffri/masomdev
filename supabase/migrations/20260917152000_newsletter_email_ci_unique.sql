-- Harden newsletter_subscribers uniqueness to be truly case-insensitive at the
-- DB level. The previously applied index ended up on the raw email column; this
-- normalizes it to lower(email) so User@Example.com and user@example.com can
-- never coexist, regardless of application behavior.
drop index if exists public.newsletter_subscribers_email_unique;

create unique index if not exists newsletter_subscribers_email_unique
  on public.newsletter_subscribers (lower(email));

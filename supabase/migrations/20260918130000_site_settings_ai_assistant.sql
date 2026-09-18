-- Site Settings → AI Support Agent (MASOM Assistant).
--
-- CMS-controlled presentation + kill switch for the public website chatbot.
-- Values are backfilled with the approved defaults so applying this migration
-- changes nothing visually beyond enabling the assistant.
--
-- SECURITY: provider API keys are NEVER stored here. They stay server-side
-- environment variables (AI_API_KEY). This table is publicly readable through
-- the existing site_settings_public_read policy, so it must only ever hold
-- non-secret presentation values.
--
-- Reuses the existing site_settings singleton row ('main'), its updated_at
-- trigger and its RLS policies — no new table, no new policy. Idempotent.

alter table public.site_settings
  add column if not exists ai_assistant_enabled boolean not null default true;

alter table public.site_settings
  add column if not exists ai_assistant_name text not null default 'MASOM Assistant';

alter table public.site_settings
  add column if not exists ai_assistant_welcome_message text not null default
    'Assalam-o-Alaikum! I’m the MASOM Assistant. I can help you with programs, prayer and Hijri calendar information, Islamic events, donations, and other MASOM website information. How can I help?';

-- Shown when the AI provider is unavailable (or unconfigured), so the visitor
-- always gets a real way to reach MASOM instead of a dead chat window.
alter table public.site_settings
  add column if not exists ai_assistant_fallback_message text not null default
    'MASOM Assistant is temporarily unavailable. You can still contact us through the Contact page or WhatsApp.';

-- Guard rails so a CMS value can never break the approved chat layout.
alter table public.site_settings
  drop constraint if exists site_settings_ai_name_len;
alter table public.site_settings
  add constraint site_settings_ai_name_len
  check (char_length(ai_assistant_name) between 1 and 60);

alter table public.site_settings
  drop constraint if exists site_settings_ai_welcome_len;
alter table public.site_settings
  add constraint site_settings_ai_welcome_len
  check (char_length(ai_assistant_welcome_message) between 1 and 500);

alter table public.site_settings
  drop constraint if exists site_settings_ai_fallback_len;
alter table public.site_settings
  add constraint site_settings_ai_fallback_len
  check (char_length(ai_assistant_fallback_message) between 1 and 500);

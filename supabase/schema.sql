-- Database and storage setup for the Library feature.
-- Run in the Supabase SQL editor. Safe to re-run.

-- ── Playlists ───────────────────────────────────────────────────────────────
create table if not exists public.playlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text,
  format     text not null check (format in ('mp3', 'wav')),
  chapters   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- For databases created before `title` existed.
alter table public.playlists add column if not exists title text;

create index if not exists playlists_user_created_idx on public.playlists (user_id, created_at desc);

alter table public.playlists enable row level security;

drop policy if exists "Users read own playlists" on public.playlists;
create policy "Users read own playlists" on public.playlists
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users insert own playlists" on public.playlists;
create policy "Users insert own playlists" on public.playlists
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users delete own playlists" on public.playlists;
create policy "Users delete own playlists" on public.playlists
  for delete to authenticated using (user_id = auth.uid());

-- ── Audio storage ───────────────────────────────────────────────────────────
-- Private bucket: the app plays audio through short-lived signed URLs, so
-- nobody can fetch a user's audiobooks without being signed in as that user.
insert into storage.buckets (id, name, public)
values ('audio-playlists', 'audio-playlists', false)
on conflict (id) do update set public = false;

-- Files live under "<user id>/<playlist id>/chapter_<n>.<ext>".
drop policy if exists "Users read own audio" on storage.objects;
create policy "Users read own audio" on storage.objects
  for select to authenticated
  using (bucket_id = 'audio-playlists' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload own audio" on storage.objects;
create policy "Users upload own audio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audio-playlists' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete own audio" on storage.objects;
create policy "Users delete own audio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audio-playlists' and (storage.foldername(name))[1] = auth.uid()::text);

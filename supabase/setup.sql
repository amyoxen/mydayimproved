create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  completed boolean not null default false,
  day text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can read own tasks" on public.tasks;
drop policy if exists "users can insert own tasks" on public.tasks;
drop policy if exists "users can update own tasks" on public.tasks;
drop policy if exists "users can delete own tasks" on public.tasks;

create policy "users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "users can read own tasks"
on public.tasks
for select
using (auth.uid() = user_id);

create policy "users can insert own tasks"
on public.tasks
for insert
with check (auth.uid() = user_id);

create policy "users can update own tasks"
on public.tasks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete own tasks"
on public.tasks
for delete
using (auth.uid() = user_id);

-- Use full replica identity so DELETE events include all columns (not just the primary key).
-- Without this, Realtime filters like user_id=eq.X cannot match DELETE events.
alter table public.tasks replica identity full;

-- Enable Supabase Realtime for the tasks table so all clients
-- (web, Android app, widget) receive instant push updates on changes.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then
  null;
end $$;

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

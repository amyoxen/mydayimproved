## My Day Cloud Tasks

Next.js app with:
- Landing page (`/`)
- Login page (`/login`)
- Cloud-synced task page (`/app`)
- Admin page to create user accounts (`/admin`)

Tasks are stored per user in Supabase (cloud database).

## 1. Prerequisites

- Node.js 20+
- A Supabase project

## 2. Environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY` is used only on server API routes.

## 3. Supabase SQL setup

Run this in Supabase SQL Editor:

```sql
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
```

Create your first admin user:

1. In Supabase Auth > Users, create a user (email/password).
2. Insert admin profile row:

```sql
insert into public.profiles (id, email, is_admin)
values ('<auth_user_uuid>', '<admin_email>', true)
on conflict (id) do update set is_admin = true;
```

## 4. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 5. Admin flow

1. Sign in as admin at `/login`.
2. Go to `/admin`.
3. Create user accounts (optionally grant admin).

## 6. Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

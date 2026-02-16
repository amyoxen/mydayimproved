# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack monorepo: a **Next.js web app** and a **native Android app** sharing the same Supabase backend (PostgreSQL with Row-Level Security). Both apps use the `tasks` table with a `day` field in `YYYY-MM-DD` format.

## Build & Run Commands

### Web App (Next.js)
```bash
npm install        # Install dependencies
npm run dev        # Dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint
```

### Android App
```bash
cd android-app
./gradlew assembleDebug   # Build debug APK
```
Output APK: `android-app/app/build/outputs/apk/debug/app-debug.apk`

Install on device:
```bash
$HOME/Library/Android/sdk/platform-tools/adb install -r android-app/app/build/outputs/apk/debug/app-debug.apk
```

Supabase credentials go in `android-app/gradle.properties` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## Architecture

### Web App (`app/`, `lib/`)
- **Next.js App Router** with React 19, Tailwind CSS 4, TypeScript
- Routes: `/` (landing), `/login`, `/app` (task dashboard), `/admin` (user management)
- `lib/supabase-client.ts` — browser-side Supabase client (anon key)
- `lib/supabase-server.ts` — server-side Supabase client (service role key, admin routes only)
- `app/api/insights/route.ts` — AI insights via Anthropic Claude API (aggregates 14 days of tasks)
- Environment: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Android App (`android-app/app/src/main/java/com/magicmac/myday/`)
- **MVVM** pattern: `MainViewModel` → `TaskRepository` → `SupabaseApi` (Retrofit)
- **Jetpack Compose** UI with Material3 theming (purple `#E8D4F8` palette)
- **Auth**: Email/password via Supabase REST. Tokens in DataStore (`SessionStore`). Auto-signout on 401.
- **Data flow**: `TaskRepository` is the single source of truth. Uses `backgroundScope` (SupervisorJob + Dispatchers.IO) for non-blocking server sync.
- **Widget** (`widget/` package): RemoteViews-based home-screen widget
  - `WidgetTaskCache` (SharedPreferences) stores widget data as JSON via Moshi
  - `MyDayWidgetProvider` handles broadcasts (toggle, edit actions)
  - `MyDayWidgetViewsFactory` renders list items with sort order (incomplete by sortOrder, completed by createdAt)
  - Dialog activities (`WidgetTaskInputActivity`, `WidgetTaskEditActivity`, `WidgetReorderActivity`) for add/edit/delete/reorder
  - Optimistic updates: cache updates + widget refresh immediately, server sync in background
- **Key limitation**: Android widgets (RemoteViews) cannot do animations, fade effects, or alpha transitions

### Shared Database Schema
- `tasks`: id (UUID), user_id, text, completed, day (YYYY-MM-DD string), created_at
- `profiles`: id (UUID), email, is_admin, created_at
- RLS policies restrict users to their own data

## Model Usage

- Use **Opus 4.6** for architectural decisions
- Use **Sonnet 4.5** for file edits

## Key Patterns

- **Optimistic updates** (Android): Update `WidgetTaskCache` and refresh widget immediately, then sync to server in background. On server error, reload from server to ensure consistency.
- **Session expiration** (Android): All API calls catch `retrofit2.HttpException` with code 401 and call `signOut()` to clear expired sessions.
- **Widget-App sync** (Android): The main app reads task sort order from `WidgetTaskCache` to stay synchronized with widget ordering. Auto-refresh on `ON_RESUME` (with 2-second debounce to avoid refreshing during widget dialogs).
- **`loadTasks(refreshWidget)`**: Parameter controls whether widget is refreshed after loading. Use `false` when a subsequent explicit refresh will follow.

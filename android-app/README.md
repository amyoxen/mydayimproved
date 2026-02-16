## Android App (My Day)

Native Android client that mirrors the existing web app's core flow:
- Supabase email/password login
- My Day tasks (today only)
- Archive tasks (older days)
- Home-screen widget with My Day list and tap-to-toggle check

### Setup

1. Open `android-app` in Android Studio.
2. In `android-app/gradle.properties`, add:

```properties
SUPABASE_URL=https://pfezsotwvieyqsgrbbwu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmZXpzb3R3dmlleXFzZ3JiYnd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDc2MTgsImV4cCI6MjA4NjY4MzYxOH0.Wz2mp5OV-5h-Z5seviy3wcy9Z2a_riEynIKPU5Ojplk
```

3. Build and run on an Android device/emulator.
4. Add the `My Day` widget from the launcher widget picker.

### Notes

- This app reuses the same Supabase `tasks` table and `day` field format (`YYYY-MM-DD`) used by the web app.
- Widget data is backed by in-app sync; after app actions (add/toggle/delete), widget content refreshes automatically.

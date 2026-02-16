import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAnonServerClient } from "@/lib/supabase-server";

type TaskRow = {
  text: string;
  completed: boolean;
  day: string;
  created_at: string;
};

type DaySummary = {
  day: string;
  weekday: string;
  total: number;
  completed: number;
  completionRate: number;
  completedTasks: string[];
  incompleteTasks: string[];
};

type InsightsResponse = {
  great: string[];
  not_great: string[];
  improve: string[];
};

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekday(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function computeStreaks(daySummaries: DaySummary[]): { current: number; longest: number } {
  const today = getDayKey();
  const activeDays = new Set(daySummaries.map((d) => d.day));

  let current = 0;
  let longest = 0;
  let streak = 0;

  // Walk backwards from today through the 14-day window
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getDayKey(d);

    if (activeDays.has(key)) {
      streak++;
      longest = Math.max(longest, streak);
      if (i === streak - 1) current = streak; // still counting from today
    } else {
      streak = 0;
    }
  }

  return { current, longest };
}

function detectRecurringTasks(rows: TaskRow[]): { text: string; daysAppeared: number; timesCompleted: number }[] {
  const taskMap = new Map<string, { days: Set<string>; completed: number }>();
  for (const row of rows) {
    const key = row.text.toLowerCase().trim();
    let entry = taskMap.get(key);
    if (!entry) {
      entry = { days: new Set(), completed: 0 };
      taskMap.set(key, entry);
    }
    entry.days.add(row.day);
    if (row.completed) entry.completed++;
  }

  return Array.from(taskMap.entries())
    .filter(([, v]) => v.days.size >= 3) // appeared on 3+ different days = habit
    .map(([text, v]) => ({
      text,
      daysAppeared: v.days.size,
      timesCompleted: v.completed,
    }))
    .sort((a, b) => b.daysAppeared - a.daysAppeared);
}

function computeDayOfWeekStats(daySummaries: DaySummary[]): Record<string, { avgRate: number; count: number }> {
  const weekdayData: Record<string, { totalRate: number; count: number }> = {};
  for (const d of daySummaries) {
    if (!weekdayData[d.weekday]) weekdayData[d.weekday] = { totalRate: 0, count: 0 };
    weekdayData[d.weekday].totalRate += d.completionRate;
    weekdayData[d.weekday].count++;
  }
  const result: Record<string, { avgRate: number; count: number }> = {};
  for (const [day, data] of Object.entries(weekdayData)) {
    result[day] = { avgRate: Math.round(data.totalRate / data.count), count: data.count };
  }
  return result;
}

function computeTrend(daySummaries: DaySummary[]): string {
  if (daySummaries.length < 4) return "not enough data";
  const mid = Math.floor(daySummaries.length / 2);
  const firstHalf = daySummaries.slice(0, mid);
  const secondHalf = daySummaries.slice(mid);
  const avgFirst = firstHalf.reduce((s, d) => s + d.completionRate, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, d) => s + d.completionRate, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;
  if (diff > 10) return "improving";
  if (diff < -10) return "declining";
  return "stable";
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI insights are not configured. ANTHROPIC_API_KEY is missing." },
        { status: 500 },
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const anonClient = getSupabaseAnonServerClient();
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    const cutoffDay = getDayKey(fourteenDaysAgo);

    const { data: tasks, error: taskError } = await anonClient
      .from("tasks")
      .select("text, completed, day, created_at")
      .eq("user_id", userData.user.id)
      .gte("day", cutoffDay)
      .order("day", { ascending: true });

    if (taskError) {
      return NextResponse.json({ error: "Failed to load tasks." }, { status: 500 });
    }

    const rows = (tasks ?? []) as TaskRow[];

    // Build per-day summaries with richer detail
    const dayMap = new Map<string, DaySummary>();
    for (const row of rows) {
      let summary = dayMap.get(row.day);
      if (!summary) {
        summary = {
          day: row.day,
          weekday: getWeekday(row.day),
          total: 0,
          completed: 0,
          completionRate: 0,
          completedTasks: [],
          incompleteTasks: [],
        };
        dayMap.set(row.day, summary);
      }
      summary.total += 1;
      if (row.completed) {
        summary.completed += 1;
        summary.completedTasks.push(row.text);
      } else {
        summary.incompleteTasks.push(row.text);
      }
    }
    for (const summary of dayMap.values()) {
      summary.completionRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
    }

    const daySummaries = Array.from(dayMap.values());

    if (daySummaries.length < 2) {
      return NextResponse.json(
        { error: "Not enough data yet. Use the app for a few more days to get AI insights." },
        { status: 400 },
      );
    }

    // Compute analytics
    const streaks = computeStreaks(daySummaries);
    const recurringTasks = detectRecurringTasks(rows);
    const dayOfWeekStats = computeDayOfWeekStats(daySummaries);
    const trend = computeTrend(daySummaries);
    const totalTasks = rows.length;
    const totalCompleted = rows.filter((r) => r.completed).length;
    const overallRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // Count days with zero tasks in the 14-day window
    let daysWithNoTasks = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDayKey(d);
      if (!dayMap.has(key)) daysWithNoTasks++;
    }

    // Build detailed daily log
    const dailyLog = daySummaries
      .map((d) => {
        let line = `${d.day} (${d.weekday}): ${d.completed}/${d.total} completed (${d.completionRate}%)`;
        if (d.completedTasks.length > 0) line += `\n  Done: ${d.completedTasks.join(", ")}`;
        if (d.incompleteTasks.length > 0) line += `\n  Skipped: ${d.incompleteTasks.join(", ")}`;
        return line;
      })
      .join("\n");

    // Build recurring tasks section
    const habitsSection = recurringTasks.length > 0
      ? `\nRecurring tasks (appeared 3+ days — likely habits):\n${recurringTasks
          .map((h) => `- "${h.text}": appeared ${h.daysAppeared} days, completed ${h.timesCompleted} times (${Math.round((h.timesCompleted / h.daysAppeared) * 100)}% adherence)`)
          .join("\n")}`
      : "\nNo recurring tasks detected (no task appeared on 3+ days).";

    // Build day-of-week section
    const dowSection = Object.entries(dayOfWeekStats)
      .map(([day, stats]) => `- ${day}: ${stats.avgRate}% avg completion (${stats.count} day${stats.count > 1 ? "s" : ""})`)
      .join("\n");

    const prompt = `You are a habit-building coach and productivity analyst. Analyze this user's task data from the last 14 days and provide actionable, personalized insights focused on helping them build consistent habits.

=== OVERVIEW ===
- Active days: ${daySummaries.length}/14 (${daysWithNoTasks} days with no tasks)
- Total tasks: ${totalTasks} created, ${totalCompleted} completed (${overallRate}% overall)
- Current streak: ${streaks.current} consecutive days
- Longest streak: ${streaks.longest} consecutive days
- Trend: ${trend} (comparing first half vs second half of the period)

=== DAILY LOG ===
${dailyLog}

=== DAY-OF-WEEK PATTERNS ===
${dowSection}
${habitsSection}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "great": ["insight 1", "insight 2"],
  "not_great": ["insight 1"],
  "improve": ["suggestion 1", "suggestion 2"]
}

Rules:
- "great": 2-3 specific things the user did well. Mention streaks, consistent habits, strong days, or improvement trends. Reference specific tasks or days.
- "not_great": 1-2 honest observations about gaps. Mention skipped days, dropped habits, declining patterns, or weak day-of-week patterns. Be specific.
- "improve": 2-3 actionable habit-building suggestions. Consider: habit stacking (pairing new habits with existing ones), starting smaller if tasks are frequently skipped, focusing on consistency over volume, strengthening weak days.
- Keep each insight to 1-2 sentences. Be warm but direct.
- If recurring tasks exist, analyze their adherence and give specific habit advice.
- If the trend is declining, address it directly with encouragement.
- Reference specific tasks, days, and numbers — never be vague.`;

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    let text = textBlock && "text" in textBlock ? textBlock.text : "";
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();

    const parsed: InsightsResponse = JSON.parse(text);

    if (!Array.isArray(parsed.great) || !Array.isArray(parsed.not_great) || !Array.isArray(parsed.improve)) {
      return NextResponse.json({ error: "Unexpected AI response format." }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

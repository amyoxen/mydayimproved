import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAnonServerClient } from "@/lib/supabase-server";

type DaySummary = {
  day: string;
  total: number;
  completed: number;
  incomplete: number;
  tasks: string[];
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
      .select("text, completed, day")
      .eq("user_id", userData.user.id)
      .gte("day", cutoffDay)
      .order("day", { ascending: true });

    if (taskError) {
      return NextResponse.json({ error: "Failed to load tasks." }, { status: 500 });
    }

    const rows = (tasks ?? []) as { text: string; completed: boolean; day: string }[];

    const dayMap = new Map<string, DaySummary>();
    for (const row of rows) {
      let summary = dayMap.get(row.day);
      if (!summary) {
        summary = { day: row.day, total: 0, completed: 0, incomplete: 0, tasks: [] };
        dayMap.set(row.day, summary);
      }
      summary.total += 1;
      if (row.completed) summary.completed += 1;
      else summary.incomplete += 1;
      summary.tasks.push(row.text);
    }

    const daySummaries = Array.from(dayMap.values());

    if (daySummaries.length < 2) {
      return NextResponse.json(
        { error: "Not enough data yet. Use the app for a few more days to get AI insights." },
        { status: 400 },
      );
    }

    const summaryText = daySummaries
      .map(
        (d) =>
          `${d.day}: ${d.completed}/${d.total} completed. Tasks: ${d.tasks.join(", ")}`,
      )
      .join("\n");

    const prompt = `You are a productivity coach. Analyze this user's task data from the last 14 days and provide insights.

Task data by day:
${summaryText}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "great": ["insight 1", "insight 2"],
  "not_great": ["insight 1", "insight 2"],
  "improve": ["suggestion 1", "suggestion 2"]
}

Rules:
- "great": 2-3 specific things the user did well (completion streaks, productive days, good task variety)
- "not_great": 1-2 areas that could be better (skipped days, low completion rates, patterns)
- "improve": 2-3 actionable suggestions for improvement
- Keep each insight to 1-2 sentences
- Be encouraging but honest
- Reference specific days or tasks when possible`;

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

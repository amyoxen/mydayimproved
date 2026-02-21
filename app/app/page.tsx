"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  day: string;
};

type TaskRow = {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  day: string;
};

type ConfettiPiece = {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  rotate: number;
  color: string;
};

function createStableId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const DAILY_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupery" },
  { text: "Do or do not. There is no try.", author: "Yoda" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "It is not enough to be busy. The question is: what are we busy about?", author: "Henry David Thoreau" },
  { text: "Time is what we want most, but what we use worst.", author: "William Penn" },
  { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Productivity is never an accident. It is always the result of a commitment to excellence.", author: "Paul J. Meyer" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Ordinary people think merely of spending time. Great people think of using it.", author: "Arthur Schopenhauer" },
  { text: "Don't wait. The time will never be just right.", author: "Napoleon Hill" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "The shorter way to do many things is to do only one thing at a time.", author: "Mozart" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "Amateurs sit and wait for inspiration. The rest of us just get up and go to work.", author: "Stephen King" },
  { text: "Plans are nothing; planning is everything.", author: "Dwight D. Eisenhower" },
  { text: "Time is the most valuable thing a man can spend.", author: "Theophrastus" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
];

type InsightsData = {
  great: string[];
  not_great: string[];
  improve: string[];
};

function SevenDayChart({
  dayStatsMap,
}: {
  dayStatsMap: Record<string, { total: number; completed: number }>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return getDayKey(d);
  });

  const dayData = days.map((key) => ({
    key,
    label: new Date(key + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" }),
    total: dayStatsMap[key]?.total ?? 0,
    completed: dayStatsMap[key]?.completed ?? 0,
  }));

  const maxVal = Math.max(...dayData.map((d) => Math.max(d.total, d.completed)), 1);
  const ySteps = maxVal <= 4 ? maxVal : 4;

  const svgWidth = 400;
  const svgHeight = 180;
  const paddingLeft = 28;
  const paddingRight = 8;
  const paddingBottom = 28;
  const paddingTop = 8;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingBottom - paddingTop;
  const groupWidth = chartWidth / 7;
  const barWidth = groupWidth * 0.3;
  const gap = 2;

  return (
    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full" role="img" aria-label="7-day task trends">
      {Array.from({ length: ySteps + 1 }, (_, i) => {
        const val = Math.round((maxVal / ySteps) * i);
        const y = paddingTop + chartHeight - (chartHeight * i) / ySteps;
        return (
          <g key={i}>
            <line x1={paddingLeft} y1={y} x2={svgWidth - paddingRight} y2={y} stroke="#e4e4e7" strokeWidth={0.5} />
            <text x={paddingLeft - 4} y={y + 3} textAnchor="end" className="fill-zinc-400 text-[8px]">
              {val}
            </text>
          </g>
        );
      })}
      {dayData.map((d, i) => {
        const groupX = paddingLeft + i * groupWidth;
        const barX = groupX + (groupWidth - 2 * barWidth - gap) / 2;
        const baseY = paddingTop + chartHeight;
        const totalH = maxVal > 0 ? (d.total / maxVal) * chartHeight : 0;
        const completedH = maxVal > 0 ? (d.completed / maxVal) * chartHeight : 0;
        return (
          <g key={d.key}>
            <rect x={barX} y={baseY - totalH} width={barWidth} height={totalH} rx={2} fill="#bae6fd" />
            <rect x={barX + barWidth + gap} y={baseY - completedH} width={barWidth} height={completedH} rx={2} fill="#0284c7" />
            <text x={groupX + groupWidth / 2} y={baseY + 14} textAnchor="middle" className="fill-zinc-500 text-[8px]">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CloudTodoPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [inputPulse, setInputPulse] = useState(false);
  const [addArmstrong, setAddArmstrong] = useState(false);
  const [newTaskPulseId, setNewTaskPulseId] = useState<string | null>(null);
  const [completedPulseIds, setCompletedPulseIds] = useState<string[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const loadTasks = useCallback(async (uid: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("id,text,completed,created_at,day")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) return;

    const rows = (data ?? []) as TaskRow[];
    const mapped: Todo[] = rows.map((row) => ({
      id: row.id,
      text: row.text,
      completed: row.completed,
      createdAt: row.created_at,
      day: row.day,
    }));

    setTodos(mapped);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      if (!sessionUser) {
        router.push("/login");
        return;
      }

      setUserId(sessionUser.id);
      await loadTasks(sessionUser.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", sessionUser.id)
        .single<{ is_admin: boolean }>();
      setIsAdmin(Boolean(profile?.is_admin));
      setLoading(false);
    };

    void init();

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push("/login");
      }
    });

    return () => {
      authSubscription.unsubscribe();
    };
  }, [loadTasks, router]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`tasks-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log("[Realtime] postgres_changes received:", payload);
          void loadTasks(userId);
        },
      )
      .subscribe((status) => {
        console.log("[Realtime] subscription status:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTasks, userId]);

  const todayKey = useMemo(() => getDayKey(), []);
  const myDayTodos = useMemo(() => {
    return todos
      .filter((todo) => todo.day === todayKey)
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [todos, todayKey]);
  const archiveCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getDayKey(d);
  }, []);
  const archiveTodos = useMemo(
    () => todos.filter((todo) => todo.day !== todayKey && todo.day >= archiveCutoff),
    [todos, todayKey, archiveCutoff],
  );
  const remainingCount = useMemo(() => myDayTodos.filter((todo) => !todo.completed).length, [myDayTodos]);
  const groupedArchive = useMemo(() => {
    return archiveTodos.reduce<Record<string, Todo[]>>((groups, todo) => {
      groups[todo.day] ??= [];
      groups[todo.day].push(todo);
      return groups;
    }, {});
  }, [archiveTodos]);

  const archiveDays = useMemo(() => Object.keys(groupedArchive).sort((a, b) => b.localeCompare(a)), [groupedArchive]);

  const dayStatsMap = useMemo(() => {
    return todos.reduce<Record<string, { total: number; completed: number }>>((acc, todo) => {
      acc[todo.day] ??= { total: 0, completed: 0 };
      acc[todo.day].total += 1;
      if (todo.completed) acc[todo.day].completed += 1;
      return acc;
    }, {});
  }, [todos]);

  const triggerInputPulse = () => {
    setInputPulse(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setInputPulse(true);
        window.setTimeout(() => setInputPulse(false), 550);
      });
    });
  };

  const triggerAddArmstrong = () => {
    setAddArmstrong(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setAddArmstrong(true);
        window.setTimeout(() => setAddArmstrong(false), 750);
      });
    });
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const AudioContextClass =
      window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  };

  const playTone = (ctx: AudioContext, freq: number, start: number, duration: number, volume: number, type: OscillatorType = "sine") => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.setValueAtTime(volume, start + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const playAddSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Warm ascending major third (C5 → E5) with gentle sustain
    playTone(ctx, 523, now, 0.45, 0.09);          // C5
    playTone(ctx, 523 * 2, now, 0.3, 0.03);       // C6 harmonic
    playTone(ctx, 659, now + 0.15, 0.55, 0.1);    // E5
    playTone(ctx, 659 * 2, now + 0.15, 0.35, 0.03); // E6 harmonic
  };

  const playCompleteSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Uplifting major chord arpeggio (C5 → E5 → G5 → C6)
    playTone(ctx, 523, now, 0.5, 0.08);             // C5
    playTone(ctx, 659, now + 0.12, 0.55, 0.09);     // E5
    playTone(ctx, 784, now + 0.24, 0.6, 0.1);       // G5
    playTone(ctx, 1047, now + 0.36, 0.7, 0.08);     // C6
    // Soft pad underneath for warmth
    playTone(ctx, 523, now + 0.1, 0.9, 0.04, "triangle");  // C5 pad
    playTone(ctx, 784, now + 0.2, 0.8, 0.03, "triangle");  // G5 pad
  };

  const triggerConfetti = (x: number, y: number, count = 26) => {
    const colors = ["#3b82f6", "#60a5fa", "#38bdf8", "#22d3ee", "#0ea5e9", "#7dd3fc"];
    const batchId = createStableId();
    const pieces: ConfettiPiece[] = Array.from({ length: count }, (_, index) => ({
      id: `${batchId}-${index}`,
      x,
      y,
      dx: Math.random() * 240 - 120,
      dy: Math.random() * -220 - 60,
      size: Math.random() * 8 + 6,
      rotate: Math.random() * 540 - 270,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setConfettiPieces((prev) => [...prev, ...pieces]);
    window.setTimeout(() => {
      setConfettiPieces((prev) => prev.filter((piece) => !piece.id.startsWith(batchId)));
    }, 1100);
  };

  const triggerConfettiFromElement = (element: HTMLElement | null, count?: number) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, count);
  };

  const handleAddTodo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;

    const text = input.trim();
    if (!text) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        text,
        completed: false,
        day: todayKey,
      })
      .select("id")
      .single<{ id: string }>();

    if (error) return;

    await loadTasks(userId);
    setNewTaskPulseId(data.id);
    window.setTimeout(() => setNewTaskPulseId((current) => (current === data.id ? null : current)), 650);
    triggerAddArmstrong();
    playAddSound();
    setInput("");
    inputRef.current?.focus();
  };

  const toggleTodo = async (id: string, source?: HTMLElement | null) => {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;

    const supabase = getSupabaseClient();
    const completedNow = !target.completed;
    await supabase.from("tasks").update({ completed: completedNow }).eq("id", id);
    if (userId) {
      await loadTasks(userId);
    }

    if (completedNow) {
      setCompletedPulseIds((prev) => [...prev, id]);
      window.setTimeout(() => {
        setCompletedPulseIds((prev) => prev.filter((pulseId) => pulseId !== id));
      }, 700);
      triggerConfettiFromElement(source ?? null, 20);
      playCompleteSound();
    }
  };

  const deleteTodo = async (id: string) => {
    const supabase = getSupabaseClient();
    await supabase.from("tasks").delete().eq("id", id);
    if (userId) {
      await loadTasks(userId);
    }
  };

  const clearCompleted = async () => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    await supabase.from("tasks").delete().eq("user_id", userId).eq("day", todayKey).eq("completed", true);
    await loadTasks(userId);
  };

  const addFromArchiveToMyDay = async (text: string) => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    await supabase.from("tasks").insert({
      user_id: userId,
      text,
      completed: false,
      day: todayKey,
    });
    await loadTasks(userId);
  };

  const logout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const fetchInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to get insights");
      }

      const result = await res.json();
      setInsights(result);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInsightsLoading(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-sky-50 p-6">Loading your cloud tasks...</main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-100 to-cyan-100 p-3 text-zinc-900 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-sky-100 backdrop-blur sm:p-5 md:h-[85vh] md:overflow-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="mt-1 text-2xl font-semibold">My Day</h1>
              <p className="text-sm text-zinc-600">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex gap-2">
              {isAdmin ? (
                <Link href="/admin" className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50">
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50"
              >
                Sign out
              </button>
            </div>
          </div>

          {(() => {
            const dayStr = getDayKey();
            const seed = dayStr.split("").reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 0);
            const quote = DAILY_QUOTES[((seed % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length];
            return (
              <p className="mt-2 text-lg italic text-zinc-500">
                &ldquo;{quote.text}&rdquo;
                <span className="ml-1 text-base not-italic text-zinc-400">
                  &mdash; {quote.author}
                </span>
              </p>
            );
          })()}

          <form onSubmit={handleAddTodo} className="mt-4">
            <label htmlFor="todo-input" className="sr-only">
              Add a task to My Day
            </label>
            <input
              id="todo-input"
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={triggerInputPulse}
              onClick={triggerInputPulse}
              placeholder="Add a task to My Day"
              className={`w-full rounded-xl border border-sky-200 bg-white px-4 py-3 text-base outline-none ring-offset-2 focus:ring-2 focus:ring-sky-400 ${inputPulse ? "input-bloom" : ""} ${addArmstrong ? "armstrong-add-glow" : ""}`}
            />
            <div className="mt-3 flex items-center justify-between text-sm text-zinc-600">
              <p>{remainingCount} remaining</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="min-h-10 rounded-lg border border-sky-200 px-3 py-1.5 hover:bg-sky-50"
                >
                  Clear completed
                </button>
                <button
                  ref={addButtonRef}
                  type="submit"
                  className={`min-h-10 rounded-lg px-3 py-1.5 font-semibold text-white transition-all ${input.trim() ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-300"} ${addArmstrong ? "armstrong-add-kick" : ""}`}
                >
                  Add
                </button>
              </div>
            </div>
          </form>

          <ul className="mt-4 min-h-[26rem] space-y-2" aria-label="My Day tasks">
            {myDayTodos.length === 0 ? (
              <li className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
                My Day is clear. Add your first task.
              </li>
            ) : (
              myDayTodos.map((todo) => (
                <li
                  key={todo.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-white p-3 shadow-sm ${newTaskPulseId === todo.id ? "task-added" : ""} ${completedPulseIds.includes(todo.id) ? "task-completed" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      id={`todo-${todo.id}`}
                      type="checkbox"
                      checked={todo.completed}
                      onChange={(event) => void toggleTodo(todo.id, event.currentTarget)}
                      aria-label={`Mark ${todo.text} as ${todo.completed ? "incomplete" : "complete"}`}
                      className="h-5 w-5 accent-sky-600"
                    />
                    <label
                      htmlFor={`todo-${todo.id}`}
                      className={`break-words ${todo.completed ? "text-zinc-400 line-through" : "text-zinc-800"}`}
                    >
                      {todo.text}
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteTodo(todo.id)}
                    className="min-h-10 rounded-lg border border-sky-200 px-3 py-1 text-sm hover:bg-sky-50"
                  >
                    Delete
                  </button>
                </li>
              ))
            )}
          </ul>

          <section className="mt-7 rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50 to-cyan-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">7-Day Trends</p>
            <div className="mt-3">
              <SevenDayChart dayStatsMap={dayStatsMap} />
            </div>
            <div className="mt-2 flex items-center gap-4 text-xs text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#bae6fd" }} />
                Created
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#0284c7" }} />
                Completed
              </span>
            </div>
          </section>

          <section className="mt-7 rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50 to-cyan-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">AI Insights</p>
              <button
                type="button"
                onClick={() => void fetchInsights()}
                disabled={insightsLoading}
                className="rounded-lg border border-sky-200 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50 disabled:opacity-60"
              >
                {insightsLoading ? "Analyzing..." : insights ? "Refresh" : "Get Insights"}
              </button>
            </div>

            {insightsError && (
              <p className="mt-3 text-sm text-red-600">{insightsError}</p>
            )}

            {insightsLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
                Analyzing your task patterns...
              </div>
            )}

            {insights && !insightsLoading && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-700">What you did great</p>
                  <ul className="mt-2 space-y-1">
                    {insights.great.map((item, i) => (
                      <li key={i} className="text-sm text-emerald-800">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-amber-700">Not so great</p>
                  <ul className="mt-2 space-y-1">
                    {insights.not_great.map((item, i) => (
                      <li key={i} className="text-sm text-amber-800">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-sm font-semibold text-sky-700">Things to improve</p>
                  <ul className="mt-2 space-y-1">
                    {insights.improve.map((item, i) => (
                      <li key={i} className="text-sm text-sky-800">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {!insights && !insightsLoading && !insightsError && (
              <p className="mt-3 text-sm text-zinc-500">
                Click &quot;Get Insights&quot; to get an AI-powered analysis of your task patterns.
              </p>
            )}
          </section>

          <section className="mt-7">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Archive</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Tasks from previous days are archived automatically. Click one to add it back to My Day.
            </p>

            <div className="mt-3 space-y-4">
              {archiveDays.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                  No archived tasks yet.
                </div>
              ) : (
                archiveDays.map((day) => (
                  <div key={day} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <h3 className="text-sm font-semibold">{formatDayLabel(day)}</h3>
                    <ul className="mt-2 space-y-2" aria-label={`Archived tasks for ${formatDayLabel(day)}`}>
                      {groupedArchive[day].map((todo) => (
                        <li key={todo.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2">
                          <p className={`text-sm ${todo.completed ? "text-zinc-400 line-through" : "text-zinc-700"}`}>
                            {todo.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => void addFromArchiveToMyDay(todo.text)}
                            className="min-h-9 rounded-md border border-sky-300 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                          >
                            Add to My Day
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className="confetti-piece"
            style={
              {
                left: `${piece.x}px`,
                top: `${piece.y}px`,
                width: `${piece.size}px`,
                height: `${piece.size * 0.55}px`,
                backgroundColor: piece.color,
                "--confetti-dx": `${piece.dx}px`,
                "--confetti-dy": `${piece.dy}px`,
                "--confetti-rotate": `${piece.rotate}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </main>
  );
}

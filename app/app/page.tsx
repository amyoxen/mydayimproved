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

function ActivityRing({
  value,
  radius,
  color,
  trackColor,
  strokeWidth,
}: {
  value: number;
  radius: number;
  color: string;
  trackColor: string;
  strokeWidth: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  return (
    <>
      <circle cx="60" cy="60" r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
    </>
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

    const mapped: Todo[] = (data ?? []).map((row) => ({
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
        () => {
          void loadTasks(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTasks, userId]);

  const todayKey = useMemo(() => getDayKey(), []);
  const myDayTodos = useMemo(() => todos.filter((todo) => todo.day === todayKey), [todos, todayKey]);
  const archiveTodos = useMemo(() => todos.filter((todo) => todo.day !== todayKey), [todos, todayKey]);
  const remainingCount = useMemo(() => myDayTodos.filter((todo) => !todo.completed).length, [myDayTodos]);
  const completedCount = myDayTodos.length - remainingCount;
  const dailyCompletionPct = myDayTodos.length ? Math.round((completedCount / myDayTodos.length) * 100) : 0;

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

  const consistencyPct = useMemo(() => {
    const recentKeys = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      return getDayKey(date);
    });

    const hitDays = recentKeys.filter((key) => {
      const stats = dayStatsMap[key];
      if (!stats || stats.total === 0) return false;
      return stats.completed / stats.total >= 0.7;
    }).length;

    return Math.round((hitDays / recentKeys.length) * 100);
  }, [dayStatsMap]);

  const volumePct = Math.min(Math.round((completedCount / 6) * 100), 100);

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

  const playAddSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const partials = [
      { freq: 1046, gain: 0.12, decay: 0.32 },
      { freq: 1568, gain: 0.06, decay: 0.26 },
      { freq: 2093, gain: 0.035, decay: 0.2 },
    ];

    partials.forEach(({ freq, gain: level, decay }) => {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + decay + 0.02);
    });
  };

  const playCompleteSound = () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dingTimes = [0, 0.18];

    dingTimes.forEach((offset, ringIndex) => {
      const start = now + offset;
      const boost = ringIndex === 1 ? 1.08 : 1;
      const partials = [
        { freq: 1318 * boost, gain: 0.14, decay: 0.35 },
        { freq: 1975 * boost, gain: 0.08, decay: 0.28 },
        { freq: 2637 * boost, gain: 0.045, decay: 0.22 },
      ];

      partials.forEach(({ freq, gain: level, decay }) => {
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        gain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        osc.connect(gain);
        osc.start(start);
        osc.stop(start + decay + 0.02);
      });
    });
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

          <form onSubmit={handleAddTodo} className="mt-4 flex gap-2">
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
              className={`flex-1 rounded-xl border border-sky-200 bg-white px-4 py-3 text-base outline-none ring-offset-2 focus:ring-2 focus:ring-sky-400 ${inputPulse ? "input-bloom" : ""} ${addArmstrong ? "armstrong-add-glow" : ""}`}
            />
            <button
              ref={addButtonRef}
              type="submit"
              className={`min-h-12 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white transition-transform hover:scale-[1.03] hover:bg-sky-500 sm:px-5 ${addArmstrong ? "armstrong-add-kick" : ""}`}
            >
              Add
            </button>
          </form>

          <div className="mt-3 flex items-center justify-between text-sm text-zinc-600">
            <p>{remainingCount} remaining</p>
            <button
              type="button"
              onClick={clearCompleted}
              className="min-h-10 rounded-lg border border-sky-200 px-3 py-1.5 hover:bg-sky-50"
            >
              Clear completed
            </button>
          </div>

          <ul className="mt-4 space-y-2" aria-label="My Day tasks">
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
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Activity Rings</p>
            <div className="mt-3 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="h-48 w-48" role="img" aria-label="Daily progress rings">
                <ActivityRing value={dailyCompletionPct} radius={44} color="#0284c7" trackColor="#dbeafe" strokeWidth={10} />
                <ActivityRing value={consistencyPct} radius={31} color="#06b6d4" trackColor="#cffafe" strokeWidth={10} />
                <ActivityRing value={volumePct} radius={18} color="#0d9488" trackColor="#ccfbf1" strokeWidth={10} />
                <text x="60" y="57" textAnchor="middle" className="fill-sky-800 text-[14px] font-semibold">
                  {dailyCompletionPct}%
                </text>
                <text x="60" y="73" textAnchor="middle" className="fill-sky-600 text-[9px]">
                  complete
                </text>
              </svg>
            </div>
            <div className="mt-2 space-y-1 text-xs text-zinc-700">
              <p>
                <span className="font-semibold text-sky-700">Move:</span> Today&apos;s task completion {dailyCompletionPct}%
              </p>
              <p>
                <span className="font-semibold text-cyan-700">Exercise:</span> 7-day consistency {consistencyPct}%
              </p>
              <p>
                <span className="font-semibold text-teal-700">Stand:</span> Task volume goal {volumePct}%
              </p>
            </div>
            <p className="mt-3 text-sm text-zinc-700">
              {completedCount} completed of {myDayTodos.length || 0} today.
            </p>
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

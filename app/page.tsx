"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  day: string;
};

const STORAGE_KEY = "todo-app.todos";

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
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
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

export default function Home() {
  const [input, setInput] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [inputPulse, setInputPulse] = useState(false);
  const [addArmstrong, setAddArmstrong] = useState(false);
  const [newTaskPulseId, setNewTaskPulseId] = useState<string | null>(null);
  const [completedPulseIds, setCompletedPulseIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Array<
        Partial<Todo> & { id: unknown; text: unknown; completed: unknown; createdAt: unknown; day?: unknown }
      >;
      if (Array.isArray(parsed)) {
        const safeTodos: Todo[] = parsed
          .filter((todo) => {
            return (
              typeof todo?.id === "string" &&
              typeof todo?.text === "string" &&
              typeof todo?.completed === "boolean" &&
              typeof todo?.createdAt === "string"
            );
          })
          .map((todo) => ({
            id: todo.id as string,
            text: todo.text as string,
            completed: todo.completed as boolean,
            createdAt: todo.createdAt as string,
            day:
              typeof todo.day === "string"
                ? todo.day
                : getDayKey(new Date(todo.createdAt as string)),
          }));
        setTodos(safeTodos);
      }
    } catch {
      setTodos([]);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos, hydrated]);

  const todayKey = useMemo(() => getDayKey(), []);
  const myDayTodos = useMemo(() => todos.filter((todo) => todo.day === todayKey), [todos, todayKey]);
  const archiveTodos = useMemo(() => todos.filter((todo) => todo.day !== todayKey), [todos, todayKey]);
  const remainingCount = useMemo(
    () => myDayTodos.filter((todo) => !todo.completed).length,
    [myDayTodos],
  );
  const completedCount = myDayTodos.length - remainingCount;
  const dailyCompletionPct = myDayTodos.length
    ? Math.round((completedCount / myDayTodos.length) * 100)
    : 0;

  const groupedArchive = useMemo(() => {
    return archiveTodos.reduce<Record<string, Todo[]>>((groups, todo) => {
      groups[todo.day] ??= [];
      groups[todo.day].push(todo);
      return groups;
    }, {});
  }, [archiveTodos]);

  const archiveDays = useMemo(
    () =>
      Object.keys(groupedArchive).sort((a, b) => {
        return b.localeCompare(a);
      }),
    [groupedArchive],
  );

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

  const triggerConfetti = (x: number, y: number, count = 26) => {
    const colors = ["#0284c7", "#06b6d4", "#14b8a6", "#0ea5e9", "#38bdf8", "#2dd4bf"];
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

  const handleAddTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = input.trim();
    if (!text) return;

    const newTodo: Todo = {
      id: createStableId(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      day: todayKey,
    };

    setTodos((prev) => [newTodo, ...prev]);
    setNewTaskPulseId(newTodo.id);
    window.setTimeout(() => setNewTaskPulseId((current) => (current === newTodo.id ? null : current)), 650);
    triggerAddArmstrong();
    setInput("");
    inputRef.current?.focus();
  };

  const toggleTodo = (id: string, source?: HTMLElement | null) => {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;
    const completedNow = !target.completed;

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
    );

    if (completedNow) {
      setCompletedPulseIds((prev) => [...prev, id]);
      window.setTimeout(() => {
        setCompletedPulseIds((prev) => prev.filter((pulseId) => pulseId !== id));
      }, 700);
      triggerConfettiFromElement(source ?? null, 20);
    }
  };

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos((prev) => prev.filter((todo) => !(todo.day === todayKey && todo.completed)));
  };

  const addFromArchiveToMyDay = (text: string) => {
    const newTodo: Todo = {
      id: createStableId(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      day: todayKey,
    };
    setTodos((prev) => [newTodo, ...prev]);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-500 via-cyan-500 to-teal-500 p-3 text-zinc-900 sm:p-4 md:p-8">
      <div className="mx-auto w-full max-w-4xl">
        <section className="rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-white/40 backdrop-blur sm:p-5 md:h-[85vh] md:overflow-auto">
          <h1 className="mt-1 text-2xl font-semibold">My Day</h1>
          <p className="text-sm text-zinc-600">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>

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
              className={`flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none ring-offset-2 focus:ring-2 focus:ring-sky-400 ${inputPulse ? "input-bloom" : ""} ${addArmstrong ? "armstrong-add-glow" : ""}`}
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
              className="min-h-10 rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100"
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
                  className={`flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm ${newTaskPulseId === todo.id ? "task-added" : ""} ${completedPulseIds.includes(todo.id) ? "task-completed" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      id={`todo-${todo.id}`}
                      type="checkbox"
                      checked={todo.completed}
                      onChange={(event) => toggleTodo(todo.id, event.currentTarget)}
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
                    onClick={() => deleteTodo(todo.id)}
                    className="min-h-10 rounded-lg border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100"
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
                <ActivityRing
                  value={dailyCompletionPct}
                  radius={44}
                  color="#0284c7"
                  trackColor="#dbeafe"
                  strokeWidth={10}
                />
                <ActivityRing
                  value={consistencyPct}
                  radius={31}
                  color="#06b6d4"
                  trackColor="#cffafe"
                  strokeWidth={10}
                />
                <ActivityRing
                  value={volumePct}
                  radius={18}
                  color="#0d9488"
                  trackColor="#ccfbf1"
                  strokeWidth={10}
                />
                <text
                  x="60"
                  y="57"
                  textAnchor="middle"
                  className="fill-sky-800 text-[14px] font-semibold"
                >
                  {dailyCompletionPct}%
                </text>
                <text x="60" y="73" textAnchor="middle" className="fill-sky-600 text-[9px]">
                  complete
                </text>
              </svg>
            </div>
            <div className="mt-2 space-y-1 text-xs text-zinc-700">
              <p><span className="font-semibold text-sky-700">Move:</span> Today&apos;s task completion {dailyCompletionPct}%</p>
              <p><span className="font-semibold text-cyan-700">Exercise:</span> 7-day consistency {consistencyPct}%</p>
              <p><span className="font-semibold text-teal-700">Stand:</span> Task volume goal {volumePct}%</p>
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
                            onClick={() => addFromArchiveToMyDay(todo.text)}
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

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-100 to-cyan-100 px-6 py-12 text-zinc-900">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 rounded-3xl border border-sky-100 bg-white/90 p-8 shadow-xl md:flex-row md:items-center md:justify-between md:p-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">Cloud Task Planner</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-zinc-900 md:text-5xl">
            Stay on top of daily tasks with cloud sync.
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Sign in to manage your day from any device. Administrators can create user accounts and every user gets
            their own synced task workspace.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-sky-600 px-5 py-3 font-semibold text-white transition hover:bg-sky-500"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="rounded-xl border border-sky-200 bg-white px-5 py-3 font-semibold text-sky-700 transition hover:bg-sky-50"
            >
              Open My Day
            </Link>
            <Link
              href="/admin"
              className="rounded-xl border border-sky-200 bg-white px-5 py-3 font-semibold text-sky-700 transition hover:bg-sky-50"
            >
              Admin
            </Link>
          </div>
        </div>

        <div className="grid w-full max-w-sm gap-3 rounded-2xl border border-sky-100 bg-sky-50/80 p-5">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Sync</p>
            <p className="text-2xl font-semibold text-zinc-900">Cloud-backed tasks</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Access</p>
            <p className="text-2xl font-semibold text-zinc-900">User + Admin roles</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-zinc-500">Focus</p>
            <p className="text-2xl font-semibold text-zinc-900">Daily completion tracking</p>
          </div>
        </div>
      </section>
    </main>
  );
}

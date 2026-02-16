import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-100 to-cyan-100 text-zinc-900">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-bold tracking-tight text-zinc-900">My Day</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-zinc-600 transition hover:text-zinc-900">
            Sign in
          </Link>
          <Link
            href="/app"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center md:pt-32">
        <p className="inline-block rounded-full border border-sky-600/30 bg-sky-600/10 px-4 py-1.5 text-sm font-medium text-sky-700">
          AI-Powered Productivity
        </p>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-zinc-900 md:text-6xl">
          Get more done,<br />
          <span className="text-sky-600">every single day.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
          Track your daily tasks, visualize your progress over time, and get
          AI-powered insights to continuously improve your productivity.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/app"
            className="rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-500"
          >
            Start Your Day
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-sky-300 bg-white/80 px-6 py-3 text-base font-semibold text-sky-700 transition hover:bg-white"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-sky-200 bg-white/80 p-6 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
              <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-zinc-900">10-Day Trends</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Visualize your task creation and completion over the last 10 days with clear bar charts.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white/80 p-6 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
              <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-zinc-900">AI Insights</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Get personalized feedback on what you did great, what needs work, and how to improve.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white/80 p-6 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
              <svg className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-zinc-900">Daily Focus</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Plan your day, check off tasks, and stay motivated with daily quotes from great minds.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-sky-200 py-8 text-center text-sm text-zinc-500">
        My Day &middot; Built for getting things done.
      </footer>
    </main>
  );
}

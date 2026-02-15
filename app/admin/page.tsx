"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";

type Profile = {
  is_admin: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single<Profile>();

      setAuthorized(Boolean(profile?.is_admin));
      setLoading(false);
    };

    void checkAuth();
  }, [router]);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setError("No active session found.");
        return;
      }

      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          isAdmin: makeAdmin,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Failed to create user.");
        return;
      }

      setStatus(payload.message ?? "User created.");
      setEmail("");
      setPassword("");
      setMakeAdmin(false);
    } catch {
      setError("Unexpected error while creating user.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-sky-50 p-6">Loading...</main>;
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-sky-50 p-6">
        <section className="mx-auto w-full max-w-xl rounded-2xl border border-sky-100 bg-white p-6 shadow-lg">
          <h1 className="text-2xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-zinc-600">Your account is not marked as administrator.</p>
          <div className="mt-5 flex gap-3">
            <Link href="/app" className="rounded-lg bg-sky-600 px-4 py-2 text-white">Go to My Day</Link>
            <Link href="/" className="rounded-lg border border-sky-200 px-4 py-2 text-sky-700">Home</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-100 via-sky-100 to-cyan-100 px-4 py-10">
      <section className="mx-auto w-full max-w-xl rounded-2xl border border-sky-100 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Administrator</h1>
            <p className="mt-1 text-sm text-zinc-600">Create new user accounts for this app.</p>
          </div>
          <Link href="/app" className="rounded-lg border border-sky-200 px-3 py-2 text-sm text-sky-700 hover:bg-sky-50">
            Back to My Day
          </Link>
        </div>

        <form onSubmit={handleCreateUser} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-email" className="mb-1 block text-sm font-medium text-zinc-700">
              User email
            </label>
            <input
              id="new-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-sky-200 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-zinc-700">
              Temporary password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-sky-200 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={(event) => setMakeAdmin(event.target.checked)}
              className="h-4 w-4 accent-sky-600"
            />
            Grant administrator access
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {status ? <p className="text-sm text-emerald-700">{status}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-sky-600 px-4 py-2.5 font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
          >
            {submitting ? "Creating user..." : "Create user"}
          </button>
        </form>
      </section>
    </main>
  );
}

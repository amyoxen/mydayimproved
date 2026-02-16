import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAnonServerClient, getSupabaseServiceClient } from "@/lib/supabase-server";

type RequestBody = {
  email?: string;
  password?: string;
  isAdmin?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const isAdmin = Boolean(body.isAdmin);

    if (!email || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (at least 8 characters) are required." },
        { status: 400 },
      );
    }

    const anonClient = getSupabaseAnonServerClient();
    const serviceClient = getSupabaseServiceClient();

    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid session token." }, { status: 401 });
    }

    const { data: adminProfile, error: adminProfileError } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single<{ is_admin: boolean }>();

    if (adminProfileError || !adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      return NextResponse.json({ error: createError?.message ?? "Failed to create user." }, { status: 400 });
    }

    const { error: profileError } = await serviceClient.from("profiles").upsert({
      id: created.user.id,
      email,
      is_admin: isAdmin,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "User created successfully." });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

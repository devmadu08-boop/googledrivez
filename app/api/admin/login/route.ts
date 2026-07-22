import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, createAdminSession, verifyAdminPassword } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/access-store";

export async function POST(request: NextRequest) {
  try {
    const requestHeaders = await headers();
    const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`admin:${clientIp}`, 5, 60 * 10))) {
      return NextResponse.json({ error: "Too many login attempts. Try again in 10 minutes." }, { status: 429 });
    }
    const body = (await request.json()) as { password?: string };
    if (!body.password || !verifyAdminPassword(body.password)) {
      return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
    }
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Admin login is unavailable." }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, "", { ...adminCookieOptions, maxAge: 0 });
  return response;
}

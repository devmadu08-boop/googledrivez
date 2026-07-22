import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { listAccessRequests, visibleAccessRequest } from "@/lib/access-store";

export async function GET() {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const requests = (await listAccessRequests()).map(visibleAccessRequest);
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load requests." }, { status: 503 });
  }
}

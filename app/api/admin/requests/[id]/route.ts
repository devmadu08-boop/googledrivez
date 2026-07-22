import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/admin-auth";
import { reviewAccessRequest, visibleAccessRequest } from "@/lib/access-store";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { status?: "accepted" | "rejected" };
    if (body.status !== "accepted" && body.status !== "rejected") {
      return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
    }
    const { id } = await context.params;
    const updated = await reviewAccessRequest(id, body.status);
    if (!updated) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    return NextResponse.json({ request: visibleAccessRequest(updated) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not review request." }, { status: 503 });
  }
}

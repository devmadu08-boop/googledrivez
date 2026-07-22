import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, createAccessRequest, getDeviceRequest, hashDeviceToken, newDeviceToken } from "@/lib/access-store";

const DEVICE_COOKIE = "pixvault_device";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  try {
    const fileId = request.nextUrl.searchParams.get("fileId")?.slice(0, 120);
    const cookieStore = await cookies();
    const deviceToken = cookieStore.get(DEVICE_COOKIE)?.value;
    if (!fileId || !deviceToken) return NextResponse.json({ status: "none" });
    const record = await getDeviceRequest(hashDeviceToken(deviceToken), fileId);
    return NextResponse.json({ status: record?.status ?? "none", email: record?.email ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check access." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; note?: string; fileId?: string; fileName?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const note = body.note?.trim() ?? "";
    const fileId = body.fileId?.trim().slice(0, 120) ?? "";
    const fileName = body.fileName?.trim().slice(0, 180) ?? "";
    if (!emailPattern.test(email) || !fileId || !fileName) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (note.length > 500) return NextResponse.json({ error: "Your note must be 500 characters or less." }, { status: 400 });

    const requestHeaders = await headers();
    const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`access:${clientIp}`, 10, 60 * 60))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const cookieStore = await cookies();
    const existingToken = cookieStore.get(DEVICE_COOKIE)?.value;
    const deviceToken = existingToken || newDeviceToken();
    const record = await createAccessRequest({ email, note, fileId, fileName, deviceHash: hashDeviceToken(deviceToken) });
    const response = NextResponse.json({ status: record.status, email: record.email }, { status: 201 });
    if (!existingToken) {
      response.cookies.set(DEVICE_COOKIE, deviceToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 90,
      });
    }
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit the request." }, { status: 503 });
  }
}

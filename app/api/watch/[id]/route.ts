import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDeviceRequest, hashDeviceToken } from "@/lib/access-store";

const DEVICE_COOKIE = "pixvault_device";

type StoredRecord = {
  id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  data: string;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^[a-zA-Z0-9-]{1,120}$/.test(id)) return NextResponse.json({ error: "Invalid file." }, { status: 400 });
    const cookieStore = await cookies();
    const deviceToken = cookieStore.get(DEVICE_COOKIE)?.value;
    if (!deviceToken) return NextResponse.json({ error: "Access approval is required." }, { status: 403 });
    const access = await getDeviceRequest(hashDeviceToken(deviceToken), id);
    if (access?.status !== "accepted") return NextResponse.json({ error: "This access request has not been accepted yet." }, { status: 403 });

    if (id.startsWith("demo-")) {
      return NextResponse.json({ demo: true, displayName: access.fileName });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    if (!token || !owner || !repo) return NextResponse.json({ error: "GitHub storage is not configured." }, { status: 503 });

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/storage/${id}.json?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "The stored media file could not be loaded." }, { status: response.status === 404 ? 404 : 502 });
    const payload = (await response.json()) as { content?: string };
    if (!payload.content) return NextResponse.json({ error: "The stored media data is missing." }, { status: 502 });
    const record = JSON.parse(Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8")) as StoredRecord;
    return NextResponse.json({
      displayName: record.displayName,
      originalName: record.originalName,
      src: `data:${record.mimeType};base64,${record.data}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The media could not be opened." }, { status: 503 });
  }
}

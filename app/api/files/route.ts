import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

type GitHubFile = { name: string; path: string; download_url: string | null; type: string };
type StoredRecord = {
  id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  encoding: string;
  data: string;
};
type StoredMetadata = Omit<StoredRecord, "encoding" | "data">;
type UploadBody = { name?: string; type?: string; size?: number; data?: string };
type GitHubError = { message?: string };

const getConfig = () => ({
  token: process.env.GITHUB_TOKEN,
  owner: process.env.GITHUB_OWNER,
  repo: process.env.GITHUB_REPO,
  branch: process.env.GITHUB_BRANCH || "main",
});

const githubHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

const encodeUtf8 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 16_384));
  }
  return btoa(binary);
};

const safeBaseName = (name: string) => {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
};

export async function GET() {
  const config = getConfig();
  if (!config.token || !config.owner || !config.repo) {
    return NextResponse.json({ configured: false, files: [] });
  }

  const directoryUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/storage?ref=${encodeURIComponent(config.branch)}`;
  const directoryResponse = await fetch(directoryUrl, { headers: githubHeaders(config.token), cache: "no-store" });
  if (directoryResponse.status === 404) return NextResponse.json({ configured: true, files: [] });
  if (!directoryResponse.ok) return NextResponse.json({ error: "Could not read the GitHub storage folder." }, { status: 502 });

  const entries = (await directoryResponse.json()) as GitHubFile[];
  const records = await Promise.all(
    entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".json") && entry.download_url).map(async (entry) => {
      const response = await fetch(entry.download_url!, { cache: "no-store" });
      if (!response.ok) return null;
      const record = (await response.json()) as StoredRecord;
      const metadata: StoredMetadata = {
        id: record.id,
        originalName: record.originalName,
        displayName: record.displayName,
        mimeType: record.mimeType,
        size: record.size,
        uploadedAt: record.uploadedAt,
      };
      return metadata;
    }),
  );

  return NextResponse.json({
    configured: true,
    files: records
      .filter((record): record is StoredMetadata => record !== null)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
  });
}

export async function POST(request: NextRequest) {
  const config = getConfig();
  if (!config.token || !config.owner || !config.repo) {
    return NextResponse.json({ error: "GitHub storage is not configured yet. Add the values from .env.example." }, { status: 503 });
  }

  const body = (await request.json()) as UploadBody;
  if (!body.name || !body.type?.startsWith("image/") || !body.data) {
    return NextResponse.json({ error: "Please upload a valid photo." }, { status: 400 });
  }
  if (Number(body.size) > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Photos must be 5 MB or smaller." }, { status: 413 });
  }

  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const displayName = `${safeBaseName(body.name)}.mp4`;
  const record = {
    id,
    originalName: String(body.name).slice(0, 180),
    displayName,
    mimeType: String(body.type),
    size: Number(body.size) || 0,
    uploadedAt: new Date().toISOString(),
    encoding: "base64",
    data: String(body.data),
  };

  const path = `storage/${id}.json`;
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
  const githubResponse = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(config.token),
    body: JSON.stringify({
      message: `vault: add ${displayName}`,
      content: encodeUtf8(JSON.stringify(record, null, 2)),
      branch: config.branch,
    }),
  });

  if (!githubResponse.ok) {
    const details = (await githubResponse.json().catch(() => ({}))) as GitHubError;
    return NextResponse.json({ error: details.message || "GitHub rejected the upload." }, { status: 502 });
  }

  const file: StoredMetadata = {
    id: record.id,
    originalName: record.originalName,
    displayName: record.displayName,
    mimeType: record.mimeType,
    size: record.size,
    uploadedAt: record.uploadedAt,
  };
  return NextResponse.json({ file }, { status: 201 });
}

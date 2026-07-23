import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

export type AccessStatus = "pending" | "accepted" | "rejected";

export type AccessRequestRecord = {
  id: string;
  email: string;
  note: string;
  fileId: string;
  fileName: string;
  deviceHash: string;
  status: AccessStatus;
  createdAt: string;
  reviewedAt: string | null;
};

export function visibleAccessRequest(record: AccessRequestRecord) {
  return {
    id: record.id,
    email: record.email,
    note: record.note,
    fileId: record.fileId,
    fileName: record.fileName,
    status: record.status,
    createdAt: record.createdAt,
    reviewedAt: record.reviewedAt,
  };
}

let redisClient: Redis | null = null;

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Access request storage is not configured.");
  if (!redisClient) redisClient = new Redis({ url, token });
  return redisClient;
}

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createAccessRequest(input: {
  email: string;
  note: string;
  fileId: string;
  fileName: string;
  deviceHash: string;
}) {
  const redis = getRedis();
  const record: AccessRequestRecord = {
    id: randomUUID(),
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  await Promise.all([
    redis.set(`pv:request:${record.id}`, record),
    redis.set(`pv:device:${record.deviceHash}:${record.fileId}`, record.id),
    redis.zadd("pv:requests", { score: Date.now(), member: record.id }),
  ]);
  return record;
}

export async function getDeviceRequest(deviceHash: string, fileId: string) {
  const redis = getRedis();
  const requestId = await redis.get<string>(`pv:device:${deviceHash}:${fileId}`);
  if (!requestId) return null;
  return redis.get<AccessRequestRecord>(`pv:request:${requestId}`);
}

export async function listAccessRequests() {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>("pv:requests", 0, 199, { rev: true });
  const records = await Promise.all(ids.map((id) => redis.get<AccessRequestRecord>(`pv:request:${id}`)));
  return records.filter((record): record is AccessRequestRecord => Boolean(record));
}

export async function reviewAccessRequest(id: string, status: Exclude<AccessStatus, "pending">) {
  const redis = getRedis();
  const record = await redis.get<AccessRequestRecord>(`pv:request:${id}`);
  if (!record) return null;
  const updated: AccessRequestRecord = { ...record, status, reviewedAt: new Date().toISOString() };
  await redis.set(`pv:request:${id}`, updated);
  return updated;
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  const count = await redis.incr(`pv:limit:${key}`);
  if (count === 1) await redis.expire(`pv:limit:${key}`, windowSeconds);
  return count <= limit;
}

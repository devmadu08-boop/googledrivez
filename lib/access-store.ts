import { createHash, randomBytes } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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

let firestoreClient: Firestore | null = null;

function getDatabase() {
  if (firestoreClient) return firestoreClient;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase access request storage is not configured.");
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });

  firestoreClient = getFirestore(app);
  return firestoreClient;
}

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function hashDeviceToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestIdFor(deviceHash: string, fileId: string) {
  return createHash("sha256").update(`${deviceHash}:${fileId}`).digest("hex");
}

export async function createAccessRequest(input: {
  email: string;
  note: string;
  fileId: string;
  fileName: string;
  deviceHash: string;
}) {
  const database = getDatabase();
  const record: AccessRequestRecord = {
    id: requestIdFor(input.deviceHash, input.fileId),
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  await database.collection("accessRequests").doc(record.id).set(record);
  return record;
}

export async function getDeviceRequest(deviceHash: string, fileId: string) {
  const snapshot = await getDatabase()
    .collection("accessRequests")
    .doc(requestIdFor(deviceHash, fileId))
    .get();
  return snapshot.exists ? (snapshot.data() as AccessRequestRecord) : null;
}

export async function listAccessRequests() {
  const snapshot = await getDatabase()
    .collection("accessRequests")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();
  return snapshot.docs.map((document) => document.data() as AccessRequestRecord);
}

export async function reviewAccessRequest(id: string, status: Exclude<AccessStatus, "pending">) {
  const reference = getDatabase().collection("accessRequests").doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  const record = snapshot.data() as AccessRequestRecord;
  const updated: AccessRequestRecord = { ...record, status, reviewedAt: new Date().toISOString() };
  await reference.set(updated);
  return updated;
}

export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const database = getDatabase();
  const reference = database
    .collection("rateLimits")
    .doc(createHash("sha256").update(key).digest("hex"));

  return database.runTransaction(async (transaction) => {
    const now = Date.now();
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() as { count?: number; resetAt?: number } | undefined;

    if (!snapshot.exists || !current?.resetAt || current.resetAt <= now) {
      transaction.set(reference, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }

    const count = (current.count ?? 0) + 1;
    transaction.update(reference, { count });
    return count <= limit;
  });
}

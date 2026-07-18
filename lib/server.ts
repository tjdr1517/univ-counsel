import { env } from "cloudflare:workers";
import type { User } from "./types";

type RuntimeEnv = {
  DB: D1Database;
  FILES: R2Bucket;
  TEACHER_IDS?: string;
  TEACHER_SETUP_CODE?: string;
};

export type SessionUser = User;
const COOKIE_NAME = "damda_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  return new Uint8Array(value.match(/.{1,2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? []);
}

export function randomHex(length = 32) {
  return toHex(crypto.getRandomValues(new Uint8Array(length)));
}

export async function sha256(value: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export async function hashPassword(password: string, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: toHex(new Uint8Array(bits)), salt };
}

export function safeUser(row: Record<string, unknown>): User {
  return {
    id: String(row.id), username: String(row.email), name: String(row.name),
    role: row.role as User["role"], status: row.status as User["status"],
    teacherId: row.teacher_id ? String(row.teacher_id) : null,
    studentNumber: row.class_number == null ? null : Number(row.class_number),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map(item => item.trim()).find(item => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) ?? null;
}

export async function createSession(userId: string) {
  const token = randomHex(32);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await runtimeEnv().DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(tokenHash, userId, expires.toISOString()).run();
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
  return { token, cookie };
}

export async function deleteSession(request: Request) {
  const token = cookieValue(request);
  if (token) await runtimeEnv().DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export const expiredSessionCookie = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export async function getSessionUser(request: Request, requireApproved = false): Promise<SessionUser | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const row = await runtimeEnv().DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1`).bind(await sha256(token), new Date().toISOString()).first<Record<string, unknown>>();
  if (!row) return null;
  const user = safeUser(row);
  if (requireApproved && user.status !== "approved") return null;
  return user;
}

export async function requireUser(request: Request, role?: "teacher") {
  const user = await getSessionUser(request, true);
  if (!user) return { error: Response.json({ error: "로그인이 필요하거나 승인되지 않은 계정입니다." }, { status: 401 }) } as const;
  if (role && user.role !== role) return { error: Response.json({ error: "교사 권한이 필요합니다." }, { status: 403 }) } as const;
  return { user } as const;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function timingSafeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function canAccessOwner(user: User, ownerType: string, ownerId: string) {
  const db = runtimeEnv().DB;
  if (ownerType === "announcement") {
    return Boolean(await db.prepare("SELECT id FROM announcements WHERE id = ? LIMIT 1").bind(ownerId).first());
  }
  if (ownerType !== "consultation") return false;
  const row = await db.prepare("SELECT teacher_id, student_id FROM consultations WHERE id = ? LIMIT 1").bind(ownerId).first<{ teacher_id: string; student_id: string }>();
  return Boolean(row && (row.teacher_id === user.id || row.student_id === user.id));
}

export async function reorderInterestPriorities(db: D1Database, studentId: string, targetId: string, requestedPriority: number) {
  const result = await db.prepare("SELECT id,priority FROM interest_universities WHERE student_id=? ORDER BY priority ASC, created_at ASC")
    .bind(studentId).all<{ id: string; priority: number }>();
  const ranked = result.results.filter(row => row.id !== targetId && Number(row.priority) < 999).map(row => row.id);
  const normalized = Number.isInteger(requestedPriority) && requestedPriority >= 1 && requestedPriority < 999 ? requestedPriority : 999;
  if (normalized < 999) ranked.splice(Math.min(normalized - 1, ranked.length), 0, targetId);
  const statements = ranked.map((id, index) => db.prepare("UPDATE interest_universities SET priority=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(index + 1, id));
  if (normalized === 999) statements.push(db.prepare("UPDATE interest_universities SET priority=999,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(targetId));
  if (statements.length) await db.batch(statements);
  return normalized === 999 ? 999 : ranked.indexOf(targetId) + 1;
}

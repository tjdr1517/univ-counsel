import { createSession, hashPassword, jsonError, normalizeUsername, runtimeEnv, safeUser, timingSafeEqual } from "../../../../lib/server";

export async function POST(request: Request) {
  const input = await request.json() as Record<string, unknown>;
  const username = normalizeUsername(input.username);
  const password = String(input.password ?? "");
  const row = await runtimeEnv().DB.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").bind(username).first<Record<string, unknown>>();
  if (!row) return jsonError("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
  const candidate = await hashPassword(password, String(row.password_salt));
  if (!timingSafeEqual(candidate.hash, String(row.password_hash))) return jsonError("아이디 또는 비밀번호가 올바르지 않습니다.", 401);
  const session = await createSession(String(row.id));
  return Response.json({ user: safeUser(row) }, { headers: { "Set-Cookie": session.cookie } });
}

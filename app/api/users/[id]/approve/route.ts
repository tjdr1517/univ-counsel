import { jsonError, requireUser, runtimeEnv } from "../../../../../lib/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const result = await runtimeEnv().DB.prepare("UPDATE users SET status='approved',teacher_id=?,approved_at=?,approved_by=? WHERE id=? AND role='student' AND status='pending'")
    .bind(auth.user.id, new Date().toISOString(), auth.user.id, id).run();
  if (!result.meta.changes) return jsonError("승인할 학생을 찾지 못했습니다.", 404);
  return Response.json({ ok: true });
}

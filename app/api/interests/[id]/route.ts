import { jsonError, reorderInterestPriorities, requireUser, runtimeEnv } from "../../../../lib/server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const input = await request.json() as Record<string, unknown>;
  const priority = Number(input.priority);
  if (!Number.isInteger(priority) || priority < 1 || priority > 99) return jsonError("지망 순위는 1~99 사이의 숫자로 입력해 주세요.");
  const db = runtimeEnv().DB;
  const item = await db.prepare("SELECT id,teacher_id,student_id FROM interest_universities WHERE id=? LIMIT 1")
    .bind(id).first<{ id: string; teacher_id: string; student_id: string }>();
  if (!item) return jsonError("관심 대학 기록을 찾지 못했습니다.", 404);
  const allowed = auth.user.role === "teacher" ? item.teacher_id === auth.user.id : item.student_id === auth.user.id;
  if (!allowed) return jsonError("이 기록의 순위를 변경할 권한이 없습니다.", 403);
  const appliedPriority = await reorderInterestPriorities(db, item.student_id, item.id, priority);
  return Response.json({ priority: appliedPriority });
}

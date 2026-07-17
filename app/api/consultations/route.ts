import { jsonError, requireUser, runtimeEnv } from "../../../lib/server";
import type { AdmissionPlan } from "../../../lib/types";

export async function POST(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const studentId = String(input.studentId ?? "");
  const student = await runtimeEnv().DB.prepare("SELECT id,name FROM users WHERE id=? AND role='student' AND status='approved' AND teacher_id=?").bind(studentId, auth.user.id).first<{ id: string; name: string }>();
  if (!student) return jsonError("승인된 담당 학생만 상담을 기록할 수 있습니다.", 403);
  const date = String(input.date ?? "");
  const topic = String(input.topic ?? "").trim();
  const summary = String(input.summary ?? "").trim();
  const plans = Array.isArray(input.plans) ? input.plans as AdmissionPlan[] : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !topic || !summary || !plans.length) return jsonError("상담 일자와 내용, 전형을 모두 입력해 주세요.");
  const normalizedPlans = plans.map(plan => ({ university: String(plan.university ?? "").trim(), department: String(plan.department ?? "").trim(), track: String(plan.track ?? "").trim(), minimum: String(plan.minimum ?? "").trim(), memo: String(plan.memo ?? "").trim() }));
  if (normalizedPlans.some(plan => !plan.university || !plan.department || !plan.track)) return jsonError("학교·학과·전형을 모두 입력해 주세요.");
  const id = crypto.randomUUID();
  await runtimeEnv().DB.prepare("INSERT INTO consultations (id,teacher_id,student_id,student_name,date,topic,summary,plans_json) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, auth.user.id, student.id, student.name, date, topic, summary, JSON.stringify(normalizedPlans)).run();
  return Response.json({ id }, { status: 201 });
}

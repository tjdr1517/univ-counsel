import { jsonError, reorderInterestPriorities, requireUser, runtimeEnv } from "../../../../lib/server";

const TRACK_TYPES = ["학생부 종합 전형", "학생부 교과 전형", "논술 전형", "실기(특기자) 전형", "기타 전형"];

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

  if ("university" in input) {
    if (auth.user.role !== "teacher") return jsonError("관심 대학 내용은 교사만 수정할 수 있습니다.", 403);
    const university = String(input.university ?? "").trim();
    const department = String(input.department ?? "").trim();
    const track = String(input.track ?? "").trim();
    const admissionName = String(input.admissionName ?? "").trim();
    const schoolRecommendation = input.schoolRecommendation === true;
    const evaluationFactors = String(input.evaluationFactors ?? "").trim();
    const minimum = String(input.minimum ?? "").trim();
    const schoolGrade = String(input.schoolGrade ?? "").trim();
    const cutoff2023 = String(input.cutoff2023 ?? "").trim();
    const cutoff2024 = String(input.cutoff2024 ?? "").trim();
    const cutoff2025 = String(input.cutoff2025 ?? "").trim();
    const memo = String(input.memo ?? "").trim();
    if (!university || !department || !track || !admissionName) return jsonError("대학·학과·전형 종류·전형 이름을 모두 입력해 주세요.");
    if (!TRACK_TYPES.includes(track)) return jsonError("올바른 전형 종류를 선택해 주세요.");
    await db.prepare("UPDATE interest_universities SET university=?,department=?,track=?,admission_name=?,school_recommendation=?,evaluation_factors=?,minimum=?,school_grade=?,cutoff_2023=?,cutoff_2024=?,cutoff_2025=?,memo=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND teacher_id=?")
      .bind(university, department, track, admissionName, schoolRecommendation ? 1 : 0, evaluationFactors, minimum, schoolGrade, cutoff2023, cutoff2024, cutoff2025, memo, id, auth.user.id).run();
  }
  const appliedPriority = await reorderInterestPriorities(db, item.student_id, item.id, priority);
  return Response.json({ priority: appliedPriority, updated: "university" in input });
}

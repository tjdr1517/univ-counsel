import { jsonError, reorderInterestPriorities, requireUser, runtimeEnv } from "../../../lib/server";

const TRACK_TYPES = ["학생부 종합 전형", "학생부 교과 전형", "논술 전형", "실기(특기자) 전형", "기타 전형"];

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const db = runtimeEnv().DB;
  let studentId = auth.user.id;
  let teacherId = auth.user.teacherId;
  let studentName = auth.user.name;

  if (auth.user.role === "teacher") {
    studentId = String(input.studentId ?? "");
    const student = await db.prepare("SELECT id,name FROM users WHERE id=? AND role='student' AND status='approved' AND teacher_id=?")
      .bind(studentId, auth.user.id).first<{ id: string; name: string }>();
    if (!student) return jsonError("승인된 담당 학생을 선택해 주세요.", 403);
    teacherId = auth.user.id;
    studentName = student.name;
  }

  if (!teacherId) return jsonError("담당 교사가 연결된 학생만 관심 대학을 기록할 수 있습니다.", 403);
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
  const priority = Number(input.priority);
  const memo = String(input.memo ?? "").trim();
  if (!university || !department || !track || !admissionName) return jsonError("대학·학과·전형 종류·전형 이름을 모두 입력해 주세요.");
  if (!TRACK_TYPES.includes(track)) return jsonError("올바른 전형 종류를 선택해 주세요.");
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO interest_universities (id,teacher_id,student_id,student_name,university,department,track,admission_name,school_recommendation,evaluation_factors,minimum,school_grade,cutoff_2023,cutoff_2024,cutoff_2025,priority,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, teacherId, studentId, studentName, university, department, track, admissionName, schoolRecommendation ? 1 : 0, evaluationFactors, minimum, schoolGrade, cutoff2023, cutoff2024, cutoff2025, 999, memo).run();
  await reorderInterestPriorities(db, studentId, id, priority);
  return Response.json({ id }, { status: 201 });
}

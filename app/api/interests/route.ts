import { jsonError, requireUser, runtimeEnv } from "../../../lib/server";

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
  const minimum = String(input.minimum ?? "").trim();
  const memo = String(input.memo ?? "").trim();
  if (!university || !department || !track) return jsonError("대학·학과·전형을 모두 입력해 주세요.");
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO interest_universities (id,teacher_id,student_id,student_name,university,department,track,minimum,memo) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, teacherId, studentId, studentName, university, department, track, minimum, memo).run();
  return Response.json({ id }, { status: 201 });
}

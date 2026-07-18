import { requireUser, runtimeEnv, safeUser } from "../../../lib/server";
import type { Announcement, Attachment, Consultation, InterestUniversity } from "../../../lib/types";

function attachmentMap(rows: Record<string, unknown>[]) {
  const map = new Map<string, Attachment[]>();
  for (const row of rows) {
    const item = { id: String(row.id), fileName: String(row.file_name), contentType: String(row.content_type), size: Number(row.size) };
    const list = map.get(String(row.owner_id)) ?? [];
    list.push(item); map.set(String(row.owner_id), list);
  }
  return map;
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const db = runtimeEnv().DB;
  const consultationSql = user.role === "teacher" ? "SELECT * FROM consultations WHERE teacher_id = ? ORDER BY date DESC, created_at DESC" : "SELECT * FROM consultations WHERE student_id = ? ORDER BY date DESC, created_at DESC";
  const interestSql = user.role === "teacher" ? "SELECT * FROM interest_universities WHERE teacher_id = ? ORDER BY priority ASC, created_at DESC" : "SELECT * FROM interest_universities WHERE student_id = ? ORDER BY priority ASC, created_at DESC";
  const [consultationResult, interestResult, announcementResult, attachmentResult] = await Promise.all([
    db.prepare(consultationSql).bind(user.id).all<Record<string, unknown>>(),
    db.prepare(interestSql).bind(user.id).all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM announcements ORDER BY is_pinned DESC, published_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT id,owner_id,file_name,content_type,size FROM attachments ORDER BY created_at").all<Record<string, unknown>>(),
  ]);
  const files = attachmentMap(attachmentResult.results);
  const consultations: Consultation[] = consultationResult.results.map((row: Record<string, unknown>) => ({
    id: String(row.id), teacherId: String(row.teacher_id), studentId: String(row.student_id), studentName: String(row.student_name),
    date: String(row.date), topic: String(row.topic), summary: String(row.summary),
    attachments: files.get(String(row.id)) ?? [],
  }));
  const interests: InterestUniversity[] = interestResult.results.map((row: Record<string, unknown>) => ({
    id: String(row.id), teacherId: String(row.teacher_id), studentId: String(row.student_id), studentName: String(row.student_name),
    university: String(row.university), department: String(row.department), track: String(row.track), minimum: String(row.minimum),
    schoolGrade: String(row.school_grade ?? ""), cutoff2023: String(row.cutoff_2023 ?? ""), cutoff2024: String(row.cutoff_2024 ?? ""), cutoff2025: String(row.cutoff_2025 ?? ""),
    priority: Number(row.priority ?? 999), memo: String(row.memo), createdAt: String(row.created_at),
  }));
  const announcements: Announcement[] = announcementResult.results.map((row: Record<string, unknown>) => ({
    id: String(row.id), authorId: String(row.author_id), authorName: String(row.author_name), title: String(row.title), body: String(row.body),
    category: String(row.category), isPinned: Boolean(row.is_pinned), publishedAt: String(row.published_at), attachments: files.get(String(row.id)) ?? [],
  }));
  let students: ReturnType<typeof safeUser>[] = [];
  let pendingStudents: ReturnType<typeof safeUser>[] = [];
  if (user.role === "teacher") {
    const [approved, pending] = await Promise.all([
      db.prepare("SELECT * FROM users WHERE role='student' AND status='approved' AND teacher_id=? ORDER BY name").bind(user.id).all<Record<string, unknown>>(),
      db.prepare("SELECT * FROM users WHERE role='student' AND status='pending' ORDER BY created_at").all<Record<string, unknown>>(),
    ]);
    students = approved.results.map(safeUser);
    pendingStudents = pending.results.map(safeUser);
  }
  return Response.json({ user, consultations, interests, announcements, students, pendingStudents });
}

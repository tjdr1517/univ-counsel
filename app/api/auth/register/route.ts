import { createSession, hashPassword, jsonError, normalizeUsername, runtimeEnv, safeUser, timingSafeEqual } from "../../../../lib/server";

export async function POST(request: Request) {
  const input = await request.json() as Record<string, unknown>;
  const username = normalizeUsername(input.username);
  const name = String(input.name ?? "").trim();
  const password = String(input.password ?? "");
  const role = input.role === "teacher" ? "teacher" : "student";
  if (!/^[a-z0-9][a-z0-9._-]{3,19}$/.test(username)) return jsonError("아이디는 영문 소문자·숫자로 시작하는 4~20자로 입력해 주세요.");
  if (name.length < 2 || name.length > 40) return jsonError("이름은 2~40자로 입력해 주세요.");
  if (password.length < 8 || password.length > 100) return jsonError("비밀번호는 8자 이상 입력해 주세요.");
  const studentNumber = role === "student" ? Number(input.studentNumber) : null;
  if (role === "student" && (!Number.isInteger(studentNumber) || studentNumber! < 1 || studentNumber! > 99)) return jsonError("번호는 1~99 사이의 숫자로 입력해 주세요.");

  const runtime = runtimeEnv();
  const status = "approved";
  let teacherId: string | null = null;
  if (role === "teacher") {
    const teacherIds = String(runtime.TEACHER_IDS ?? "").split(",").map(normalizeUsername).filter(Boolean);
    const setupCode = String(input.setupCode ?? "").trim();
    if (!teacherIds.includes(username) || !runtime.TEACHER_SETUP_CODE || !timingSafeEqual(setupCode, runtime.TEACHER_SETUP_CODE)) {
      return jsonError("교사 아이디 또는 개설 코드가 올바르지 않습니다.", 403);
    }
  } else {
    const openTeacher = await runtime.DB.prepare("SELECT u.id FROM users u JOIN teacher_settings s ON s.teacher_id=u.id WHERE u.role='teacher' AND u.status='approved' AND s.registration_open=1 ORDER BY s.updated_at DESC LIMIT 1").first<{ id: string }>();
    if (!openTeacher) return jsonError("현재 학생 가입이 닫혀 있습니다. 선생님이 가입을 열어 준 뒤 다시 시도해 주세요.", 403);
    teacherId = openTeacher.id;
  }

  const existing = await runtime.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(username).first();
  if (existing) return jsonError("이미 사용 중인 아이디입니다.", 409);
  const id = crypto.randomUUID();
  const passwordData = await hashPassword(password);
  try {
    if (role === "student") {
      const result = await runtime.DB.prepare(`INSERT INTO users (id,email,name,password_hash,password_salt,role,status,teacher_id,grade,class_number,approved_at,approved_by) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM teacher_settings WHERE teacher_id=? AND registration_open=1)`)
        .bind(id, username, name, passwordData.hash, passwordData.salt, role, status, teacherId, null, studentNumber, new Date().toISOString(), teacherId, teacherId).run();
      if (!result.meta.changes) return jsonError("현재 학생 가입이 닫혀 있습니다. 선생님이 가입을 열어 준 뒤 다시 시도해 주세요.", 403);
    } else {
      await runtime.DB.prepare(`INSERT INTO users (id,email,name,password_hash,password_salt,role,status,teacher_id,grade,class_number,approved_at,approved_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, username, name, passwordData.hash, passwordData.salt, role, status, null, null, null, new Date().toISOString(), id).run();
    }
  } catch {
    return jsonError("계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
  const row = await runtime.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<Record<string, unknown>>();
  const session = await createSession(id);
  return Response.json({ user: safeUser(row!) }, { status: 201, headers: { "Set-Cookie": session.cookie } });
}

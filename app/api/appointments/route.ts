import { jsonError, requireUser, runtimeEnv } from "../../../lib/server";

function seoulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const date = String(input.date ?? "").trim();
  const time = String(input.time ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return jsonError("올바른 상담 일자와 시간을 입력해 주세요.");
  if (date < seoulToday()) return jsonError("지난 날짜에는 상담 시간을 만들 수 없습니다.");
  const db = runtimeEnv().DB;
  const duplicate = await db.prepare("SELECT id FROM appointment_slots WHERE teacher_id=? AND date=? AND time=? LIMIT 1").bind(auth.user.id, date, time).first();
  if (duplicate) return jsonError("이미 등록된 상담 시간입니다.", 409);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO appointment_slots (id,teacher_id,date,time) VALUES (?,?,?,?)").bind(id, auth.user.id, date, time).run();
  return Response.json({ id }, { status: 201 });
}

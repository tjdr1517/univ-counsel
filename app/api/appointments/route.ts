import { jsonError, requireUser, runtimeEnv } from "../../../lib/server";

function seoulToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const date = String(input.date ?? "").trim();
  const times = Array.isArray(input.times) ? [...new Set(input.times.map(value => String(value).trim()))] : [String(input.time ?? "").trim()];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !times.length || times.length > 48 || times.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return jsonError("올바른 상담 일자와 시간을 선택해 주세요.");
  if (date < seoulToday()) return jsonError("지난 날짜에는 상담 시간을 만들 수 없습니다.");
  const db = runtimeEnv().DB;
  const existing = await db.prepare("SELECT time FROM appointment_slots WHERE teacher_id=? AND date=?").bind(auth.user.id, date).all<{ time: string }>();
  const existingTimes = new Set(existing.results.map(row => row.time));
  const newTimes = times.filter(time => !existingTimes.has(time)).sort();
  if (!newTimes.length) return jsonError("선택한 시간은 이미 모두 등록되어 있습니다.", 409);
  const ids = newTimes.map(() => crypto.randomUUID());
  await db.batch(newTimes.map((time, index) => db.prepare("INSERT INTO appointment_slots (id,teacher_id,date,time) VALUES (?,?,?,?)").bind(ids[index], auth.user.id, date, time)));
  return Response.json({ ids, created: ids.length, skipped: times.length - newTimes.length }, { status: 201 });
}

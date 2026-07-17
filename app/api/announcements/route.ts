import { jsonError, requireUser, runtimeEnv } from "../../../lib/server";

export async function POST(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!title || !body) return jsonError("제목과 내용을 입력해 주세요.");
  const id = crypto.randomUUID();
  await runtimeEnv().DB.prepare("INSERT INTO announcements (id,author_id,author_name,title,body,category,is_pinned) VALUES (?,?,?,?,?,?,?)")
    .bind(id, auth.user.id, auth.user.name, title, body, String(input.category ?? "공지"), input.isPinned ? 1 : 0).run();
  return Response.json({ id }, { status: 201 });
}

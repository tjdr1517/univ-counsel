import { jsonError, requireUser, runtimeEnv } from "../../../../lib/server";

async function ownedAnnouncement(request: Request, id: string) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth;
  const row = await runtimeEnv().DB.prepare("SELECT id,author_id FROM announcements WHERE id=? LIMIT 1").bind(id).first<{ id: string; author_id: string }>();
  if (!row) return { error: jsonError("공지를 찾지 못했습니다.", 404) } as const;
  if (row.author_id !== auth.user.id) return { error: jsonError("직접 작성한 공지만 수정하거나 삭제할 수 있습니다.", 403) } as const;
  return { user: auth.user } as const;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await ownedAnnouncement(request, id);
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const title = String(input.title ?? "").trim();
  const body = String(input.body ?? "").trim();
  if (!title || !body) return jsonError("제목과 내용을 입력해 주세요.");
  await runtimeEnv().DB.prepare("UPDATE announcements SET title=?,body=?,category=?,is_pinned=? WHERE id=? AND author_id=?")
    .bind(title, body, String(input.category ?? "공지"), input.isPinned ? 1 : 0, id, auth.user.id).run();
  return Response.json({ id });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const auth = await ownedAnnouncement(request, id);
  if ("error" in auth) return auth.error;
  const env = runtimeEnv();
  const attachmentResult = await env.DB.prepare("SELECT r2_key FROM attachments WHERE owner_type='announcement' AND owner_id=?").bind(id).all<{ r2_key: string }>();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM attachments WHERE owner_type='announcement' AND owner_id=?").bind(id),
    env.DB.prepare("DELETE FROM announcements WHERE id=? AND author_id=?").bind(id, auth.user.id),
  ]);
  await Promise.allSettled(attachmentResult.results.map(file => env.FILES.delete(file.r2_key)));
  return Response.json({ ok: true });
}

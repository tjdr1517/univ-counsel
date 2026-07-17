import { canAccessOwner, jsonError, requireUser, runtimeEnv } from "../../../../lib/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const row = await runtimeEnv().DB.prepare("SELECT * FROM attachments WHERE id=? LIMIT 1").bind(id).first<Record<string, unknown>>();
  if (!row) return jsonError("파일을 찾지 못했습니다.", 404);
  if (!await canAccessOwner(auth.user, String(row.owner_type), String(row.owner_id))) return jsonError("파일을 볼 권한이 없습니다.", 403);
  const object = await runtimeEnv().FILES.get(String(row.r2_key));
  if (!object) return jsonError("저장된 파일을 찾지 못했습니다.", 404);
  const safeName = String(row.file_name).replace(/[\r\n"]/g, "_");
  return new Response(object.body, { headers: { "Content-Type": String(row.content_type), "Content-Length": String(row.size), "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`, "Cache-Control": "private, no-store" } });
}

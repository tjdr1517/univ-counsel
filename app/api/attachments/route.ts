import { canAccessOwner, jsonError, requireUser, runtimeEnv } from "../../../lib/server";

const allowedExtensions = new Set(["pdf","png","jpg","jpeg","webp","gif","txt","doc","docx","xls","xlsx","ppt","pptx","hwp"]);

export async function POST(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const form = await request.formData();
  const ownerType = String(form.get("ownerType") ?? "");
  const ownerId = String(form.get("ownerId") ?? "");
  if (!await canAccessOwner(auth.user, ownerType, ownerId)) return jsonError("첨부 권한이 없습니다.", 403);
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) return jsonError("첨부할 파일을 선택해 주세요.");
  if (files.length > 10) return jsonError("한 번에 최대 10개까지 첨부할 수 있습니다.");
  const saved = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(ext) || file.size > 10 * 1024 * 1024) return jsonError("허용되지 않는 파일이거나 10MB를 초과했습니다.");
    const id = crypto.randomUUID();
    const key = `${ownerType}/${ownerId}/${id}.${ext}`;
    await runtimeEnv().FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    await runtimeEnv().DB.prepare("INSERT INTO attachments (id,owner_type,owner_id,r2_key,file_name,content_type,size,uploaded_by) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id, ownerType, ownerId, key, file.name.slice(0, 240), file.type || "application/octet-stream", file.size, auth.user.id).run();
    saved.push({ id, fileName: file.name, contentType: file.type, size: file.size });
  }
  return Response.json({ attachments: saved }, { status: 201 });
}

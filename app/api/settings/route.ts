import { jsonError, requireUser, runtimeEnv } from "../../../lib/server";

type SettingsRow = { notifications_enabled: number; discord_webhook_url: string | null };

function validDiscordWebhook(value: string) {
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === "discord.com" || url.hostname.endsWith(".discord.com") || url.hostname === "discordapp.com" || url.hostname.endsWith(".discordapp.com");
    return url.protocol === "https:" && allowedHost && url.pathname.startsWith("/api/webhooks/") && url.pathname.split("/").filter(Boolean).length >= 4;
  } catch {
    return false;
  }
}

function publicSettings(row: SettingsRow | null) {
  const configured = Boolean(row?.discord_webhook_url);
  const tail = row?.discord_webhook_url?.slice(-6) ?? "";
  return { notificationsEnabled: Boolean(row?.notifications_enabled), discordConfigured: configured, maskedWebhook: configured ? `••••••••${tail}` : "" };
}

async function readSettings(teacherId: string) {
  return runtimeEnv().DB.prepare("SELECT notifications_enabled,discord_webhook_url FROM teacher_settings WHERE teacher_id=? LIMIT 1").bind(teacherId).first<SettingsRow>();
}

export async function GET(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  return Response.json(publicSettings(await readSettings(auth.user.id)));
}

export async function PATCH(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  const enabled = input.notificationsEnabled === true;
  const clearWebhook = input.clearWebhook === true;
  const submittedWebhook = typeof input.webhookUrl === "string" ? input.webhookUrl.trim() : "";
  if (submittedWebhook && !validDiscordWebhook(submittedWebhook)) return jsonError("올바른 디스코드 웹훅 URL을 입력해 주세요.");
  const current = await readSettings(auth.user.id);
  const webhook = clearWebhook ? null : submittedWebhook || current?.discord_webhook_url || null;
  if (enabled && !webhook) return jsonError("알림을 사용하려면 디스코드 웹훅 URL이 필요합니다.");
  await runtimeEnv().DB.prepare("INSERT INTO teacher_settings (teacher_id,notifications_enabled,discord_webhook_url,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(teacher_id) DO UPDATE SET notifications_enabled=excluded.notifications_enabled,discord_webhook_url=excluded.discord_webhook_url,updated_at=CURRENT_TIMESTAMP").bind(auth.user.id, enabled ? 1 : 0, webhook).run();
  return Response.json(publicSettings({ notifications_enabled: enabled ? 1 : 0, discord_webhook_url: webhook }));
}

export async function POST(request: Request) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const input = await request.json() as Record<string, unknown>;
  if (input.action !== "test") return jsonError("올바른 설정 작업을 선택해 주세요.");
  const settings = await readSettings(auth.user.id);
  if (!settings?.discord_webhook_url) return jsonError("먼저 디스코드 웹훅 URL을 저장해 주세요.");
  const response = await fetch(settings.discord_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "🔔 담다 알림 연결이 완료되었습니다.\n앞으로 새로운 상담 신청을 이 채널에서 알려드릴게요." }) });
  if (!response.ok) return jsonError("디스코드가 웹훅 요청을 거부했습니다. URL을 다시 확인해 주세요.", 502);
  return Response.json({ ok: true });
}

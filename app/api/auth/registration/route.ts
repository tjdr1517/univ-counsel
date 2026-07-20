import { runtimeEnv } from "../../../../lib/server";

export async function GET() {
  const row = await runtimeEnv().DB.prepare("SELECT 1 AS is_open FROM teacher_settings WHERE registration_open=1 LIMIT 1").first<{ is_open: number }>();
  return Response.json({ registrationOpen: Boolean(row?.is_open) });
}

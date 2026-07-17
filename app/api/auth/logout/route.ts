import { deleteSession, expiredSessionCookie } from "../../../../lib/server";

export async function POST(request: Request) {
  await deleteSession(request);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie } });
}

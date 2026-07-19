import { jsonError, requireUser, runtimeEnv } from "../../../../lib/server";

type SlotRow = { id: string; teacher_id: string; student_id: string | null; booking_status: string; date: string; time: string };

function slotLabel(value: string) {
  return value.startsWith("period:") ? `${Number(value.slice(7))}교시` : value;
}

async function notifyTeacher(teacherId: string, message: string) {
  const settings = await runtimeEnv().DB.prepare("SELECT notifications_enabled,discord_webhook_url FROM teacher_settings WHERE teacher_id=? LIMIT 1").bind(teacherId).first<{ notifications_enabled: number; discord_webhook_url: string | null }>();
  const webhook = settings?.notifications_enabled ? settings.discord_webhook_url?.trim() : settings ? "" : runtimeEnv().DISCORD_WEBHOOK_URL?.trim();
  if (!webhook) return;
  try {
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: message }) });
  } catch {
    // 알림 장애가 학생의 예약 신청을 막지 않도록 합니다.
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const input = await request.json() as Record<string, unknown>;
  const action = String(input.action ?? "");
  const db = runtimeEnv().DB;
  const slot = await db.prepare("SELECT id,teacher_id,student_id,booking_status,date,time FROM appointment_slots WHERE id=? LIMIT 1").bind(id).first<SlotRow>();
  if (!slot) return jsonError("상담 시간을 찾지 못했습니다.", 404);

  if (action === "reserve") {
    if (auth.user.role !== "student" || !auth.user.teacherId || slot.teacher_id !== auth.user.teacherId) return jsonError("담당 교사의 상담 시간만 신청할 수 있습니다.", 403);
    const result = await db.prepare("UPDATE appointment_slots SET student_id=?,booking_status='pending',reserved_at=CURRENT_TIMESTAMP WHERE id=? AND student_id IS NULL").bind(auth.user.id, id).run();
    if (!result.meta.changes) return jsonError("이미 예약된 상담 시간입니다.", 409);
    await notifyTeacher(slot.teacher_id, `📅 새 상담 신청\n${auth.user.studentNumber ?? "-"}번 ${auth.user.name}\n${slot.date} ${slotLabel(slot.time)}\n담다에서 승인해 주세요.`);
    return Response.json({ ok: true, bookingStatus: "pending" });
  }

  if (action === "approve") {
    if (auth.user.role !== "teacher" || slot.teacher_id !== auth.user.id) return jsonError("이 예약을 승인할 권한이 없습니다.", 403);
    const result = await db.prepare("UPDATE appointment_slots SET booking_status='confirmed' WHERE id=? AND teacher_id=? AND student_id IS NOT NULL AND booking_status='pending'").bind(id, auth.user.id).run();
    if (!result.meta.changes) return jsonError("승인 대기 중인 예약이 아닙니다.", 409);
    return Response.json({ ok: true, bookingStatus: "confirmed" });
  }

  if (action === "approve_cancel" || action === "reject_cancel") {
    if (auth.user.role !== "teacher" || slot.teacher_id !== auth.user.id) return jsonError("이 취소 요청을 처리할 권한이 없습니다.", 403);
    if (slot.booking_status !== "cancel_pending") return jsonError("취소 승인 대기 중인 예약이 아닙니다.", 409);
    if (action === "approve_cancel") {
      await db.prepare("UPDATE appointment_slots SET student_id=NULL,booking_status='available',reserved_at=NULL WHERE id=? AND teacher_id=? AND booking_status='cancel_pending'").bind(id, auth.user.id).run();
      return Response.json({ ok: true, bookingStatus: "available" });
    }
    await db.prepare("UPDATE appointment_slots SET booking_status='confirmed' WHERE id=? AND teacher_id=? AND booking_status='cancel_pending'").bind(id, auth.user.id).run();
    return Response.json({ ok: true, bookingStatus: "confirmed" });
  }

  if (action === "cancel") {
    const allowed = auth.user.role === "teacher" ? slot.teacher_id === auth.user.id : slot.student_id === auth.user.id;
    if (!allowed) return jsonError("이 예약을 취소할 권한이 없습니다.", 403);
    if (auth.user.role === "student") {
      if (slot.booking_status === "cancel_pending") return jsonError("이미 취소 승인을 기다리고 있습니다.", 409);
      if (slot.booking_status === "confirmed") {
        await db.prepare("UPDATE appointment_slots SET booking_status='cancel_pending' WHERE id=? AND student_id=? AND booking_status='confirmed'").bind(id, auth.user.id).run();
        await notifyTeacher(slot.teacher_id, `↩️ 확정 예약 취소 요청\n${auth.user.studentNumber ?? "-"}번 ${auth.user.name}\n${slot.date} ${slotLabel(slot.time)}\n담다에서 취소 승인 또는 거절을 선택해 주세요.`);
        return Response.json({ ok: true, bookingStatus: "cancel_pending" });
      }
      await db.prepare("UPDATE appointment_slots SET student_id=NULL,booking_status='available',reserved_at=NULL WHERE id=? AND student_id=?").bind(id, auth.user.id).run();
      await notifyTeacher(slot.teacher_id, `↩️ 상담 신청 취소\n${auth.user.studentNumber ?? "-"}번 ${auth.user.name}\n${slot.date} ${slotLabel(slot.time)}\n학생이 담다에서 취소했습니다.`);
      return Response.json({ ok: true, bookingStatus: "available" });
    }
    await db.prepare("UPDATE appointment_slots SET student_id=NULL,booking_status='available',reserved_at=NULL WHERE id=? AND teacher_id=?").bind(id, auth.user.id).run();
    return Response.json({ ok: true });
  }

  return jsonError("올바른 예약 작업을 선택해 주세요.");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request, "teacher");
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const result = await runtimeEnv().DB.prepare("DELETE FROM appointment_slots WHERE id=? AND teacher_id=?").bind(id, auth.user.id).run();
  if (!result.meta.changes) return jsonError("상담 시간을 찾지 못했거나 삭제할 권한이 없습니다.", 404);
  return Response.json({ ok: true });
}

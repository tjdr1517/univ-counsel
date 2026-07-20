import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  // The deployed D1 column keeps its original name for migration compatibility.
  username: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role", { enum: ["teacher", "student"] }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  teacherId: text("teacher_id"),
  legacyGrade: integer("grade"),
  studentNumber: integer("class_number"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
}, (table) => [
  uniqueIndex("users_email_unique").on(table.username),
  index("users_status_idx").on(table.status),
  index("users_teacher_idx").on(table.teacherId),
]);

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expiry_idx").on(table.expiresAt)]);

export const consultations = sqliteTable("consultations", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull(),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  date: text("date").notNull(),
  topic: text("topic").notNull(),
  summary: text("summary").notNull(),
  legacyPlansJson: text("plans_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("consultations_teacher_date_idx").on(table.teacherId, table.date), index("consultations_student_date_idx").on(table.studentId, table.date)]);

export const interestUniversities = sqliteTable("interest_universities", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull(),
  studentId: text("student_id").notNull(),
  studentName: text("student_name").notNull(),
  university: text("university").notNull(),
  department: text("department").notNull(),
  track: text("track").notNull(),
  admissionName: text("admission_name").notNull().default(""),
  schoolRecommendation: integer("school_recommendation", { mode: "boolean" }).notNull().default(false),
  evaluationFactors: text("evaluation_factors").notNull().default(""),
  minimum: text("minimum").notNull().default(""),
  schoolGrade: text("school_grade").notNull().default(""),
  cutoff2023: text("cutoff_2023").notNull().default(""),
  cutoff2024: text("cutoff_2024").notNull().default(""),
  cutoff2025: text("cutoff_2025").notNull().default(""),
  priority: integer("priority").notNull().default(999),
  memo: text("memo").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("interest_universities_teacher_idx").on(table.teacherId, table.createdAt),
  index("interest_universities_student_idx").on(table.studentId, table.createdAt),
]);

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("공지"),
  isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
  publishedAt: text("published_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("announcements_date_idx").on(table.publishedAt)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  ownerType: text("owner_type", { enum: ["consultation", "announcement"] }).notNull(),
  ownerId: text("owner_id").notNull(),
  r2Key: text("r2_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("attachments_r2_key_unique").on(table.r2Key), index("attachments_owner_idx").on(table.ownerType, table.ownerId)]);

export const appointmentSlots = sqliteTable("appointment_slots", {
  id: text("id").primaryKey(),
  teacherId: text("teacher_id").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  studentId: text("student_id"),
  bookingStatus: text("booking_status").notNull().default("available"),
  reservedAt: text("reserved_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("appointment_slots_teacher_datetime_unique").on(table.teacherId, table.date, table.time),
  index("appointment_slots_teacher_date_idx").on(table.teacherId, table.date),
  index("appointment_slots_student_idx").on(table.studentId, table.date),
]);

export const teacherSettings = sqliteTable("teacher_settings", {
  teacherId: text("teacher_id").primaryKey(),
  notificationsEnabled: integer("notifications_enabled", { mode: "boolean" }).notNull().default(false),
  discordWebhookUrl: text("discord_webhook_url"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

CREATE TABLE `appointment_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`student_id` text,
	`reserved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_slots_teacher_datetime_unique` ON `appointment_slots` (`teacher_id`,`date`,`time`);--> statement-breakpoint
CREATE INDEX `appointment_slots_teacher_date_idx` ON `appointment_slots` (`teacher_id`,`date`);--> statement-breakpoint
CREATE INDEX `appointment_slots_student_idx` ON `appointment_slots` (`student_id`,`date`);
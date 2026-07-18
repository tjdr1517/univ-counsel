CREATE TABLE `interest_universities` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`student_id` text NOT NULL,
	`student_name` text NOT NULL,
	`university` text NOT NULL,
	`department` text NOT NULL,
	`track` text NOT NULL,
	`minimum` text DEFAULT '' NOT NULL,
	`memo` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `interest_universities_teacher_idx` ON `interest_universities` (`teacher_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `interest_universities_student_idx` ON `interest_universities` (`student_id`,`created_at`);--> statement-breakpoint
INSERT INTO `interest_universities` (`id`,`teacher_id`,`student_id`,`student_name`,`university`,`department`,`track`,`minimum`,`memo`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))), c.`teacher_id`, c.`student_id`, c.`student_name`,
  coalesce(json_extract(plan.value, '$.university'), ''),
  coalesce(json_extract(plan.value, '$.department'), ''),
  coalesce(json_extract(plan.value, '$.track'), ''),
  coalesce(json_extract(plan.value, '$.minimum'), ''),
  coalesce(json_extract(plan.value, '$.memo'), ''),
  c.`created_at`, c.`updated_at`
FROM `consultations` c, json_each(CASE WHEN json_valid(c.`plans_json`) THEN c.`plans_json` ELSE '[]' END) plan
WHERE trim(coalesce(json_extract(plan.value, '$.university'), '')) <> '';

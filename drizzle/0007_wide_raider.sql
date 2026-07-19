CREATE TABLE `teacher_settings` (
	`teacher_id` text PRIMARY KEY NOT NULL,
	`notifications_enabled` integer DEFAULT false NOT NULL,
	`discord_webhook_url` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

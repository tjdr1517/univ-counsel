ALTER TABLE `appointment_slots` ADD `booking_status` text DEFAULT 'available' NOT NULL;--> statement-breakpoint
UPDATE `appointment_slots` SET `booking_status` = 'confirmed' WHERE `student_id` IS NOT NULL;

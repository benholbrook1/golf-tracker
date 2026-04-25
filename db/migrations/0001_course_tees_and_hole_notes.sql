CREATE TABLE `course_tees` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_tees_deleted_at_idx` ON `course_tees` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `course_tees_course_id_idx` ON `course_tees` (`course_id`);--> statement-breakpoint
CREATE TABLE `course_hole_tee_yardages` (
	`id` text PRIMARY KEY NOT NULL,
	`course_hole_id` text NOT NULL,
	`course_tee_id` text NOT NULL,
	`yards` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`course_hole_id`) REFERENCES `course_holes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_tee_id`) REFERENCES `course_tees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_hole_tee_yardages_deleted_at_idx` ON `course_hole_tee_yardages` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `course_hole_tee_yardages_hole_id_idx` ON `course_hole_tee_yardages` (`course_hole_id`);--> statement-breakpoint
CREATE INDEX `course_hole_tee_yardages_tee_id_idx` ON `course_hole_tee_yardages` (`course_tee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_hole_tee_yardage_hole_tee_uq` ON `course_hole_tee_yardages` (`course_hole_id`,`course_tee_id`);--> statement-breakpoint
ALTER TABLE `course_holes` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `default_tee_id` text REFERENCES course_tees(id);--> statement-breakpoint
CREATE INDEX `courses_default_tee_id_idx` ON `courses` (`default_tee_id`);

CREATE TABLE `course_combos` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`front_nine_id` text NOT NULL,
	`back_nine_id` text NOT NULL,
	`rating` real NOT NULL,
	`slope` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`front_nine_id`) REFERENCES `course_nines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`back_nine_id`) REFERENCES `course_nines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_combos_deleted_at_idx` ON `course_combos` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `course_combos_course_id_idx` ON `course_combos` (`course_id`);--> statement-breakpoint
CREATE INDEX `course_combos_front_nine_id_idx` ON `course_combos` (`front_nine_id`);--> statement-breakpoint
CREATE INDEX `course_combos_back_nine_id_idx` ON `course_combos` (`back_nine_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_combos_course_id_front_back_uq` ON `course_combos` (`course_id`,`front_nine_id`,`back_nine_id`);--> statement-breakpoint
CREATE TABLE `course_holes` (
	`id` text PRIMARY KEY NOT NULL,
	`nine_id` text NOT NULL,
	`hole_number` integer NOT NULL,
	`par` integer NOT NULL,
	`handicap` integer,
	`yards` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`nine_id`) REFERENCES `course_nines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_holes_deleted_at_idx` ON `course_holes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `course_holes_nine_id_idx` ON `course_holes` (`nine_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_holes_nine_id_hole_number_uq` ON `course_holes` (`nine_id`,`hole_number`);--> statement-breakpoint
CREATE TABLE `course_nines` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_nines_deleted_at_idx` ON `course_nines` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `course_nines_course_id_idx` ON `course_nines` (`course_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `course_nines_course_id_name_uq` ON `course_nines` (`course_id`,`name`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `courses_deleted_at_idx` ON `courses` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `courses_name_idx` ON `courses` (`name`);--> statement-breakpoint
CREATE TABLE `hole_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`round_nine_id` text NOT NULL,
	`course_hole_id` text NOT NULL,
	`hole_number` integer NOT NULL,
	`strokes` integer NOT NULL,
	`putts` integer NOT NULL,
	`fairway_hit` integer DEFAULT false NOT NULL,
	`gir` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`round_nine_id`) REFERENCES `round_nines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_hole_id`) REFERENCES `course_holes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hole_scores_deleted_at_idx` ON `hole_scores` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `hole_scores_round_nine_id_idx` ON `hole_scores` (`round_nine_id`);--> statement-breakpoint
CREATE INDEX `hole_scores_course_hole_id_idx` ON `hole_scores` (`course_hole_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `hole_scores_round_nine_id_hole_number_uq` ON `hole_scores` (`round_nine_id`,`hole_number`);--> statement-breakpoint
CREATE TABLE `round_nines` (
	`id` text PRIMARY KEY NOT NULL,
	`round_id` text NOT NULL,
	`nine_id` text NOT NULL,
	`nine_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`round_id`) REFERENCES `rounds`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`nine_id`) REFERENCES `course_nines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `round_nines_deleted_at_idx` ON `round_nines` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `round_nines_round_id_idx` ON `round_nines` (`round_id`);--> statement-breakpoint
CREATE INDEX `round_nines_nine_id_idx` ON `round_nines` (`nine_id`);--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`combo_id` text,
	`date` text NOT NULL,
	`total_score` integer DEFAULT 0 NOT NULL,
	`handicap_differential` real,
	`is_complete` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`combo_id`) REFERENCES `course_combos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rounds_deleted_at_idx` ON `rounds` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `rounds_date_idx` ON `rounds` (`date`);--> statement-breakpoint
CREATE INDEX `rounds_is_complete_idx` ON `rounds` (`is_complete`);--> statement-breakpoint
CREATE INDEX `rounds_course_id_idx` ON `rounds` (`course_id`);--> statement-breakpoint
CREATE INDEX `rounds_combo_id_idx` ON `rounds` (`combo_id`);
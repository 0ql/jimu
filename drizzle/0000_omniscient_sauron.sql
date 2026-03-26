CREATE TABLE `exercises_update_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_id` integer NOT NULL,
	`action` text NOT NULL,
	`changed_at` integer NOT NULL,
	`changed_by` text,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_modified` integer NOT NULL,
	`workouts_string` text NOT NULL,
	FOREIGN KEY (`uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`uuid` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`passwordHash` text NOT NULL
);

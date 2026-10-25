CREATE TABLE `splits` (
	`uuid` text PRIMARY KEY NOT NULL,
	`last_modified` integer,
	`splits_json` text NOT NULL,
	FOREIGN KEY (`uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Renamed in place (not dropped and recreated) so everyone stays signed in.
ALTER TABLE `sessions` RENAME TO `login_sessions`;--> statement-breakpoint
ALTER TABLE `login_sessions` RENAME COLUMN `user_id` TO `user_uuid`;

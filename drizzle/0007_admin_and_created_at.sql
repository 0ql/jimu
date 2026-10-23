DROP TABLE `exercises_update_log`;--> statement-breakpoint
ALTER TABLE `users` ADD `is_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `created_at` integer;--> statement-breakpoint
-- The earliest account (by insertion order) becomes admin; new databases get theirs at first sign-up.
UPDATE `users` SET `is_admin` = 1 WHERE `rowid` = (SELECT MIN(`rowid`) FROM `users`);

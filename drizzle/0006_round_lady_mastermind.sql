CREATE TABLE `routines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`last_modified` integer,
	`routines_json` text NOT NULL,
	FOREIGN KEY (`uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routines_uuid_unique` ON `routines` (`uuid`);--> statement-breakpoint
ALTER TABLE `exercises` DROP COLUMN `hash`;
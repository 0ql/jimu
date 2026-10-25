CREATE TABLE `oauth_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`user_uuid` text NOT NULL,
	`client_id` text NOT NULL,
	`client_name` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text NOT NULL,
	`code_hash` text,
	`code_challenge` text,
	`code_expires_at` integer,
	`code_used` integer DEFAULT false NOT NULL,
	`access_hash` text,
	`access_expires_at` integer,
	`refresh_hash` text,
	`refresh_expires_at` integer,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_uuid`) REFERENCES `users`(`uuid`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_grants_code_hash_unique` ON `oauth_grants` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_grants_access_hash_unique` ON `oauth_grants` (`access_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_grants_refresh_hash_unique` ON `oauth_grants` (`refresh_hash`);
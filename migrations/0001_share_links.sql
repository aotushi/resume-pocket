CREATE TABLE `share_link` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerPrefix` text NOT NULL,
	`resumeId` text NOT NULL,
	`tokenHash` text NOT NULL,
	`tokenEnc` text NOT NULL,
	`target` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`profile` text DEFAULT '{}' NOT NULL,
	`expiresAt` integer,
	`active` integer DEFAULT true NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_link_tokenHash_unique` ON `share_link` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `share_link_owner_resume_idx` ON `share_link` (`ownerPrefix`,`resumeId`);
CREATE TABLE `share_view` (
	`id` text PRIMARY KEY NOT NULL,
	`linkId` text NOT NULL,
	`viewedAt` integer NOT NULL,
	`visitor` text NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`device` text DEFAULT '' NOT NULL,
	`browser` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`linkId`) REFERENCES `share_link`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `share_view_link_time_idx` ON `share_view` (`linkId`,`viewedAt`);
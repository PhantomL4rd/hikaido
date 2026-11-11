CREATE TABLE `result_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`response_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `result_share_response` ON `result_shares` (`response_id`);
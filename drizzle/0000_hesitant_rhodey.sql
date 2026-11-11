CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`reference_id` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`delivered_at` integer,
	`lease_until` integer
);
--> statement-breakpoint
CREATE INDEX `outbox_pending` ON `notification_outbox` (`status`,`lease_until`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`position` integer NOT NULL,
	`is_type_question` integer NOT NULL,
	`question_snapshot` text NOT NULL,
	`choice_a_snapshot` text NOT NULL,
	`choice_b_snapshot` text NOT NULL,
	`correct_choice` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `question_position` ON `questions` (`quiz_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `question_template` ON `questions` (`quiz_id`,`template_id`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`character_name` text NOT NULL,
	`question_count` integer NOT NULL,
	`hikansen_type` text NOT NULL,
	`management_token_hash` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_name_snapshot` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reports_status` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `response_answers` (
	`response_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_choice` text NOT NULL,
	`is_correct` integer NOT NULL,
	PRIMARY KEY(`response_id`, `question_id`),
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `answer_question` ON `response_answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`respondent_name` text NOT NULL,
	`correct_count` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`result_access_token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `response_idempotency` ON `responses` (`quiz_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `response_page` ON `responses` (`quiz_id`,`created_at`,`id`);
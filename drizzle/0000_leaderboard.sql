CREATE TABLE `race_records` (
	`route` text NOT NULL,
	`player` text NOT NULL,
	`score` integer NOT NULL,
	`name` text NOT NULL,
	`achieved` integer NOT NULL,
	PRIMARY KEY(`route`, `player`)
);
--> statement-breakpoint
CREATE INDEX `race_records_order` ON `race_records` (`route`,`score`,`achieved`,`player`);--> statement-breakpoint
CREATE TABLE `race_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`network` text NOT NULL,
	`route` text NOT NULL,
	`started` integer NOT NULL,
	`score` integer,
	`name` text,
	`updated` integer
);
--> statement-breakpoint
CREATE INDEX `race_runs_started` ON `race_runs` (`started`);--> statement-breakpoint
CREATE INDEX `race_runs_player_time` ON `race_runs` (`player`,`started`);--> statement-breakpoint
CREATE INDEX `race_runs_network_time` ON `race_runs` (`network`,`started`);
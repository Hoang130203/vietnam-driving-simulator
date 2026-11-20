CREATE TABLE `vehicle_choices` (
	`previous_vehicle` text NOT NULL,
	`vehicle` text NOT NULL,
	`trips` integer NOT NULL,
	PRIMARY KEY(`previous_vehicle`, `vehicle`)
);

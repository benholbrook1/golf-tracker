-- Mark a round as abandoned/cancelled without deleting it.

ALTER TABLE `rounds` ADD `abandoned_at` text;
CREATE INDEX `rounds_abandoned_at_idx` ON `rounds` (`abandoned_at`);


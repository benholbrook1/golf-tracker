-- Store a stock image key for course cards.

ALTER TABLE `courses` ADD `image_key` text;
CREATE INDEX `courses_image_key_idx` ON `courses` (`image_key`);


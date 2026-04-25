-- Store which tee was played for a round.

ALTER TABLE `rounds` ADD `tee_id` text REFERENCES course_tees(id);
CREATE INDEX `rounds_tee_id_idx` ON `rounds` (`tee_id`);


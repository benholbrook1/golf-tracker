-- Allow saving both directions (front/back vs back/front) and multiple variants.
-- Old rule: unique(course_id, front_nine_id, back_nine_id)
-- New rule: unique(course_id, name)

DROP INDEX IF EXISTS `course_combos_course_id_front_back_uq`;
CREATE UNIQUE INDEX `course_combos_course_id_name_uq` ON `course_combos` (`course_id`,`name`);


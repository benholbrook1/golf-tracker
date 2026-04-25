import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
};

// A golf facility (may contain multiple nines)
export const courses = sqliteTable(
  'courses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    imageKey: text('image_key'),
    defaultTeeId: text('default_tee_id').references((): any => courseTees.id),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('courses_deleted_at_idx').on(t.deletedAt),
    nameIdx: index('courses_name_idx').on(t.name),
    imageKeyIdx: index('courses_image_key_idx').on(t.imageKey),
    defaultTeeIdx: index('courses_default_tee_id_idx').on(t.defaultTeeId),
  })
);

// Named tee plate at a facility (e.g. Blue, White). Yardages are per (`course_hole` × `course_tee`).
export const courseTees = sqliteTable(
  'course_tees',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('course_tees_deleted_at_idx').on(t.deletedAt),
    courseIdIdx: index('course_tees_course_id_idx').on(t.courseId),
  })
);

// A named 9-hole loop within a facility (e.g. "Pine", "Oak", "Elm")
export const courseNines = sqliteTable(
  'course_nines',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    name: text('name').notNull(),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('course_nines_deleted_at_idx').on(t.deletedAt),
    courseIdIdx: index('course_nines_course_id_idx').on(t.courseId),
    courseIdNameUnique: uniqueIndex('course_nines_course_id_name_uq').on(t.courseId, t.name),
  })
);

// Individual hole configuration — belongs to a nine, not a course directly
export const courseHoles = sqliteTable(
  'course_holes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    nineId: text('nine_id')
      .notNull()
      .references(() => courseNines.id),
    holeNumber: integer('hole_number').notNull(), // 1–9 within the nine
    par: integer('par').notNull(), // 3–6 (validated at boundary; 3–5 typical)
    handicap: integer('handicap'), // stroke index; often 1–9 per nine or 1–18; nullable
    /** Mirrors the default tee’s yardage for legacy reads (round play). */
    yards: integer('yards'), // nullable
    notes: text('notes'),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('course_holes_deleted_at_idx').on(t.deletedAt),
    nineIdIdx: index('course_holes_nine_id_idx').on(t.nineId),
    nineHoleNumberUnique: uniqueIndex('course_holes_nine_id_hole_number_uq').on(t.nineId, t.holeNumber),
  })
);

export const courseHoleTeeYardages = sqliteTable(
  'course_hole_tee_yardages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    courseHoleId: text('course_hole_id')
      .notNull()
      .references(() => courseHoles.id),
    courseTeeId: text('course_tee_id')
      .notNull()
      .references(() => courseTees.id),
    yards: integer('yards'),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('course_hole_tee_yardages_deleted_at_idx').on(t.deletedAt),
    courseHoleIdIdx: index('course_hole_tee_yardages_hole_id_idx').on(t.courseHoleId),
    courseTeeIdIdx: index('course_hole_tee_yardages_tee_id_idx').on(t.courseTeeId),
    holeTeeUq: uniqueIndex('course_hole_tee_yardage_hole_tee_uq').on(t.courseHoleId, t.courseTeeId),
  })
);

// A rated 18-hole combination of two nines
export const courseCombos = sqliteTable(
  'course_combos',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    name: text('name').notNull(),
    frontNineId: text('front_nine_id')
      .notNull()
      .references(() => courseNines.id),
    backNineId: text('back_nine_id')
      .notNull()
      .references(() => courseNines.id),
    rating: real('rating').notNull(),
    slope: integer('slope').notNull(),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('course_combos_deleted_at_idx').on(t.deletedAt),
    courseIdIdx: index('course_combos_course_id_idx').on(t.courseId),
    frontNineIdIdx: index('course_combos_front_nine_id_idx').on(t.frontNineId),
    backNineIdIdx: index('course_combos_back_nine_id_idx').on(t.backNineId),
    courseIdNameUnique: uniqueIndex('course_combos_course_id_name_uq').on(t.courseId, t.name),
  })
);

// A round of golf — container for one or more round_nines
export const rounds = sqliteTable(
  'rounds',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    courseId: text('course_id')
      .notNull()
      .references(() => courses.id),
    comboId: text('combo_id').references(() => courseCombos.id), // null for 9-hole rounds
    teeId: text('tee_id').references(() => courseTees.id), // null for legacy rounds; should be set for new rounds
    date: text('date').notNull(), // ISO-8601 date "YYYY-MM-DD"
    totalScore: integer('total_score').notNull().default(0),
    handicapDifferential: real('handicap_differential'),
    isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),
    abandonedAt: text('abandoned_at'),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('rounds_deleted_at_idx').on(t.deletedAt),
    dateIdx: index('rounds_date_idx').on(t.date),
    isCompleteIdx: index('rounds_is_complete_idx').on(t.isComplete),
    courseIdIdx: index('rounds_course_id_idx').on(t.courseId),
    comboIdIdx: index('rounds_combo_id_idx').on(t.comboId),
    teeIdIdx: index('rounds_tee_id_idx').on(t.teeId),
    abandonedAtIdx: index('rounds_abandoned_at_idx').on(t.abandonedAt),
  })
);

// A single nine played within a round
export const roundNines = sqliteTable(
  'round_nines',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    roundId: text('round_id')
      .notNull()
      .references(() => rounds.id),
    nineId: text('nine_id')
      .notNull()
      .references(() => courseNines.id),
    nineOrder: integer('nine_order').notNull(), // 1 or 2
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('round_nines_deleted_at_idx').on(t.deletedAt),
    roundIdIdx: index('round_nines_round_id_idx').on(t.roundId),
    nineIdIdx: index('round_nines_nine_id_idx').on(t.nineId),
  })
);

// A single hole score — leaf node of the data model
export const holeScores = sqliteTable(
  'hole_scores',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    roundNineId: text('round_nine_id')
      .notNull()
      .references(() => roundNines.id),
    courseHoleId: text('course_hole_id')
      .notNull()
      .references(() => courseHoles.id),
    holeNumber: integer('hole_number').notNull(), // 1–9 within the nine
    strokes: integer('strokes').notNull(),
    putts: integer('putts').notNull(),
    fairwayHit: integer('fairway_hit', { mode: 'boolean' }).notNull().default(false),
    gir: integer('gir', { mode: 'boolean' }).notNull().default(false),
    penalties: integer('penalties').notNull().default(0),
    ...timestamps,
  },
  (t) => ({
    deletedAtIdx: index('hole_scores_deleted_at_idx').on(t.deletedAt),
    roundNineIdIdx: index('hole_scores_round_nine_id_idx').on(t.roundNineId),
    courseHoleIdIdx: index('hole_scores_course_hole_id_idx').on(t.courseHoleId),
    roundNineHoleNumberUnique: uniqueIndex('hole_scores_round_nine_id_hole_number_uq').on(
      t.roundNineId,
      t.holeNumber
    ),
  })
);

export const coursesRelations = relations(courses, ({ many, one }) => ({
  nines: many(courseNines),
  combos: many(courseCombos),
  rounds: many(rounds),
  tees: many(courseTees),
  defaultTee: one(courseTees, { fields: [courses.defaultTeeId], references: [courseTees.id] }),
}));

export const courseTeesRelations = relations(courseTees, ({ one, many }) => ({
  course: one(courses, { fields: [courseTees.courseId], references: [courses.id] }),
  holeYardages: many(courseHoleTeeYardages),
}));

export const courseNinesRelations = relations(courseNines, ({ one, many }) => ({
  course: one(courses, { fields: [courseNines.courseId], references: [courses.id] }),
  holes: many(courseHoles),
  frontCombos: many(courseCombos, { relationName: 'combo_front_nine' }),
  backCombos: many(courseCombos, { relationName: 'combo_back_nine' }),
  roundNines: many(roundNines),
}));

export const courseHolesRelations = relations(courseHoles, ({ one, many }) => ({
  nine: one(courseNines, { fields: [courseHoles.nineId], references: [courseNines.id] }),
  holeScores: many(holeScores),
  teeYardages: many(courseHoleTeeYardages),
}));

export const courseHoleTeeYardagesRelations = relations(courseHoleTeeYardages, ({ one }) => ({
  hole: one(courseHoles, { fields: [courseHoleTeeYardages.courseHoleId], references: [courseHoles.id] }),
  tee: one(courseTees, { fields: [courseHoleTeeYardages.courseTeeId], references: [courseTees.id] }),
}));

export const courseCombosRelations = relations(courseCombos, ({ one, many }) => ({
  course: one(courses, { fields: [courseCombos.courseId], references: [courses.id] }),
  frontNine: one(courseNines, {
    fields: [courseCombos.frontNineId],
    references: [courseNines.id],
    relationName: 'combo_front_nine',
  }),
  backNine: one(courseNines, {
    fields: [courseCombos.backNineId],
    references: [courseNines.id],
    relationName: 'combo_back_nine',
  }),
  rounds: many(rounds),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  course: one(courses, { fields: [rounds.courseId], references: [courses.id] }),
  combo: one(courseCombos, { fields: [rounds.comboId], references: [courseCombos.id] }),
  tee: one(courseTees, { fields: [rounds.teeId], references: [courseTees.id] }),
  roundNines: many(roundNines),
}));

export const roundNinesRelations = relations(roundNines, ({ one, many }) => ({
  round: one(rounds, { fields: [roundNines.roundId], references: [rounds.id] }),
  nine: one(courseNines, { fields: [roundNines.nineId], references: [courseNines.id] }),
  holeScores: many(holeScores),
}));

export const holeScoresRelations = relations(holeScores, ({ one }) => ({
  roundNine: one(roundNines, { fields: [holeScores.roundNineId], references: [roundNines.id] }),
  courseHole: one(courseHoles, { fields: [holeScores.courseHoleId], references: [courseHoles.id] }),
}));


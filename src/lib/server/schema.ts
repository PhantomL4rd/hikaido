import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const quizzes = sqliteTable("quizzes", {
  id: text().primaryKey(),
  characterName: text("character_name").notNull(),
  questionCount: integer("question_count").notNull(),
  hikansenType: text("hikansen_type").notNull(),
  managementTokenHash: text("management_token_hash").notNull(),
  status: text().notNull().default("published"),
  createdAt: integer("created_at").notNull(),
  deletedAt: integer("deleted_at"),
});
export const questions = sqliteTable(
  "questions",
  {
    id: text().primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    version: integer().notNull(),
    position: integer().notNull(),
    isTypeQuestion: integer("is_type_question", { mode: "boolean" }).notNull(),
    question: text("question_snapshot").notNull(),
    choiceA: text("choice_a_snapshot").notNull(),
    choiceB: text("choice_b_snapshot").notNull(),
    correctChoice: text("correct_choice", { enum: ["A", "B"] }).notNull(),
  },
  (t) => [
    uniqueIndex("question_position").on(t.quizId, t.position),
    uniqueIndex("question_template").on(t.quizId, t.templateId),
  ],
);
export const responses = sqliteTable(
  "responses",
  {
    id: text().primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    respondentName: text("respondent_name").notNull(),
    correctCount: integer("correct_count").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    resultAccessTokenHash: text("result_access_token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("response_idempotency").on(t.quizId, t.idempotencyKey),
    index("response_page").on(t.quizId, t.createdAt, t.id),
  ],
);
export const responseAnswers = sqliteTable(
  "response_answers",
  {
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedChoice: text("selected_choice", { enum: ["A", "B"] }).notNull(),
    isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.responseId, t.questionId] }),
    index("answer_question").on(t.questionId),
  ],
);
export const reports = sqliteTable(
  "reports",
  {
    id: text().primaryKey(),
    quizId: text("quiz_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    targetNameSnapshot: text("target_name_snapshot").notNull(),
    reason: text().notNull(),
    status: text().notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("reports_status").on(t.status, t.createdAt)],
);
export const contacts = sqliteTable("contacts", {
  id: text().primaryKey(),
  name: text(),
  email: text(),
  category: text().notNull(),
  message: text().notNull(),
  createdAt: integer("created_at").notNull(),
});
export const outbox = sqliteTable(
  "notification_outbox",
  {
    id: text().primaryKey(),
    eventType: text("event_type").notNull(),
    referenceId: text("reference_id").notNull(),
    payload: text().notNull(),
    status: text().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
    deliveredAt: integer("delivered_at"),
    leaseUntil: integer("lease_until"),
  },
  (t) => [index("outbox_pending").on(t.status, t.leaseUntil)],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const resultShares = sqliteTable(
  "result_shares",
  {
    id: text().primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("result_share_response").on(t.responseId)],
);

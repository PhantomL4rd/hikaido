import * as v from "valibot";
export const nameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "名前を入力してください"),
  v.maxLength(30, "名前は30文字以内です"),
  v.check(
    (name) =>
      [...name].every(
        (c) =>
          c.charCodeAt(0) >= 32 &&
          c.charCodeAt(0) !== 127 &&
          c !== "<" &&
          c !== ">",
      ),
    "使用できない文字があります",
  ),
);
export const choiceSchema = v.picklist(["A", "B"]);
const secret = v.pipe(v.string(), v.minLength(32), v.maxLength(128));
export const publishEntrySchema = v.object({
  managementToken: secret,
  turnstile: v.optional(v.string(), ""),
});
export const publishSchema = v.object({
  characterName: nameSchema,
  publishId: v.optional(v.pipe(v.string(), v.uuid())),
  publishPermit: v.optional(v.pipe(v.string(), v.maxLength(1024)), ""),
  questions: v.pipe(
    v.array(v.object({ templateId: v.string(), answer: choiceSchema })),
    v.minLength(10),
    v.maxLength(25),
  ),
  managementToken: secret,
  turnstile: v.optional(v.string(), ""),
});
export const answerEntrySchema = v.object({
  idempotencyKey: v.pipe(v.string(), v.uuid()),
  resultToken: secret,
  turnstile: v.optional(v.string(), ""),
});
export const answerSchema = v.object({
  respondentName: nameSchema,
  answerPermit: v.optional(v.pipe(v.string(), v.maxLength(1024)), ""),
  answers: v.pipe(
    v.array(v.object({ questionId: v.string(), choice: choiceSchema })),
    v.minLength(10),
    v.maxLength(25),
  ),
  idempotencyKey: v.pipe(v.string(), v.uuid()),
  resultToken: secret,
  turnstile: v.optional(v.string(), ""),
});
export const reportSchema = v.object({
  quizId: v.string(),
  targetType: v.picklist(["quiz", "response"]),
  targetId: v.string(),
  reason: v.picklist(["不適切な名前", "嫌がらせ", "個人情報", "その他"]),
  turnstile: v.optional(v.string(), ""),
});
export const contactSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(30)), ""),
  email: v.optional(
    v.union([v.literal(""), v.pipe(v.string(), v.email(), v.maxLength(254))]),
    "",
  ),
  category: v.picklist(["不具合報告", "ご意見・ご要望", "その他"]),
  message: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(1000)),
  turnstile: v.optional(v.string(), ""),
});

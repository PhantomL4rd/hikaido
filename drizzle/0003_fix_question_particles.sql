UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が誘うときは？'
WHERE template_id = 't053'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'の誘うときは？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が新パッチでまず楽しみたいのは？'
WHERE template_id = 't099'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '新パッチでまず楽しみたいのは？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'がじっくり取り組むなら？'
WHERE template_id = 't100'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'じっくり取り組むなら？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が達成感を感じるのは？'
WHERE template_id = 't101'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '達成感があるのは？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が冒険に出るなら？'
WHERE template_id = 't102'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '冒険に出るなら？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が新しい家具が増えたら？'
WHERE template_id = 't103'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '新しい家具が増えたら？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が休日に没頭するなら？'
WHERE template_id = 't104'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '休日に没頭するなら？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が景色を楽しむなら？'
WHERE template_id = 't105'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '景色を楽しむなら？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が空いた時間に進めたいのは？'
WHERE template_id = 't106'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '空いた時間に進めたいのは？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が新エリアでまずしたいのは？'
WHERE template_id = 't107'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '新エリアでまずしたいのは？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が寄り道するなら？'
WHERE template_id = 't108'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '寄り道するなら？';
--> statement-breakpoint
UPDATE questions
SET question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || 'が新しい装備で気になるのは？'
WHERE template_id = 't109'
  AND question_snapshot = (SELECT character_name FROM quizzes WHERE quizzes.id = questions.quiz_id) || '新しい装備で気になるのは？';

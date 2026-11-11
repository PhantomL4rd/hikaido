CREATE TRIGGER responses_published_only BEFORE INSERT ON responses
WHEN NOT EXISTS (SELECT 1 FROM quizzes WHERE id = NEW.quiz_id AND status = 'published')
BEGIN SELECT RAISE(ABORT, 'quiz unavailable'); END;

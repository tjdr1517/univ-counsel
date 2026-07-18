-- Preserve access for a teacher account created before username login was introduced.
UPDATE `users`
SET `email` = 'sungkyu0529'
WHERE `email` = 'sungkyu0529@gmail.com' AND `role` = 'teacher';

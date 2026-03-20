-- Add 'completed' to sessions status CHECK constraint
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('active', 'submitted', 'returned', 'exported', 'completed'));

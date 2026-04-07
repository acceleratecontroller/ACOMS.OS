-- Remove Task and RecurringTask tables and their related enums.
-- Task management is now handled by ACOMS.Controller.

-- Drop tables
DROP TABLE IF EXISTS "Task";
DROP TABLE IF EXISTS "RecurringTask";

-- Drop enums
DROP TYPE IF EXISTS "TaskStatus";
DROP TYPE IF EXISTS "TaskPriority";
DROP TYPE IF EXISTS "RecurringFrequency";
DROP TYPE IF EXISTS "ScheduleType";

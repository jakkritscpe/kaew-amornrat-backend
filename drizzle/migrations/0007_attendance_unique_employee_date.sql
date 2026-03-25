DROP INDEX IF EXISTS "attendance_logs_employee_date_idx";
CREATE UNIQUE INDEX "attendance_logs_employee_date_unique" ON "attendance_logs" ("employee_id", "date");

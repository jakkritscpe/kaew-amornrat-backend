CREATE INDEX IF NOT EXISTS "attendance_logs_employee_id_idx" ON "attendance_logs" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_date_idx" ON "attendance_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_status_idx" ON "attendance_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_logs_employee_date_idx" ON "attendance_logs" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ot_requests_employee_id_idx" ON "ot_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ot_requests_status_idx" ON "ot_requests" USING btree ("status");
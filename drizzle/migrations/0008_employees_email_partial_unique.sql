-- Replace the full unique constraint on email with a partial unique index
-- so soft-deleted employees don't block reuse of their email address.
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_email_unique";
CREATE UNIQUE INDEX "employees_email_active_unique" ON "employees" ("email") WHERE "deleted_at" IS NULL;

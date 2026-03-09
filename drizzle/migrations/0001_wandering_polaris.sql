ALTER TABLE "employees" ADD COLUMN "qr_token" text;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_qr_token_unique" UNIQUE("qr_token");
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'absent', 'on_leave');--> statement-breakpoint
CREATE TYPE "public"."ot_rate_type" AS ENUM('multiplier', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."ot_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'manager', 'employee');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"check_in_time" timestamp,
	"check_out_time" timestamp,
	"check_in_lat" real,
	"check_in_lng" real,
	"check_out_lat" real,
	"check_out_lng" real,
	"work_hours" real DEFAULT 0 NOT NULL,
	"ot_hours" real DEFAULT 0 NOT NULL,
	"status" "attendance_status" DEFAULT 'absent' NOT NULL,
	"location_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"default_ot_rate_type" "ot_rate_type" DEFAULT 'multiplier' NOT NULL,
	"default_ot_rate_value" real DEFAULT 1.5 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"nickname" varchar(100),
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"department" varchar(255) NOT NULL,
	"position" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"shift_start_time" time DEFAULT '08:00:00' NOT NULL,
	"shift_end_time" time DEFAULT '17:00:00' NOT NULL,
	"location_id" text,
	"base_wage" numeric(10, 2),
	"ot_rate_use_default" boolean DEFAULT true NOT NULL,
	"ot_rate_type" "ot_rate_type",
	"ot_rate_value" real,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ot_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"reason" text NOT NULL,
	"status" "ot_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"radius_meters" real DEFAULT 200 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_location_id_work_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."work_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employees" ADD CONSTRAINT "employees_location_id_work_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."work_locations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

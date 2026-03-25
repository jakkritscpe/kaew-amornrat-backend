CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "holidays_date_idx" ON "holidays" USING btree ("date");

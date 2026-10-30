CREATE TYPE "public"."post_kind" AS ENUM('announcement', 'payment', 'pot_complete', 'payout');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cycle_id" integer,
	"round" integer,
	"kind" "post_kind" NOT NULL,
	"author_id" integer,
	"body" text NOT NULL,
	"attachment_key" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bank_details" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
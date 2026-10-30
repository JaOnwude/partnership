CREATE TABLE "fine_waivers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fine_waivers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cycle_id" integer NOT NULL,
	"round" integer NOT NULL,
	"user_id" integer NOT NULL,
	"waived_by" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "receipt_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "fine_waivers" ADD CONSTRAINT "fine_waivers_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fine_waivers" ADD CONSTRAINT "fine_waivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fine_waivers" ADD CONSTRAINT "fine_waivers_waived_by_users_id_fk" FOREIGN KEY ("waived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fine_waivers_one_per_round" ON "fine_waivers" USING btree ("cycle_id","round","user_id");--> statement-breakpoint
ALTER TABLE "payouts" DROP COLUMN "collected_amount";--> statement-breakpoint
ALTER TABLE "payouts" DROP COLUMN "covered_amount";
CREATE TABLE "demografia_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_account_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"age" text NOT NULL,
	"gender" text NOT NULL,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"actions" jsonb,
	"action_values" jsonb,
	"date_start" date NOT NULL,
	"date_stop" date NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regiao_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_account_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"campaign_name" text NOT NULL,
	"region" text NOT NULL,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"actions" jsonb,
	"action_values" jsonb,
	"date_start" date NOT NULL,
	"date_stop" date NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_insights" ADD COLUMN "objective" text;--> statement-breakpoint
ALTER TABLE "demografia_insights" ADD CONSTRAINT "demografia_insights_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regiao_insights" ADD CONSTRAINT "regiao_insights_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demografia_account_campaign_date_idx" ON "demografia_insights" USING btree ("ad_account_id","campaign_id","date_stop");--> statement-breakpoint
CREATE INDEX "regiao_account_campaign_date_idx" ON "regiao_insights" USING btree ("ad_account_id","campaign_id","date_stop");

CREATE TABLE "ad_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_account_id" uuid NOT NULL,
	"ad_id" text NOT NULL,
	"ad_name" text NOT NULL,
	"adset_id" text,
	"adset_name" text,
	"campaign_id" text,
	"campaign_name" text,
	"thumbnail_url" text,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"ctr" numeric(8, 4),
	"actions" jsonb,
	"action_values" jsonb,
	"date_start" date NOT NULL,
	"date_stop" date NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adset_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_account_id" uuid NOT NULL,
	"adset_id" text NOT NULL,
	"adset_name" text NOT NULL,
	"campaign_id" text,
	"campaign_name" text,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"ctr" numeric(8, 4),
	"actions" jsonb,
	"action_values" jsonb,
	"date_start" date NOT NULL,
	"date_stop" date NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_insights" ADD CONSTRAINT "ad_insights_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adset_insights" ADD CONSTRAINT "adset_insights_ad_account_id_ad_accounts_id_fk" FOREIGN KEY ("ad_account_id") REFERENCES "public"."ad_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_account_ad_date_idx" ON "ad_insights" USING btree ("ad_account_id","ad_id","date_start");--> statement-breakpoint
CREATE INDEX "adset_account_adset_date_idx" ON "adset_insights" USING btree ("ad_account_id","adset_id","date_start");
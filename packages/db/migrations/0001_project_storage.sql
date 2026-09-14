CREATE TABLE "app_state" (
	"key" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_entries" (
	"project_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_entries_project_id_path_pk" PRIMARY KEY("project_id","path")
);

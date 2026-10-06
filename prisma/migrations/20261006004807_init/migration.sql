-- CreateEnum
CREATE TYPE "role" AS ENUM ('ADMIN', 'TEAM_MEMBER');

-- CreateEnum
CREATE TYPE "work_order_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "activity_type" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNEE_CHANGED', 'PRIORITY_CHANGED', 'DUE_DATE_CHANGED', 'DETAILS_UPDATED', 'COMMENT_ADDED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "role" NOT NULL DEFAULT 'TEAM_MEMBER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_areas" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "work_order_status" NOT NULL DEFAULT 'OPEN',
    "priority" "priority" NOT NULL DEFAULT 'MEDIUM',
    "service_area_id" TEXT NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "assignee_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_comments" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_activities" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "type" "activity_type" NOT NULL,
    "from_status" "work_order_status",
    "to_status" "work_order_status",
    "changes" JSONB,
    "description" VARCHAR(500) NOT NULL,
    "comment_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_areas_name_key" ON "service_areas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_number_key" ON "work_orders"("number");

-- CreateIndex
CREATE INDEX "work_orders_status_due_at_idx" ON "work_orders"("status", "due_at");

-- CreateIndex
CREATE INDEX "work_orders_assignee_id_status_idx" ON "work_orders"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_priority_status_idx" ON "work_orders"("priority", "status");

-- CreateIndex
CREATE INDEX "work_orders_service_area_id_idx" ON "work_orders"("service_area_id");

-- CreateIndex
CREATE INDEX "work_orders_created_by_id_idx" ON "work_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "work_orders_created_at_idx" ON "work_orders"("created_at");

-- CreateIndex
CREATE INDEX "work_orders_updated_at_idx" ON "work_orders"("updated_at");

-- CreateIndex
CREATE INDEX "work_orders_completed_at_idx" ON "work_orders"("completed_at");

-- CreateIndex
CREATE INDEX "work_order_comments_work_order_id_created_at_idx" ON "work_order_comments"("work_order_id", "created_at");

-- CreateIndex
CREATE INDEX "work_order_comments_author_id_idx" ON "work_order_comments"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_activities_comment_id_key" ON "work_order_activities"("comment_id");

-- CreateIndex
CREATE INDEX "work_order_activities_work_order_id_created_at_idx" ON "work_order_activities"("work_order_id", "created_at");

-- CreateIndex
CREATE INDEX "work_order_activities_created_at_idx" ON "work_order_activities"("created_at");

-- CreateIndex
CREATE INDEX "work_order_activities_type_to_status_created_at_idx" ON "work_order_activities"("type", "to_status", "created_at");

-- CreateIndex
CREATE INDEX "work_order_activities_actor_id_idx" ON "work_order_activities"("actor_id");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_service_area_id_fkey" FOREIGN KEY ("service_area_id") REFERENCES "service_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_comments" ADD CONSTRAINT "work_order_comments_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_comments" ADD CONSTRAINT "work_order_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "work_order_comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written integrity rules (not expressible in Prisma's schema language).
-- Prisma does not model CHECK constraints, functions, or triggers: it neither
-- generates nor removes them. They are reviewed and versioned in this migration.
-- ---------------------------------------------------------------------------

-- users: Better Auth lowercases emails on sign-up and sign-in; enforce it here too.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));

-- service_areas
ALTER TABLE "service_areas" ADD CONSTRAINT "service_areas_name_not_blank_check" CHECK (char_length(btrim("name")) > 0);

-- work_orders
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_title_length_check" CHECK (char_length(btrim("title")) BETWEEN 3 AND 120);
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_description_length_check" CHECK (char_length(btrim("description")) BETWEEN 1 AND 5000);
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_version_nonnegative_check" CHECK ("version" >= 0);
-- completed_at is set exactly when the work order is COMPLETED.
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_completed_at_matches_status_check" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));
-- cancelled_at is set exactly when the work order is CANCELLED.
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_cancelled_at_matches_status_check" CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));
-- IN_PROGRESS, BLOCKED, and COMPLETED work must have an assignee (decision D6).
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_assignee_required_check" CHECK ("status" NOT IN ('IN_PROGRESS', 'BLOCKED', 'COMPLETED') OR "assignee_id" IS NOT NULL);
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_completed_after_created_check" CHECK ("completed_at" IS NULL OR "completed_at" >= "created_at");
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_cancelled_after_created_check" CHECK ("cancelled_at" IS NULL OR "cancelled_at" >= "created_at");

-- work_order_comments
ALTER TABLE "work_order_comments" ADD CONSTRAINT "work_order_comments_body_length_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 2000);

-- work_order_activities
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_status_change_check" CHECK ("type" <> 'STATUS_CHANGED' OR ("from_status" IS NOT NULL AND "to_status" IS NOT NULL AND "from_status" <> "to_status"));
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_comment_required_check" CHECK ("type" <> 'COMMENT_ADDED' OR "comment_id" IS NOT NULL);
ALTER TABLE "work_order_activities" ADD CONSTRAINT "work_order_activities_description_not_blank_check" CHECK (char_length(btrim("description")) > 0);

-- Append-only audit records: block UPDATE and DELETE of comments and activity rows.
-- Limits: these row triggers do not fire for TRUNCATE, and a privileged database role
-- can disable or drop them. They guard against application bugs; they are not a
-- tamper-proof audit system.
CREATE FUNCTION "prevent_audit_record_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only (% is not allowed)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "work_order_comments_append_only"
  BEFORE UPDATE OR DELETE ON "work_order_comments"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_record_mutation"();

CREATE TRIGGER "work_order_activities_append_only"
  BEFORE UPDATE OR DELETE ON "work_order_activities"
  FOR EACH ROW EXECUTE FUNCTION "prevent_audit_record_mutation"();

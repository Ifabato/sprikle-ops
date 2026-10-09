// Query-plan check for the list, dashboard, and analytics queries on a larger dataset
// (product-requirements.md, Performance). Touches ONLY sprikle_ops_test, through the same
// fail-closed guard as the tests: it truncates that database, bulk-loads synthetic rows, runs
// EXPLAIN (ANALYZE, BUFFERS) for each query shape, prints a summary, and truncates again.
// Run with: pnpm perf:explain   (results are recorded in docs/performance.md)
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  assertCurrentDatabaseIsTest,
  assertSafeTestDatabase,
  TRUNCATABLE_TABLES,
} from "../tests/helpers/database-safety.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const url = assertSafeTestDatabase({
  NODE_ENV: "test",
  DATABASE_URL: process.env.DATABASE_URL,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
});
const ROWS = Number(process.env.EXPLAIN_ROWS ?? 5000);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 1 }) });

async function truncate() {
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ current_database: string }[]>`SELECT current_database()`;
    assertCurrentDatabaseIsTest(rows[0]?.current_database);
    await tx.$executeRawUnsafe(
      `TRUNCATE TABLE ${TRUNCATABLE_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY`,
    );
  });
}

async function load() {
  // Deterministic synthetic data generated in SQL: 20 users, 4 service areas, ROWS work orders
  // spread over ~1 year with a realistic status mix, and 3 activity rows per work order.
  await db.$executeRawUnsafe(`
    INSERT INTO users (id, name, email, role, is_active, updated_at)
    SELECT 'u' || g, 'User ' || g, 'user' || g || '@perf.test',
           CASE WHEN g = 1 THEN 'ADMIN'::role ELSE 'TEAM_MEMBER'::role END, g <> 20, now()
    FROM generate_series(1, 20) g`);
  await db.$executeRawUnsafe(`
    INSERT INTO service_areas (id, name) SELECT 'a' || g, 'Area ' || g FROM generate_series(1, 4) g`);
  await db.$executeRawUnsafe(`
    INSERT INTO work_orders (id, title, description, status, priority, service_area_id, due_at,
                             assignee_id, created_by_id, created_at, updated_at, completed_at, cancelled_at)
    SELECT 'w' || g,
           'Work order ' || g || ' ' || (ARRAY['valve','filter','pump','door','light'])[1 + g % 5],
           'Synthetic description ' || g,
           s.status, (ARRAY['LOW','MEDIUM','HIGH','CRITICAL'])[1 + (g * 7) % 4]::priority,
           'a' || (1 + g % 4),
           c.created + interval '1 day' * (1 + g % 14),
           CASE WHEN s.status = 'OPEN' AND g % 3 = 0 THEN NULL ELSE 'u' || (2 + g % 18) END,
           'u1', c.created, c.created + interval '1 hour',
           CASE WHEN s.status = 'COMPLETED' THEN c.created + interval '1 hour' * (2 + g % 200) END,
           CASE WHEN s.status = 'CANCELLED' THEN c.created + interval '1 hour' END
    FROM generate_series(1, ${ROWS}) g
    CROSS JOIN LATERAL (SELECT now() - interval '1 minute' * ((g * 104729) % 525600) AS created) c
    CROSS JOIN LATERAL (SELECT (CASE WHEN g % 10 < 6 THEN 'COMPLETED' WHEN g % 10 = 6 THEN 'CANCELLED'
                                     WHEN g % 10 = 7 THEN 'IN_PROGRESS' WHEN g % 10 = 8 THEN 'BLOCKED'
                                     ELSE 'OPEN' END)::work_order_status AS status) s`);
  await db.$executeRawUnsafe(`
    INSERT INTO work_order_activities (id, work_order_id, actor_id, type, description, created_at)
    SELECT 'x' || w.number || '-' || k, w.id, 'u1', 'CREATED', 'Synthetic', w.created_at + interval '1 minute' * k
    FROM work_orders w CROSS JOIN generate_series(1, 3) k`);
  await db.$executeRawUnsafe("ANALYZE");
}

const QUERIES: [string, string][] = [
  [
    "List: default (active, sort by due, page 1)",
    `SELECT * FROM work_orders WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED')
     ORDER BY due_at ASC, number ASC LIMIT 25`,
  ],
  [
    "List: team member scope (assignee + active)",
    `SELECT * FROM work_orders WHERE assignee_id = 'u5' AND status IN ('OPEN','IN_PROGRESS','BLOCKED')
     ORDER BY due_at ASC, number ASC LIMIT 25`,
  ],
  [
    "List: overdue filter count",
    `SELECT count(*) FROM work_orders WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED') AND due_at < now()`,
  ],
  [
    "List: text search (ILIKE, no trigram index; should-have #5)",
    `SELECT * FROM work_orders WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED')
     AND (title ILIKE '%pump%' OR description ILIKE '%pump%') ORDER BY due_at, number LIMIT 25`,
  ],
  [
    "Dashboard: active counts by status",
    `SELECT status, count(*) FROM work_orders WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED') GROUP BY status`,
  ],
  [
    "Dashboard: completion-rate cohort (created in last 30 days)",
    `SELECT status, count(*) FROM work_orders WHERE created_at >= now() - interval '30 days' GROUP BY status`,
  ],
  [
    "Dashboard: recent activity (latest 10)",
    `SELECT * FROM work_order_activities ORDER BY created_at DESC, id DESC LIMIT 10`,
  ],
  [
    "Analytics: completed in last 12 weeks",
    `SELECT completed_at FROM work_orders WHERE status = 'COMPLETED' AND completed_at >= now() - interval '84 days'`,
  ],
  [
    "Analytics: workload by assignee and status",
    `SELECT assignee_id, status, count(*) FROM work_orders WHERE status IN ('OPEN','IN_PROGRESS','BLOCKED')
     GROUP BY assignee_id, status`,
  ],
];

try {
  await truncate();
  await load();
  const [loaded] = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM work_orders`;
  console.log(`Loaded ${loaded?.count ?? 0} work orders into sprikle_ops_test.\n`);
  for (const [label, sql] of QUERIES) {
    const plan = await db.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
      `EXPLAIN (ANALYZE, BUFFERS) ${sql}`,
    );
    const lines = plan.map((row) => row["QUERY PLAN"]);
    const nodes = lines
      .filter((line) => /(Scan|Sort|Aggregate|Limit)/.test(line))
      .map((line) => line.trim().replace(/\s+\(cost=.*$/, ""));
    const time = lines.find((line) => line.startsWith("Execution Time"));
    console.log(`${label}\n  ${nodes.join("\n  ")}\n  ${time}\n`);
  }
} finally {
  await truncate();
  await db.$disconnect();
}

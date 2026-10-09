// Adds demo service areas and work orders to the LOCAL DEVELOPMENT database (sprikle_ops).
// Additive and non-destructive:
//   - refuses any database other than sprikle_ops on a local host;
//   - requires the demo accounts from `pnpm db:seed:auth` (never creates or changes users);
//   - creates only missing service areas;
//   - refuses to run when any work order already exists, so existing data is never overwritten
//     or mixed with demo history. Nothing is deleted or reset.
// Every work order is created and updated through the application's service layer.
// Run with: pnpm db:seed:demo
import { existsSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { DEMO_SERVICE_AREAS, seedDemoWorkOrders } from "./lib/demo-work-orders.ts";

const DEVELOPMENT_DATABASE = "sprikle_ops";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEMO_EMAILS = {
  admin: "admin@sprikle.test",
  one: "tech.one@sprikle.test",
  two: "tech.two@sprikle.test",
} as const;

function fail(message: string): never {
  console.error(`Refusing to seed demo data: ${message}.`);
  process.exit(1);
}

if (existsSync(".env")) {
  process.loadEnvFile(".env"); // never overrides variables already set
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) fail("DATABASE_URL is not set");
let target: URL;
try {
  target = new URL(databaseUrl);
} catch {
  fail("DATABASE_URL is not a valid URL");
}
if (!LOCAL_HOSTS.has(target.hostname.toLowerCase())) fail("the database host is not local");
if (decodeURIComponent(target.pathname.slice(1)) !== DEVELOPMENT_DATABASE) {
  fail(`the target database is not '${DEVELOPMENT_DATABASE}'`);
}
if ([...target.searchParams.keys()].some((key) => key !== "schema")) {
  fail("unexpected connection parameters");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, max: 2 }) });
try {
  const [{ current_database: current } = { current_database: "" }] = await db.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;
  if (current !== DEVELOPMENT_DATABASE) fail("connected to an unexpected database");

  const existing = await db.workOrder.count();
  if (existing > 0) {
    fail(
      `the database already has ${existing} work orders (demo data is only added to an empty work-order table)`,
    );
  }

  const users = await db.user.findMany({
    where: { email: { in: Object.values(DEMO_EMAILS) } },
    select: { id: true, email: true, role: true, isActive: true },
  });
  const byEmail = new Map(users.map((user) => [user.email, user]));
  const actorFor = (email: string) => {
    const user = byEmail.get(email);
    if (!user || !user.isActive) {
      fail(`active demo account ${email} is missing (run pnpm db:seed:auth first)`);
    }
    return { id: user.id, role: user.role, isActive: true } as const;
  };
  const actors = {
    admin: actorFor(DEMO_EMAILS.admin),
    one: actorFor(DEMO_EMAILS.one),
    two: actorFor(DEMO_EMAILS.two),
  };
  if (actors.admin.role !== "ADMIN") fail("the demo admin account is not an ADMIN");

  const areaIds = {} as Record<(typeof DEMO_SERVICE_AREAS)[number], string>;
  for (const name of DEMO_SERVICE_AREAS) {
    const area =
      (await db.serviceArea.findUnique({ where: { name }, select: { id: true } })) ??
      (await db.serviceArea.create({ data: { name }, select: { id: true } }));
    areaIds[name] = area.id;
  }

  const result = await seedDemoWorkOrders(db, actors, areaIds, new Date());
  console.log(
    `Demo data added: ${result.workOrders} work orders, ${result.activities} activity entries, ${DEMO_SERVICE_AREAS.length} service areas.`,
  );
} finally {
  await db.$disconnect();
}

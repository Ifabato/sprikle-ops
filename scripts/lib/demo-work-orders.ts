// Deterministic demo work orders, written through the REAL service layer (validation, permission
// rules, transactions, and audit activity) at historical timestamps relative to `now`. Nothing is
// inserted directly, so every record, comment, and activity is one the application itself could
// have produced. Synthetic data only: no real people, customers, or sites.
import type { Actor } from "../../src/domain/permissions.ts";
import {
  addLocalDays,
  formatDateOnly,
  localDateOf,
  startOfLocalDay,
} from "../../src/domain/time.ts";
import type { PrismaClient } from "../../src/generated/prisma/client.ts";
import {
  addComment,
  createWorkOrder,
  editWorkOrder,
  transitionWorkOrder,
} from "../../src/server/services/work-orders.ts";

export const DEMO_SERVICE_AREAS = ["Downtown", "Harbor", "North District", "Westside"] as const;
type Area = (typeof DEMO_SERVICE_AREAS)[number];
type Who = "admin" | "one" | "two";
type Status = "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED" | "OPEN";

type Step =
  | { readonly at: number; readonly by: Who; readonly to: Status; readonly note?: string }
  | { readonly at: number; readonly by: Who; readonly comment: string }
  | { readonly at: number; readonly by: "admin"; readonly assign: Who | null }
  | {
      readonly at: number;
      readonly by: "admin";
      readonly priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    };

interface Spec {
  readonly title: string;
  readonly description: string;
  readonly area: Area;
  readonly priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Local days before today on which the work order was created. */
  readonly createdDaysAgo: number;
  /** Due date = creation date + this many local days. */
  readonly dueAfterDays: number;
  readonly assignee: Who | null;
  /** `at` = hours after creation. */
  readonly steps: readonly Step[];
}

// Hand-written scenarios covering every status, every attention category, the due filters, and
// reopened / restored history. Older, completed work feeds the 12-week trend.
const SCENARIOS: readonly Spec[] = [
  {
    title: "Leaking valve in boiler room",
    description: "Pressure-relief valve on boiler 2 is dripping steadily. Replace valve and test.",
    area: "Downtown",
    priority: "HIGH",
    createdDaysAgo: 3,
    dueAfterDays: 4,
    assignee: "two",
    steps: [
      { at: 1, by: "two", to: "IN_PROGRESS" },
      {
        at: 26,
        by: "two",
        to: "BLOCKED",
        note: "Waiting on a replacement valve kit from the supplier.",
      },
      { at: 27, by: "admin", comment: "Kit ordered; expected Thursday." },
    ],
  },
  {
    title: "Rooftop condenser inspection",
    description:
      "Quarterly inspection of rooftop condenser units 1–3; record refrigerant pressures.",
    area: "North District",
    priority: "MEDIUM",
    createdDaysAgo: 9,
    dueAfterDays: 7,
    assignee: "one",
    steps: [{ at: 20, by: "one", to: "IN_PROGRESS" }],
  },
  {
    title: "Replace kitchen exhaust fan belt",
    description: "Exhaust fan belt is squealing at startup. Replace belt and check tension.",
    area: "Harbor",
    priority: "CRITICAL",
    createdDaysAgo: 1,
    dueAfterDays: 1,
    assignee: "one",
    steps: [],
  },
  {
    title: "Irrigation zone 3 not watering",
    description: "Zone 3 controller shows active but heads stay down. Check valve solenoid.",
    area: "Westside",
    priority: "LOW",
    createdDaysAgo: 2,
    dueAfterDays: 8,
    assignee: null,
    steps: [],
  },
  {
    title: "Quarterly backflow test",
    description: "Annual certification test of the main backflow preventer; file the report.",
    area: "Downtown",
    priority: "MEDIUM",
    createdDaysAgo: 2,
    dueAfterDays: 4,
    assignee: "one",
    steps: [{ at: 3, by: "admin", comment: "Bring the test kit from the Harbor van." }],
  },
  {
    title: "Thermostat recalibration",
    description: "Tenant reports suite 410 runs 3 degrees warm. Recalibrate and verify.",
    area: "North District",
    priority: "MEDIUM",
    createdDaysAgo: 6,
    dueAfterDays: 3,
    assignee: "two",
    steps: [
      { at: 2, by: "two", to: "IN_PROGRESS" },
      { at: 30, by: "two", to: "COMPLETED", note: "Recalibrated and tested over 2 hours." },
    ],
  },
  {
    title: "Burst pipe in parking level B2",
    description: "Water pooling near column 14. Isolate the line and repair.",
    area: "Harbor",
    priority: "CRITICAL",
    createdDaysAgo: 0,
    dueAfterDays: 0,
    assignee: null,
    steps: [],
  },
  {
    title: "Emergency lighting monthly test",
    description: "Run the 30-second test on all emergency fixtures and log failures.",
    area: "Westside",
    priority: "HIGH",
    createdDaysAgo: 12,
    dueAfterDays: 5,
    assignee: "two",
    steps: [{ at: 4, by: "two", to: "IN_PROGRESS" }],
  },
  {
    title: "Fix sticking loading dock door",
    description: "Roll-up door 2 stops halfway. Inspect track and opener limit switch.",
    area: "Harbor",
    priority: "HIGH",
    createdDaysAgo: 5,
    dueAfterDays: 8,
    assignee: null,
    steps: [],
  },
  {
    title: "Repaint stairwell handrails",
    description: "Handrails in stairwells A and B are chipped. Sand and repaint.",
    area: "Downtown",
    priority: "LOW",
    createdDaysAgo: 4,
    dueAfterDays: 21,
    assignee: "one",
    steps: [],
  },
  {
    title: "Replace lobby light fixture",
    description: "Fixture flickers; replace ballast and bulbs.",
    area: "Downtown",
    priority: "MEDIUM",
    createdDaysAgo: 15,
    dueAfterDays: 5,
    assignee: "one",
    steps: [
      { at: 2, by: "one", to: "IN_PROGRESS" },
      { at: 20, by: "one", to: "COMPLETED", note: "Ballast replaced." },
      { at: 70, by: "admin", to: "IN_PROGRESS", note: "Reopened: fixture flickering again." },
      { at: 96, by: "one", to: "COMPLETED", note: "Replaced the whole fixture this time." },
    ],
  },
  {
    title: "Duplicate request: lobby light",
    description: "Second report of the lobby fixture flicker.",
    area: "Downtown",
    priority: "LOW",
    createdDaysAgo: 15,
    dueAfterDays: 5,
    assignee: null,
    steps: [
      {
        at: 1,
        by: "admin",
        to: "CANCELLED",
        note: "Duplicate of the lobby light fixture work order.",
      },
    ],
  },
  {
    title: "Gate latch adjustment",
    description: "Courtyard gate does not latch on its own. Adjust the closer.",
    area: "Westside",
    priority: "LOW",
    createdDaysAgo: 8,
    dueAfterDays: 6,
    assignee: null,
    steps: [
      { at: 1, by: "admin", to: "CANCELLED", note: "Tenant fixed it themselves." },
      { at: 50, by: "admin", to: "OPEN" },
      { at: 51, by: "admin", assign: "two" },
      { at: 52, by: "admin", priority: "MEDIUM" },
    ],
  },
];

const ROUTINE_TITLES = [
  ["Replace HVAC filters", "Swap filters on air handlers per the quarterly schedule."],
  ["Clear roof drains", "Remove debris from roof drains before forecast rain."],
  ["Test fire pump", "Weekly churn test of the fire pump; log pressures."],
  ["Lubricate door closers", "Lubricate and adjust closers on ground-floor doors."],
  ["Inspect water heater anode", "Check anode rod condition on water heater 1."],
  ["Reset tripped breaker panel 4", "Investigate repeated trips on panel 4, circuit 12."],
] as const;

/** Small deterministic PRNG (mulberry32) so the routine history is identical on every run. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Completed routine work spread over the last 12 weeks so the trend chart has real history. */
function routineScenarios(): Spec[] {
  const random = prng(20261009);
  const specs: Spec[] = [];
  for (let i = 0; i < 24; i += 1) {
    const [title, description] = ROUTINE_TITLES[i % ROUTINE_TITLES.length]!;
    const createdDaysAgo = 18 + Math.floor(random() * 64);
    const who: Who = random() < 0.5 ? "one" : "two";
    const finishHours = 4 + Math.floor(random() * 90);
    specs.push({
      title,
      description,
      area: DEMO_SERVICE_AREAS[Math.floor(random() * DEMO_SERVICE_AREAS.length)]!,
      priority: random() < 0.2 ? "HIGH" : random() < 0.6 ? "MEDIUM" : "LOW",
      createdDaysAgo,
      dueAfterDays: 3 + Math.floor(random() * 7),
      assignee: who,
      steps: [
        { at: 1, by: who, to: "IN_PROGRESS" },
        { at: finishHours, by: who, to: "COMPLETED" },
      ],
    });
  }
  return specs;
}

export interface DemoActors {
  readonly admin: Actor;
  readonly one: Actor;
  readonly two: Actor;
}

export interface DemoSeedResult {
  readonly workOrders: number;
  readonly activities: number;
}

const HOUR = 3_600_000;

/**
 * Creates the demo work orders. The caller guarantees the target database is the intended one
 * and that it holds no work orders yet. Timestamps never exceed `now`.
 */
export async function seedDemoWorkOrders(
  db: PrismaClient,
  actors: DemoActors,
  areaIds: Readonly<Record<Area, string>>,
  now: Date,
): Promise<DemoSeedResult> {
  const today = localDateOf(now);
  // Oldest first, so reference numbers follow creation time.
  const specs = [...routineScenarios(), ...SCENARIOS].sort(
    (a, b) => b.createdDaysAgo - a.createdDaysAgo,
  );
  const latest = now.getTime() - 60_000;

  for (const [index, spec] of specs.entries()) {
    const day = addLocalDays(today, -spec.createdDaysAgo);
    // Business hours (08:00 local plus a stable offset), but never in the future.
    const createdAt = new Date(
      Math.min(
        startOfLocalDay(day).getTime() + 8 * HOUR + (index % 9) * 23 * 60_000,
        latest - 4 * HOUR,
      ),
    );
    const created = await createWorkOrder(
      db,
      actors.admin,
      {
        title: spec.title,
        description: spec.description,
        serviceAreaId: areaIds[spec.area],
        priority: spec.priority,
        dueDate: formatDateOnly(addLocalDays(localDateOf(createdAt), spec.dueAfterDays)),
        assigneeId: spec.assignee ? actors[spec.assignee].id : null,
      },
      createdAt,
    );
    if (!created.ok)
      throw new Error(`Demo seed: create failed (${created.code}) for "${spec.title}"`);

    let version = created.data.version;
    let previous = createdAt.getTime();
    for (const step of spec.steps) {
      // Strictly increasing and never later than `now`.
      const at = new Date(
        Math.min(Math.max(createdAt.getTime() + step.at * HOUR, previous + 60_000), latest),
      );
      previous = at.getTime();
      const actor = actors[step.by];
      const number = created.data.number;
      if ("to" in step) {
        const result = await transitionWorkOrder(
          db,
          actor,
          number,
          { version, toStatus: step.to, note: step.note },
          at,
        );
        if (!result.ok)
          throw new Error(`Demo seed: ${step.to} failed (${result.code}) for "${spec.title}"`);
        version = result.data.version;
      } else if ("comment" in step) {
        const result = await addComment(db, actor, number, { body: step.comment }, at);
        if (!result.ok)
          throw new Error(`Demo seed: comment failed (${result.code}) for "${spec.title}"`);
      } else {
        const change =
          "assign" in step
            ? { assigneeId: step.assign ? actors[step.assign].id : null }
            : { priority: step.priority };
        const result = await editWorkOrder(db, actor, number, { version, ...change }, at);
        if (!result.ok)
          throw new Error(`Demo seed: edit failed (${result.code}) for "${spec.title}"`);
        version = result.data.workOrder.version;
      }
    }
  }

  return {
    workOrders: await db.workOrder.count(),
    activities: await db.workOrderActivity.count(),
  };
}

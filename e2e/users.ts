// Synthetic browser-test accounts. They exist only in sprikle_ops_test (never in the development
// database), so a successful sign-in also proves the server under test uses the test database.
export const E2E_USERS = [
  { email: "e2e.admin@sprikle.test", name: "Morgan Admin (e2e)", role: "ADMIN", isActive: true },
  { email: "e2e.tech@sprikle.test", name: "Casey Tech (e2e)", role: "TEAM_MEMBER", isActive: true },
  {
    email: "e2e.inactive@sprikle.test",
    name: "Robin Inactive (e2e)",
    role: "TEAM_MEMBER",
    isActive: false,
  },
  // Used only by the work-order journeys (the smoke suite deactivates or signs out the others).
  { email: "e2e.lead@sprikle.test", name: "Sam Lead (e2e)", role: "ADMIN", isActive: true },
  {
    email: "e2e.field@sprikle.test",
    name: "Alex Field (e2e)",
    role: "TEAM_MEMBER",
    isActive: true,
  },
  {
    email: "e2e.field2@sprikle.test",
    name: "Drew Field (e2e)",
    role: "TEAM_MEMBER",
    isActive: true,
  },
] as const;

export const E2E_ADMIN = E2E_USERS[0];
export const E2E_TECH = E2E_USERS[1];
export const E2E_INACTIVE = E2E_USERS[2];
export const E2E_LEAD = E2E_USERS[3];
export const E2E_FIELD = E2E_USERS[4];
export const E2E_FIELD_TWO = E2E_USERS[5];

/** Service areas created with the E2E users (test database only). */
export const E2E_SERVICE_AREAS = ["Harbor", "North District"] as const;

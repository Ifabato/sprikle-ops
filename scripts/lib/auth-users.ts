// Provisioning of credential (email/password) users for Better Auth, shared by the demo seed
// script and the integration tests. Uses Better Auth's public password hashing
// (`better-auth/crypto`) and the account mapping its email sign-in expects
// (providerId "credential", accountId = user id). Never logs passwords or hashes.
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "../../src/generated/prisma/client.ts";

export const CREDENTIAL_PROVIDER_ID = "credential";
export const MIN_DEMO_PASSWORD_LENGTH = 12;

export interface CredentialUserSpec {
  readonly email: string;
  readonly name: string;
  readonly role: "ADMIN" | "TEAM_MEMBER";
  readonly isActive: boolean;
}

/** Synthetic demo accounts (reserved .test domain). */
export const DEMO_USERS: readonly CredentialUserSpec[] = [
  { email: "admin@sprikle.test", name: "Avery Admin (demo)", role: "ADMIN", isActive: true },
  {
    email: "tech.one@sprikle.test",
    name: "Taylor Tech (demo)",
    role: "TEAM_MEMBER",
    isActive: true,
  },
  {
    email: "tech.two@sprikle.test",
    name: "Jordan Tech (demo)",
    role: "TEAM_MEMBER",
    isActive: true,
  },
  {
    email: "inactive@sprikle.test",
    name: "Riley Inactive (demo)",
    role: "TEAM_MEMBER",
    isActive: false,
  },
];

export type ProvisionOutcome = "created" | "unchanged";

/**
 * Creates the user and its credential account if no user has this email. An existing user is
 * left completely unchanged (password, role, active status, and name are never overwritten).
 */
export async function provisionCredentialUser(
  db: PrismaClient,
  spec: CredentialUserSpec,
  password: string,
): Promise<ProvisionOutcome> {
  const email = spec.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return "unchanged";
  }
  if (password.length < MIN_DEMO_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_DEMO_PASSWORD_LENGTH} characters.`);
  }

  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: spec.name,
        role: spec.role,
        isActive: spec.isActive,
        emailVerified: false,
      },
      select: { id: true },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: CREDENTIAL_PROVIDER_ID,
        password: passwordHash,
      },
    });
  });
  return "created";
}

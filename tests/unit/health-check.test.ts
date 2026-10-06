import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkDatabase, DATABASE_HEALTH_TIMEOUT_MS } from "@/server/health";

const SENTINEL = "postgresql://leaky:s3cr3t@db.internal:5432/sprikle_ops";

type FakeClient = Parameters<typeof checkDatabase>[0];

function fakeClient(transaction: () => Promise<unknown>): FakeClient {
  return {
    $transaction: vi.fn(transaction),
    $executeRaw: vi.fn(() => Promise.resolve(0)),
    $queryRaw: vi.fn(() => Promise.resolve([{ "?column?": 1 }])),
  } as unknown as FakeClient;
}

describe("checkDatabase", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns ok when the query succeeds", async () => {
    await expect(checkDatabase(fakeClient(() => Promise.resolve([0, []])))).resolves.toBe("ok");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returns unavailable on error and logs only a name and safe code", async () => {
    const error = Object.assign(new Error(`connect failed for ${SENTINEL}`), {
      code: "ECONNREFUSED",
    });

    await expect(checkDatabase(fakeClient(() => Promise.reject(error)))).resolves.toBe(
      "unavailable",
    );

    expect(consoleError).toHaveBeenCalledOnce();
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("ECONNREFUSED");
    expect(logged).not.toContain("s3cr3t");
    expect(logged).not.toContain("db.internal");
  });

  it("drops codes that do not look like machine codes", async () => {
    const error = Object.assign(new Error("x"), { code: SENTINEL });

    await checkDatabase(fakeClient(() => Promise.reject(error)));

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("s3cr3t");
  });

  it("returns unavailable when the query exceeds the timeout", async () => {
    vi.useFakeTimers();
    const pending = checkDatabase(fakeClient(() => new Promise(() => {})));

    await vi.advanceTimersByTimeAsync(DATABASE_HEALTH_TIMEOUT_MS);

    await expect(pending).resolves.toBe("unavailable");
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("HEALTH_TIMEOUT");
    expect(logged).toContain("TimeoutError");
  });

  it("does not leak an unhandled rejection when the query fails after the timeout", async () => {
    vi.useFakeTimers();
    const lateFailure = () =>
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error(SENTINEL)), 5_000));
    const pending = checkDatabase(fakeClient(lateFailure));

    await vi.advanceTimersByTimeAsync(DATABASE_HEALTH_TIMEOUT_MS);
    await expect(pending).resolves.toBe("unavailable");
    // Vitest fails the run if this late rejection is unhandled.
    await vi.advanceTimersByTimeAsync(5_000);

    expect(consoleError).toHaveBeenCalledOnce();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("s3cr3t");
  });
});

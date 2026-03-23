import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    role: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ctx: TrpcContext = {
    user,
    req: {} as any,
    res: {} as any,
  };
  return { ctx };
}

describe("projects.archive router", () => {
  it("archive procedure accepts valid input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Non-existent project: DB UPDATE affects 0 rows but doesn't throw
    const result = await caller.projects.archive({ id: 999999, rejectionReason: "preis" });
    expect(result).toEqual({ success: true });
  });

  it("reactivate procedure accepts valid input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Non-existent project: DB UPDATE affects 0 rows but doesn't throw
    const result = await caller.projects.reactivate({ id: 999999 });
    expect(result).toEqual({ success: true });
  });

  it("listArchived procedure returns array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.projects.listArchived({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("statistics.projectStats returns correct shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.statistics.projectStats({ year: 2025 });
    expect(result).toHaveProperty("byMonth");
    expect(result).toHaveProperty("rejectionReasons");
    expect(result).toHaveProperty("kpis");
    expect(result.kpis).toHaveProperty("hitRate");
    expect(result.kpis).toHaveProperty("totalOffers");
    expect(result.kpis).toHaveProperty("totalOrders");
    expect(Array.isArray(result.byMonth)).toBe(true);
    expect(result.byMonth).toHaveLength(12);
  });
});

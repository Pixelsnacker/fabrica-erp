import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock authenticated context
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-admin",
      email: "admin@fabrica3d.eu",
      name: "Test Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createGuestContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createGuestContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("admin@fabrica3d.eu");
    expect(result?.role).toBe("admin");
  });
});

describe("router structure", () => {
  it("all required routers are registered", () => {
    const caller = appRouter.createCaller(createAdminContext());
    // tRPC router sub-namespaces are functions in v11
    expect(caller.projects).toBeDefined();
    expect(caller.customers).toBeDefined();
    expect(caller.suppliers).toBeDefined();
    expect(caller.knowledge).toBeDefined();
    expect(caller.materials).toBeDefined();
    expect(caller.leadSources).toBeDefined();
    expect(caller.projectItems).toBeDefined();
    expect(caller.shipments).toBeDefined();
    expect(caller.consultation).toBeDefined();
    expect(caller.imageLibrary).toBeDefined();
    expect(caller.ai).toBeDefined();
  });

  it("list procedures exist on all main routers", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(typeof caller.projects.list).toBe("function");
    expect(typeof caller.customers.list).toBe("function");
    expect(typeof caller.suppliers.list).toBe("function");
    expect(typeof caller.knowledge.list).toBe("function");
    expect(typeof caller.materials.list).toBe("function");
    expect(typeof caller.leadSources.list).toBe("function");
  });

  it("mutation procedures exist", () => {
    const caller = appRouter.createCaller(createAdminContext());
    expect(typeof caller.projects.create).toBe("function");
    expect(typeof caller.customers.create).toBe("function");
    expect(typeof caller.suppliers.create).toBe("function");
    expect(typeof caller.knowledge.create).toBe("function");
    expect(typeof caller.materials.create).toBe("function");
    expect(typeof caller.ai.generate).toBe("function");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test",
        email: "test@test.com",
        name: "Test",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => { clearedCookies.push(name); },
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});

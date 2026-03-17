/**
 * Tests für den customerFiles Router
 * Testet: list, testConnection (gemockt)
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock für Google Drive (kein echtes API-Call in Tests)
vi.mock("./googleDrive", () => ({
  uploadFileToDrive: vi.fn().mockResolvedValue({
    fileId: "mock-file-id-123",
    fileUrl: "https://drive.google.com/file/d/mock-file-id-123/view",
    webViewLink: "https://drive.google.com/file/d/mock-file-id-123/view",
  }),
  deleteFileFromDrive: vi.fn().mockResolvedValue(undefined),
  testDriveConnection: vi.fn().mockResolvedValue({ ok: true, email: "test@example.com" }),
  getOrCreateCustomerFolder: vi.fn().mockResolvedValue("mock-folder-id"),
}));

// Mock für DB-Zugriff
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 1,
              customerId: 42,
              projectId: null,
              category: "cad_data",
              filename: "test.stp",
              driveFileId: "abc123",
              driveFileUrl: "https://drive.google.com/file/d/abc123/view",
              fileSize: 1024,
              mimeType: "model/step",
              notes: "Test-Notiz",
              uploadedBy: "Daniel",
              createdAt: 1700000000000,
            },
          ]),
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
}));

function createAuthContext(): TrpcContext {
  const user = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus" as const,
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("customerFiles.testConnection", () => {
  it("gibt ok:true zurück wenn Drive erreichbar ist", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.customerFiles.testConnection();

    expect(result).toMatchObject({ ok: true });
    expect(result.email).toBe("test@example.com");
  });
});

describe("customerFiles.list", () => {
  it("gibt Dateien für einen Kunden zurück", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.customerFiles.list({ customerId: 42 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      customerId: 42,
      category: "cad_data",
      filename: "test.stp",
    });
  });
});

describe("customerFiles.upload", () => {
  it("lädt eine Datei hoch und gibt fileId zurück", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.customerFiles.upload({
      customerId: 42,
      customerName: "Testfirma GmbH",
      category: "cad_data",
      filename: "bauteil.stp",
      mimeType: "model/step",
      fileBase64: Buffer.from("test content").toString("base64"),
      fileSize: 12,
      notes: "Revision 1",
    });

    expect(result.success).toBe(true);
    expect(result.fileId).toBe("mock-file-id-123");
    expect(result.fileUrl).toContain("drive.google.com");
  });
});

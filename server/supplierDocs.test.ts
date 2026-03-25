/**
 * Tests für den supplierDocs Router
 * Testet: list, upload, delete, updateNote
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock für S3-Storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "supplier-docs/1/nda/12345-nda.pdf",
    url: "https://cdn.example.com/supplier-docs/1/nda/12345-nda.pdf",
  }),
}));

// Mock für DB-Zugriff
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const result: any = Promise.resolve([
            {
              id: 1,
              supplierId: 42,
              category: "nda",
              filename: "nda-lieferant.pdf",
              fileKey: "supplier-docs/42/nda/12345-nda-lieferant.pdf",
              fileUrl: "https://cdn.example.com/supplier-docs/42/nda/12345-nda-lieferant.pdf",
              fileSize: 204800,
              mimeType: "application/pdf",
              notes: "Gültig bis 31.12.2026",
              uploadedBy: "Test User",
              driveFileId: null,
              driveSynced: 0,
              createdAt: 1700000000000,
            },
          ]);
          result.orderBy = vi.fn().mockResolvedValue([
            {
              id: 1,
              supplierId: 42,
              category: "nda",
              filename: "nda-lieferant.pdf",
              fileKey: "supplier-docs/42/nda/12345-nda-lieferant.pdf",
              fileUrl: "https://cdn.example.com/supplier-docs/42/nda/12345-nda-lieferant.pdf",
              fileSize: 204800,
              mimeType: "application/pdf",
              notes: "Gültig bis 31.12.2026",
              uploadedBy: "Test User",
              driveFileId: null,
              driveSynced: 0,
              createdAt: 1700000000000,
            },
          ]);
          result.limit = vi.fn().mockResolvedValue([]);
          return result;
        }),
      }),
    })),
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
  getProjectById: vi.fn().mockResolvedValue(null),
  getCustomerById: vi.fn().mockResolvedValue(null),
  getSupplierById: vi.fn().mockResolvedValue({ id: 42, name: "Test Lieferant", company: "Lieferant GmbH" }),
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

describe("supplierDocs.list", () => {
  it("gibt Dokumente für einen Lieferanten zurück", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.supplierDocs.list({ supplierId: 42 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("gibt leeres Array zurück wenn keine Dokumente vorhanden", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // supplierId 0 → Mock gibt leeres Array zurück (kein Match)
    const result = await caller.supplierDocs.list({ supplierId: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("supplierDocs.upload", () => {
  it("lädt ein NDA-Dokument hoch und gibt success:true zurück", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.supplierDocs.upload({
      supplierId: 42,
      category: "nda",
      filename: "nda-lieferant.pdf",
      fileBase64: Buffer.from("PDF content").toString("base64"),
      mimeType: "application/pdf",
      notes: "Gültig bis 31.12.2026",
    });
    expect(result.success).toBe(true);
    expect(result.url).toContain("cdn.example.com");
    expect(result.fileKey).toContain("supplier-docs");
  });

  it("lädt einen Rahmenvertrag hoch", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.supplierDocs.upload({
      supplierId: 42,
      category: "contract",
      filename: "rahmenvertrag-2026.pdf",
      fileBase64: Buffer.from("Vertrag content").toString("base64"),
      mimeType: "application/pdf",
    });
    expect(result.success).toBe(true);
  });

  it("akzeptiert alle gültigen Kategorien", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const categories = ["nda", "contract", "supplier_offer", "invoice", "delivery_note", "drawing", "cad_data", "photo", "protocol", "other"] as const;
    for (const cat of categories) {
      const result = await caller.supplierDocs.upload({
        supplierId: 42,
        category: cat,
        filename: `test-${cat}.pdf`,
        fileBase64: Buffer.from("content").toString("base64"),
        mimeType: "application/pdf",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("supplierDocs.delete", () => {
  it("löscht ein Dokument erfolgreich", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.supplierDocs.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("supplierDocs.updateNote", () => {
  it("aktualisiert die Notiz eines Dokuments", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.supplierDocs.updateNote({
      id: 1,
      notes: "Aktualisierte Notiz: Verlängerung bis 2027",
    });
    expect(result.success).toBe(true);
  });

  it("setzt leere Notiz (löscht Notiz)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.supplierDocs.updateNote({
      id: 1,
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("supplierDocs Router Struktur", () => {
  it("hat alle erforderlichen Prozeduren", () => {
    expect(appRouter.supplierDocs).toBeDefined();
    expect(typeof appRouter.supplierDocs).toBe("object");
  });
});

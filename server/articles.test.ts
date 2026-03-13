import { describe, it, expect } from "vitest";

// ── Artikeldatenbank Unit-Tests ───────────────────────────────────────────────

describe("Artikeldatenbank – Preisberechnung", () => {
  function calcGross(netPrice: number, taxRate: number): number {
    return netPrice * (1 + taxRate / 100);
  }

  it("berechnet Bruttopreis mit 19 % MwSt korrekt", () => {
    expect(calcGross(100, 19)).toBeCloseTo(119, 2);
  });

  it("berechnet Bruttopreis mit 7 % MwSt korrekt", () => {
    expect(calcGross(100, 7)).toBeCloseTo(107, 2);
  });

  it("berechnet Bruttopreis mit 0 % MwSt korrekt (steuerfrei)", () => {
    expect(calcGross(100, 0)).toBeCloseTo(100, 2);
  });

  it("berechnet Bruttopreis für Dezimalpreise korrekt", () => {
    expect(calcGross(16.90, 19)).toBeCloseTo(20.111, 2);
  });
});

describe("Artikeldatenbank – Validierung", () => {
  function validateArticle(article: { name: string; unitPriceNet: string; taxRate: number }) {
    const errors: string[] = [];
    if (!article.name.trim()) errors.push("Name ist Pflichtfeld");
    const price = parseFloat(article.unitPriceNet);
    if (isNaN(price) || price < 0) errors.push("Preis muss eine positive Zahl sein");
    if (![0, 7, 19].includes(article.taxRate)) errors.push("Ungültiger MwSt-Satz");
    return errors;
  }

  it("akzeptiert gültigen Artikel", () => {
    const errors = validateArticle({ name: "3D-Druck Service", unitPriceNet: "16.90", taxRate: 19 });
    expect(errors).toHaveLength(0);
  });

  it("lehnt leeren Namen ab", () => {
    const errors = validateArticle({ name: "", unitPriceNet: "16.90", taxRate: 19 });
    expect(errors).toContain("Name ist Pflichtfeld");
  });

  it("lehnt negativen Preis ab", () => {
    const errors = validateArticle({ name: "Test", unitPriceNet: "-5", taxRate: 19 });
    expect(errors).toContain("Preis muss eine positive Zahl sein");
  });

  it("lehnt ungültigen MwSt-Satz ab", () => {
    const errors = validateArticle({ name: "Test", unitPriceNet: "10", taxRate: 15 });
    expect(errors).toContain("Ungültiger MwSt-Satz");
  });
});

describe("Artikeldatenbank – isActive Konvertierung", () => {
  function toTinyint(value: boolean): number {
    return value ? 1 : 0;
  }
  function fromTinyint(value: number): boolean {
    return value === 1;
  }

  it("konvertiert true zu 1", () => {
    expect(toTinyint(true)).toBe(1);
  });

  it("konvertiert false zu 0", () => {
    expect(toTinyint(false)).toBe(0);
  });

  it("konvertiert 1 zu true", () => {
    expect(fromTinyint(1)).toBe(true);
  });

  it("konvertiert 0 zu false", () => {
    expect(fromTinyint(0)).toBe(false);
  });
});

describe("Artikeldatenbank – Suche", () => {
  const articles = [
    { id: 1, name: "3D-Druck ABS schwarz", articleNumber: "ART-001", description: "FDM Druck" },
    { id: 2, name: "Montage Stunde", articleNumber: "ART-002", description: "Techniker vor Ort" },
    { id: 3, name: "Versandkosten Pauschal", articleNumber: "ART-003", description: null },
  ];

  function searchArticles(query: string) {
    const q = query.toLowerCase();
    return articles.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.articleNumber.toLowerCase().includes(q) ||
      (a.description?.toLowerCase().includes(q) ?? false)
    );
  }

  it("findet Artikel nach Name", () => {
    expect(searchArticles("3D")).toHaveLength(1);
    expect(searchArticles("3D")[0].id).toBe(1);
  });

  it("findet Artikel nach Artikelnummer", () => {
    expect(searchArticles("ART-002")).toHaveLength(1);
    expect(searchArticles("ART-002")[0].id).toBe(2);
  });

  it("findet Artikel nach Beschreibung", () => {
    expect(searchArticles("FDM")).toHaveLength(1);
  });

  it("gibt leere Liste bei keinem Treffer zurück", () => {
    expect(searchArticles("xyz123")).toHaveLength(0);
  });

  it("gibt alle Artikel bei leerem Suchbegriff zurück", () => {
    expect(searchArticles("")).toHaveLength(3);
  });
});

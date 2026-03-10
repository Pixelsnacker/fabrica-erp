/**
 * Vitest-Tests für den KI-Datenblatt-Generator
 * Testet: Prompt-Aufbau, Kontext-Selektion, Konfigurationsvalidierung
 */
import { describe, it, expect } from "vitest";

// ─── Hilfsfunktionen (aus routers.ts extrahiert für Unit-Tests) ────────────────
type Audience = "customer" | "internal" | "supplier";
type Language = "de" | "en";
type Detail = "brief" | "standard" | "detailed";

const AUDIENCE_MAP: Record<Audience, string> = {
  customer: "einem Kunden (B2B, technisch versiert)",
  internal: "internen Mitarbeitern",
  supplier: "einem Lieferanten",
};

const DETAIL_MAP: Record<Detail, string> = {
  brief: "kurz und prägnant (max. 300 Wörter)",
  standard: "ausführlich mit allen wichtigen Details (400–700 Wörter)",
  detailed: "sehr detailliert mit technischen Spezifikationen (700–1200 Wörter)",
};

function buildSystemPrompt(language: Language): string {
  const langInstruction = language === "en"
    ? "Write the datasheet entirely in English."
    : "Schreibe das Datenblatt vollständig auf Deutsch.";
  return `Du bist ein technischer Redakteur für eine 3D-Druck-Firma (FDM, SLA, CNC-Fräsen). ${langInstruction} Erstelle professionelle, präzise technische Datenblätter.`;
}

function buildUserPrompt(
  topic: string,
  audience: Audience,
  detail: Detail,
  customerName?: string,
  projectName?: string,
  context?: string
): string {
  return `Erstelle ein technisches Datenblatt zum Thema "${topic}" für ${AUDIENCE_MAP[audience]}. Detailgrad: ${DETAIL_MAP[detail]}.
${customerName ? `Kundenname: ${customerName}` : ""}
${projectName ? `Projektname: ${projectName}` : ""}

Nutze folgende Wissensdatenbank-Einträge als Grundlage:

${context || "Kein spezifischer Kontext verfügbar — nutze allgemeines 3D-Druck-Fachwissen."}

Strukturiere das Datenblatt mit: Überschrift, kurze Einleitung, technische Spezifikationen (Tabelle wenn sinnvoll), Anwendungsgebiete, Hinweise/Einschränkungen, Kontaktinformationen-Platzhalter. Verwende Markdown-Formatierung.`;
}

function filterEntriesByTopic(
  entries: Array<{ id: number; title: string; content: string; category: string }>,
  topic: string
): typeof entries {
  const topicLower = topic.toLowerCase();
  const scored = entries.map(e => {
    let score = 0;
    if (e.title.toLowerCase().includes(topicLower)) score += 3;
    if (e.content.toLowerCase().includes(topicLower)) score += 1;
    const topicWords = topicLower.split(/\s+/);
    topicWords.forEach(word => {
      if (word.length > 3 && e.title.toLowerCase().includes(word)) score += 2;
      if (word.length > 3 && e.content.toLowerCase().includes(word)) score += 0.5;
    });
    return { entry: e, score };
  });
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.entry);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Datenblatt-Generator: Prompt-Aufbau", () => {
  it("System-Prompt enthält Deutsch-Anweisung bei language=de", () => {
    const prompt = buildSystemPrompt("de");
    expect(prompt).toContain("Schreibe das Datenblatt vollständig auf Deutsch");
    expect(prompt).not.toContain("Write the datasheet entirely in English");
  });

  it("System-Prompt enthält Englisch-Anweisung bei language=en", () => {
    const prompt = buildSystemPrompt("en");
    expect(prompt).toContain("Write the datasheet entirely in English");
    expect(prompt).not.toContain("Schreibe das Datenblatt vollständig auf Deutsch");
  });

  it("System-Prompt enthält immer 3D-Druck-Kontext", () => {
    const prompt = buildSystemPrompt("de");
    expect(prompt).toContain("3D-Druck-Firma");
    expect(prompt).toContain("FDM");
    expect(prompt).toContain("SLA");
  });
});

describe("Datenblatt-Generator: User-Prompt", () => {
  it("User-Prompt enthält Thema", () => {
    const prompt = buildUserPrompt("FDM-Druck PETG", "customer", "standard");
    expect(prompt).toContain("FDM-Druck PETG");
  });

  it("User-Prompt enthält Zielgruppe (Kunde)", () => {
    const prompt = buildUserPrompt("Test", "customer", "standard");
    expect(prompt).toContain("Kunden (B2B, technisch versiert)");
  });

  it("User-Prompt enthält Zielgruppe (intern)", () => {
    const prompt = buildUserPrompt("Test", "internal", "standard");
    expect(prompt).toContain("internen Mitarbeitern");
  });

  it("User-Prompt enthält Zielgruppe (Lieferant)", () => {
    const prompt = buildUserPrompt("Test", "supplier", "standard");
    expect(prompt).toContain("Lieferanten");
  });

  it("User-Prompt enthält Detailgrad (brief)", () => {
    const prompt = buildUserPrompt("Test", "customer", "brief");
    expect(prompt).toContain("max. 300 Wörter");
  });

  it("User-Prompt enthält Detailgrad (detailed)", () => {
    const prompt = buildUserPrompt("Test", "customer", "detailed");
    expect(prompt).toContain("700–1200 Wörter");
  });

  it("User-Prompt enthält Kundenname wenn angegeben", () => {
    const prompt = buildUserPrompt("Test", "customer", "standard", "Keck GmbH");
    expect(prompt).toContain("Keck GmbH");
  });

  it("User-Prompt enthält Projektname wenn angegeben", () => {
    const prompt = buildUserPrompt("Test", "customer", "standard", undefined, "KZ Testmodell");
    expect(prompt).toContain("KZ Testmodell");
  });

  it("User-Prompt enthält Fallback-Text wenn kein Kontext", () => {
    const prompt = buildUserPrompt("Test", "customer", "standard");
    expect(prompt).toContain("allgemeines 3D-Druck-Fachwissen");
  });

  it("User-Prompt enthält Wissensdatenbank-Kontext wenn vorhanden", () => {
    const context = "### PLA Material\nBiologisch abbaubar, 200°C Drucktemperatur";
    const prompt = buildUserPrompt("Test", "customer", "standard", undefined, undefined, context);
    expect(prompt).toContain("PLA Material");
    expect(prompt).toContain("200°C");
  });

  it("User-Prompt enthält Markdown-Formatierungsanweisung", () => {
    const prompt = buildUserPrompt("Test", "customer", "standard");
    expect(prompt).toContain("Markdown-Formatierung");
  });
});

describe("Datenblatt-Generator: Kontext-Selektion", () => {
  const testEntries = [
    { id: 1, title: "PLA Material", content: "Biologisch abbaubar, Schmelzpunkt 180°C, FDM-Druck", category: "material" },
    { id: 2, title: "ABS Material", content: "Hitzebeständig, Schmelzpunkt 230°C, FDM-Druck", category: "material" },
    { id: 3, title: "Harteloxal Aluminium", content: "Oberflächenbehandlung für Aluminium, Schichtdicke 20-50µm", category: "surface_treatment" },
    { id: 4, title: "FDM Verfahren", content: "Fused Deposition Modeling, Schichtaufbau, PLA ABS PETG", category: "process" },
    { id: 5, title: "SLA Verfahren", content: "Stereolithographie, Harz, hohe Auflösung", category: "process" },
  ];

  it("Filtert Einträge nach Thema-Relevanz", () => {
    const result = filterEntriesByTopic(testEntries, "PLA");
    expect(result.length).toBeGreaterThan(0);
    // PLA-Einträge sollten vorne stehen
    expect(result[0].title).toContain("PLA");
  });

  it("Gibt leere Liste zurück wenn kein Match", () => {
    const result = filterEntriesByTopic(testEntries, "Quantencomputer");
    expect(result.length).toBe(0);
  });

  it("Priorisiert Titel-Treffer über Inhalt-Treffer", () => {
    const result = filterEntriesByTopic(testEntries, "FDM");
    // FDM Verfahren hat FDM im Titel → höherer Score
    const fdmVerfahren = result.find(e => e.title === "FDM Verfahren");
    const plaEntry = result.find(e => e.title === "PLA Material");
    if (fdmVerfahren && plaEntry) {
      expect(result.indexOf(fdmVerfahren)).toBeLessThan(result.indexOf(plaEntry));
    }
  });

  it("Findet Einträge auch über Inhalt", () => {
    const result = filterEntriesByTopic(testEntries, "Stereolithographie");
    expect(result.some(e => e.id === 5)).toBe(true);
  });

  it("Findet Einträge über Teilwörter (Mindestlänge 4)", () => {
    const result = filterEntriesByTopic(testEntries, "Aluminium Oberfläche");
    expect(result.some(e => e.id === 3)).toBe(true);
  });
});

describe("Datenblatt-Generator: Konfigurationsvalidierung", () => {
  it("Alle Audience-Werte sind gültig", () => {
    const validAudiences: Audience[] = ["customer", "internal", "supplier"];
    validAudiences.forEach(a => {
      expect(AUDIENCE_MAP[a]).toBeDefined();
      expect(AUDIENCE_MAP[a].length).toBeGreaterThan(0);
    });
  });

  it("Alle Detail-Werte sind gültig", () => {
    const validDetails: Detail[] = ["brief", "standard", "detailed"];
    validDetails.forEach(d => {
      expect(DETAIL_MAP[d]).toBeDefined();
      expect(DETAIL_MAP[d].length).toBeGreaterThan(0);
    });
  });

  it("Brief-Detailgrad hat niedrigere Wortanzahl als detailed", () => {
    const briefMatch = DETAIL_MAP.brief.match(/(\d+)/);
    const detailedMatch = DETAIL_MAP.detailed.match(/(\d+)/);
    if (briefMatch && detailedMatch) {
      expect(parseInt(briefMatch[1])).toBeLessThan(parseInt(detailedMatch[1]));
    }
  });
});

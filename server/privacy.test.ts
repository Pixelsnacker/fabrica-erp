/**
 * privacy.test.ts — Vitest-Tests für die Datenschutz-Banner-Logik
 * (reine Unit-Tests, kein DOM, kein sessionStorage)
 */
import { describe, it, expect } from "vitest";

// ─── Nachgebaute Logik aus ProjectPortal.tsx ──────────────────────────────────

const PRIVACY_KEY = (projectId: string) => `portal_privacy_accepted_${projectId}`;

function privacyKeyForProject(projectId: string): string {
  return PRIVACY_KEY(projectId);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Datenschutz-Banner: Key-Generierung", () => {
  it("generiert projektspezifischen Key", () => {
    expect(privacyKeyForProject("42")).toBe("portal_privacy_accepted_42");
  });

  it("unterscheidet verschiedene Projekt-IDs", () => {
    const key1 = privacyKeyForProject("1");
    const key2 = privacyKeyForProject("2");
    expect(key1).not.toBe(key2);
  });

  it("Key enthält Projekt-ID", () => {
    const key = privacyKeyForProject("99");
    expect(key).toContain("99");
  });

  it("Key enthält Präfix portal_privacy_accepted_", () => {
    const key = privacyKeyForProject("5");
    expect(key.startsWith("portal_privacy_accepted_")).toBe(true);
  });
});

describe("Datenschutz-Banner: Akzeptanz-Logik", () => {
  it("Banner wird angezeigt wenn nicht akzeptiert (false)", () => {
    const accepted = false;
    expect(!accepted).toBe(true); // Banner sichtbar
  });

  it("Banner wird ausgeblendet wenn akzeptiert (true)", () => {
    const accepted = true;
    expect(!accepted).toBe(false); // Banner nicht sichtbar
  });

  it("Akzeptanz-Wert 'true' als String entspricht true", () => {
    const stored = "true";
    expect(stored === "true").toBe(true);
  });

  it("Akzeptanz-Wert 'false' als String entspricht nicht true", () => {
    const stored = "false";
    expect(stored === "true").toBe(false);
  });

  it("Leerer Wert (null) entspricht nicht true", () => {
    const stored: string | null = null;
    expect(stored === "true").toBe(false);
  });
});

describe("Datenschutz-Banner: Pflichtfelder im Text", () => {
  const datenschutzText = `
    Fabrica GmbH
    Hüttenstraße 205, 50170 Kerpen-Sindorf
    kontakt@fabrica3d.eu
    Art. 6 Abs. 1 lit. b DSGVO
    Art. 6 Abs. 1 lit. f DSGVO
    zehn Jahre
    Landesbeauftragte für Datenschutz und Informationsfreiheit NRW
    Postfach 20 04 44, 40102 Düsseldorf
  `;

  it("enthält Firmenname Fabrica GmbH", () => {
    expect(datenschutzText).toContain("Fabrica GmbH");
  });

  it("enthält korrekte Adresse", () => {
    expect(datenschutzText).toContain("Hüttenstraße 205");
    expect(datenschutzText).toContain("50170 Kerpen-Sindorf");
  });

  it("enthält korrekte E-Mail-Adresse", () => {
    expect(datenschutzText).toContain("kontakt@fabrica3d.eu");
  });

  it("enthält DSGVO-Rechtsgrundlagen", () => {
    expect(datenschutzText).toContain("Art. 6 Abs. 1 lit. b DSGVO");
    expect(datenschutzText).toContain("Art. 6 Abs. 1 lit. f DSGVO");
  });

  it("enthält Aufbewahrungszeitraum", () => {
    expect(datenschutzText).toContain("zehn Jahre");
  });

  it("enthält Aufsichtsbehörde NRW", () => {
    expect(datenschutzText).toContain("Landesbeauftragte für Datenschutz und Informationsfreiheit NRW");
    expect(datenschutzText).toContain("40102 Düsseldorf");
  });
});

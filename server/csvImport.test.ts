/**
 * Vitest-Tests für den sevDesk CSV-Import
 * Testet: CSV-Parser, Auto-Mapping, Duplikat-Erkennung, Datenkonvertierung
 */
import { describe, it, expect } from "vitest";

// ─── CSV-Parser (aus Customers.tsx extrahiert für Unit-Tests) ─────────────────
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const firstLine = lines[0];
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

// ─── Auto-Mapping (aus Customers.tsx extrahiert) ──────────────────────────────
const SEVDESK_FIELD_MAP: Record<string, string> = {
  "name": "name", "vorname": "name", "nachname": "name", "ansprechpartner": "name",
  "firma": "company", "firmenname": "company", "company": "company",
  "email": "email", "e-mail": "email", "e_mail": "email",
  "telefon": "phone", "tel": "phone", "phone": "phone",
  "straße": "street", "strasse": "street", "street": "street",
  "plz": "zip", "postleitzahl": "zip", "zip": "zip",
  "ort": "city", "stadt": "city", "city": "city",
  "land": "country", "country": "country",
  "notiz": "notes", "notizen": "notes", "notes": "notes",
  "id": "sevdeskId", "kundennummer": "sevdeskId",
};

function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach(h => {
    const key = h.toLowerCase().trim();
    mapping[h] = SEVDESK_FIELD_MAP[key] ?? "_ignore";
  });
  return mapping;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CSV-Parser", () => {
  it("parst semikolon-getrennte CSV (sevDesk Standard)", () => {
    const csv = "Name;Firma;Email\nMax Mustermann;Musterfirma GmbH;max@firma.de";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["Name", "Firma", "Email"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(["Max Mustermann", "Musterfirma GmbH", "max@firma.de"]);
  });

  it("parst komma-getrennte CSV", () => {
    const csv = "Name,Firma,Email\nMax Mustermann,Musterfirma GmbH,max@firma.de";
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["Name", "Firma", "Email"]);
    expect(rows[0][0]).toBe("Max Mustermann");
  });

  it("erkennt Semikolon als Trennzeichen wenn mehr Semikolons vorhanden", () => {
    const csv = "Name;Firma;Email;Telefon\nMax;GmbH;max@test.de;0711123";
    const { headers } = parseCsv(csv);
    expect(headers).toHaveLength(4);
  });

  it("verarbeitet gequotete Felder korrekt", () => {
    const csv = 'Name;Adresse\n"Mustermann, Max";"Hauptstraße 1, Stuttgart"';
    const { rows } = parseCsv(csv);
    expect(rows[0][0]).toBe("Mustermann, Max");
    expect(rows[0][1]).toBe("Hauptstraße 1, Stuttgart");
  });

  it("verarbeitet doppelte Anführungszeichen als Escape", () => {
    const csv = 'Name;Notiz\nMax;"Er sagte ""Hallo"""';
    const { rows } = parseCsv(csv);
    expect(rows[0][1]).toBe('Er sagte "Hallo"');
  });

  it("ignoriert leere Zeilen", () => {
    const csv = "Name;Email\nMax;max@test.de\n\n\nAnna;anna@test.de";
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("gibt leeres Ergebnis für leere Datei zurück", () => {
    const { headers, rows } = parseCsv("");
    expect(headers).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });

  it("verarbeitet Windows-Zeilenenden (CRLF)", () => {
    const csv = "Name;Email\r\nMax;max@test.de\r\nAnna;anna@test.de";
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });

  it("trimmt Leerzeichen in Feldern", () => {
    const csv = "Name;Email\n  Max Mustermann  ;  max@firma.de  ";
    const { rows } = parseCsv(csv);
    expect(rows[0][0]).toBe("Max Mustermann");
    expect(rows[0][1]).toBe("max@firma.de");
  });
});

describe("Auto-Mapping sevDesk → ERP-Felder", () => {
  it("erkennt deutsche Standardspalten", () => {
    const headers = ["Name", "Firma", "Email", "Telefon", "Straße", "PLZ", "Ort", "Land"];
    const mapping = autoMap(headers);
    expect(mapping["Name"]).toBe("name");
    expect(mapping["Firma"]).toBe("company");
    expect(mapping["Email"]).toBe("email");
    expect(mapping["Telefon"]).toBe("phone");
    expect(mapping["Straße"]).toBe("street");
    expect(mapping["PLZ"]).toBe("zip");
    expect(mapping["Ort"]).toBe("city");
    expect(mapping["Land"]).toBe("country");
  });

  it("erkennt englische Spaltenbezeichnungen", () => {
    const headers = ["Company", "Phone", "Street", "City", "Country", "Notes"];
    const mapping = autoMap(headers);
    expect(mapping["Company"]).toBe("company");
    expect(mapping["Phone"]).toBe("phone");
    expect(mapping["Street"]).toBe("street");
    expect(mapping["City"]).toBe("city");
    expect(mapping["Country"]).toBe("country");
    expect(mapping["Notes"]).toBe("notes");
  });

  it("erkennt E-Mail mit Bindestrich (sevDesk Format)", () => {
    const headers = ["E-Mail"];
    const mapping = autoMap(headers);
    expect(mapping["E-Mail"]).toBe("email");
  });

  it("setzt unbekannte Spalten auf _ignore", () => {
    const headers = ["Unbekannte Spalte", "Interne ID", "Sonstiges"];
    const mapping = autoMap(headers);
    expect(mapping["Unbekannte Spalte"]).toBe("_ignore");
    expect(mapping["Interne ID"]).toBe("_ignore");
  });

  it("erkennt Kundennummer als sevdeskId", () => {
    const headers = ["Kundennummer"];
    const mapping = autoMap(headers);
    expect(mapping["Kundennummer"]).toBe("sevdeskId");
  });

  it("Mapping ist case-insensitive", () => {
    const headers = ["NAME", "FIRMA", "EMAIL"];
    const mapping = autoMap(headers);
    expect(mapping["NAME"]).toBe("name");
    expect(mapping["FIRMA"]).toBe("company");
    expect(mapping["EMAIL"]).toBe("email");
  });
});

describe("Datenkonvertierung CSV → ERP-Objekte", () => {
  function convertRows(headers: string[], rows: string[][], mapping: Record<string, string>) {
    return rows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (field && field !== "_ignore" && row[i]) {
          if (field === "name" && obj.name) {
            obj.name = obj.name + " " + row[i];
          } else {
            obj[field] = row[i];
          }
        }
      });
      return obj;
    }).filter(o => o.name || o.company);
  }

  it("konvertiert eine typische sevDesk-Zeile korrekt", () => {
    const headers = ["Name", "Firma", "Email", "Telefon", "PLZ", "Ort"];
    const rows = [["Max Mustermann", "Musterfirma GmbH", "max@firma.de", "0711 123456", "70173", "Stuttgart"]];
    const mapping = autoMap(headers);
    const result = convertRows(headers, rows, mapping);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Max Mustermann");
    expect(result[0].company).toBe("Musterfirma GmbH");
    expect(result[0].email).toBe("max@firma.de");
    expect(result[0].zip).toBe("70173");
    expect(result[0].city).toBe("Stuttgart");
  });

  it("filtert Zeilen ohne Name und Firma heraus", () => {
    const headers = ["Email", "Telefon"];
    const rows = [["max@firma.de", "0711 123456"]];
    const mapping = autoMap(headers);
    const result = convertRows(headers, rows, mapping);
    expect(result).toHaveLength(0);
  });

  it("kombiniert Vorname und Nachname wenn beide gemappt sind", () => {
    const headers = ["Vorname", "Nachname"];
    const rows = [["Max", "Mustermann"]];
    const mapping = { "Vorname": "name", "Nachname": "name" };
    const result = convertRows(headers, rows, mapping);
    expect(result[0].name).toBe("Max Mustermann");
  });

  it("ignoriert Spalten die auf _ignore gemappt sind", () => {
    const headers = ["Name", "Interne Notiz", "Email"];
    const rows = [["Max", "Geheim", "max@test.de"]];
    const mapping = { "Name": "name", "Interne Notiz": "_ignore", "Email": "email" };
    const result = convertRows(headers, rows, mapping);
    expect(result[0]).not.toHaveProperty("_ignore");
    expect(result[0].name).toBe("Max");
    expect(result[0].email).toBe("max@test.de");
  });

  it("verarbeitet mehrere Zeilen korrekt", () => {
    const csv = "Name;Firma;Email\nMax Mustermann;Firma A;max@a.de\nAnna Schmidt;Firma B;anna@b.de\nPeter Müller;Firma C;peter@c.de";
    const { headers, rows } = parseCsv(csv);
    const mapping = autoMap(headers);
    const result = convertRows(headers, rows, mapping);
    expect(result).toHaveLength(3);
    expect(result[1].name).toBe("Anna Schmidt");
    expect(result[2].email).toBe("peter@c.de");
  });
});

describe("Duplikat-Erkennung Logik", () => {
  interface Customer { id: number; name: string; email?: string | null; company?: string | null }

  function findDuplicate(row: { name: string; email?: string }, existing: Customer[]): Customer | undefined {
    if (row.email) {
      return existing.find(c => c.email === row.email);
    }
    return existing.find(c => c.name === row.name);
  }

  const existingCustomers: Customer[] = [
    { id: 1, name: "Max Mustermann", email: "max@firma.de", company: "Firma A" },
    { id: 2, name: "Anna Schmidt", email: null, company: "Firma B" },
    { id: 3, name: "Peter Müller", email: "peter@c.de", company: "Firma C" },
  ];

  it("erkennt Duplikat über E-Mail", () => {
    const dup = findDuplicate({ name: "Maximilian Mustermann", email: "max@firma.de" }, existingCustomers);
    expect(dup?.id).toBe(1);
  });

  it("erkennt Duplikat über Namen wenn keine E-Mail vorhanden", () => {
    const dup = findDuplicate({ name: "Anna Schmidt" }, existingCustomers);
    expect(dup?.id).toBe(2);
  });

  it("gibt undefined zurück wenn kein Duplikat gefunden", () => {
    const dup = findDuplicate({ name: "Neuer Kunde", email: "neu@test.de" }, existingCustomers);
    expect(dup).toBeUndefined();
  });

  it("E-Mail hat Vorrang vor Name bei der Duplikat-Erkennung", () => {
    // Gleiche E-Mail aber anderer Name → trotzdem Duplikat
    const dup = findDuplicate({ name: "Völlig anderer Name", email: "peter@c.de" }, existingCustomers);
    expect(dup?.id).toBe(3);
  });

  it("kein Duplikat wenn E-Mail anders aber Name gleich", () => {
    // Wenn E-Mail angegeben, wird nur nach E-Mail gesucht
    const dup = findDuplicate({ name: "Max Mustermann", email: "anderer@email.de" }, existingCustomers);
    expect(dup).toBeUndefined();
  });
});

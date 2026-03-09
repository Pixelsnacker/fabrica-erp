# Technische Spezifikation: Angebots- und Rechnungsmodul
## Fabrica ERP — GoBD-konform nach §14 UStG

**Version:** 1.0 | **Stand:** März 2026 | **Autor:** Fabrica GmbH / Manus AI

---

## 1. Rechtliche Grundlagen

### 1.1 Pflichtangaben nach §14 Abs. 4 UStG

Jede Rechnung muss folgende Angaben enthalten:

| Pflichtfeld | Beschreibung |
|---|---|
| Vollständiger Name und Anschrift des Leistenden | Fabrica GmbH inkl. Straße, PLZ, Ort |
| Vollständiger Name und Anschrift des Leistungsempfängers | Kundenstammdaten |
| Steuernummer oder USt-IdNr. | Pflichtfeld Firmenstammdaten |
| Ausstellungsdatum | `issue_date` |
| Fortlaufende Rechnungsnummer | `invoice_number` (RE-YYYY-NNNN) |
| Menge und Art der Leistung | `invoice_items.description`, `quantity`, `unit` |
| Zeitpunkt der Lieferung/Leistung | `delivery_date` |
| Nettobetrag, Steuersatz, Steuerbetrag | Berechnet und gespeichert |
| Bruttobetrag | `total_gross` |

### 1.2 Kleinunternehmerregelung (§19 UStG)

Wenn `tax_mode = 'kleinunternehmer'`: Kein Steuerausweis, stattdessen Pflichthinweis:
> „Gemäß §19 UStG wird keine Umsatzsteuer berechnet."

### 1.3 GoBD-Anforderungen (BMF-Schreiben 2019)

Die Grundsätze ordnungsmäßiger Buchführung und Datenzugriff (GoBD) verlangen:

- **Unveränderbarkeit:** Finalisierte Rechnungen dürfen nicht mehr geändert werden (`is_locked = true`)
- **Vollständigkeit:** Jede Rechnung muss vollständig erfasst und archiviert werden
- **Nachvollziehbarkeit:** Jede Änderung muss protokolliert werden (`invoice_audit_log`)
- **Aufbewahrungspflicht:** 10 Jahre Aufbewahrung (§147 AO), S3-Archivierung mit Löschsperre
- **Maschinelle Auswertbarkeit:** Export in DATEV-kompatiblem Format
- **Integrität:** SHA-256-Hash über den Rechnungsinhalt zum Nachweis der Unverändertheit

---

## 2. Datenbankschema

### 2.1 Tabelle: `invoices`

```sql
CREATE TABLE invoices (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number  VARCHAR(32) UNIQUE NOT NULL,       -- RE-2026-0001 / AN-2026-0001
  type            ENUM('offer','invoice','credit_note') NOT NULL DEFAULT 'offer',
  status          ENUM('draft','sent','accepted','invoiced','paid','cancelled','overdue') NOT NULL DEFAULT 'draft',
  customer_id     INT REFERENCES customers(id),
  project_id      INT REFERENCES projects(id),
  
  -- Absender (Snapshot zum Zeitpunkt der Erstellung)
  sender_name     VARCHAR(255),
  sender_street   VARCHAR(255),
  sender_zip      VARCHAR(20),
  sender_city     VARCHAR(100),
  sender_tax_id   VARCHAR(50),
  sender_vat_id   VARCHAR(50),
  
  -- Empfänger (Snapshot)
  recipient_name  VARCHAR(255),
  recipient_company VARCHAR(255),
  recipient_street VARCHAR(255),
  recipient_zip   VARCHAR(20),
  recipient_city  VARCHAR(100),
  
  -- Daten
  issue_date      DATE NOT NULL,
  due_date        DATE,
  delivery_date   DATE,
  payment_terms   VARCHAR(255),
  
  -- Steuer
  tax_mode        ENUM('standard','reduced','mixed','tax_free','kleinunternehmer') DEFAULT 'standard',
  
  -- Beträge (gespeichert als DECIMAL für Genauigkeit)
  subtotal_net    DECIMAL(12,2) DEFAULT 0.00,
  tax_amount      DECIMAL(12,2) DEFAULT 0.00,
  total_gross     DECIMAL(12,2) DEFAULT 0.00,
  currency        VARCHAR(3) DEFAULT 'EUR',
  
  -- Texte
  intro_text      TEXT,
  notes           TEXT,
  footer_text     TEXT,
  
  -- GoBD-Felder
  pdf_url         VARCHAR(1024),
  pdf_key         VARCHAR(512),
  content_hash    VARCHAR(64),                        -- SHA-256
  is_locked       TINYINT(1) DEFAULT 0,              -- 1 = finalisiert, unveränderbar
  
  -- Referenz bei Stornierung
  cancelled_by    INT REFERENCES invoices(id),        -- Gutschrift-ID
  cancels         INT REFERENCES invoices(id),        -- stornierte Rechnung
  
  created_at      BIGINT,
  updated_at      BIGINT
);
```

### 2.2 Tabelle: `invoice_items`

```sql
CREATE TABLE invoice_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position        INT NOT NULL,                       -- Reihenfolge
  description     TEXT NOT NULL,
  quantity        DECIMAL(10,3) DEFAULT 1.000,
  unit            VARCHAR(20) DEFAULT 'Stk.',
  unit_price_net  DECIMAL(12,2) NOT NULL,
  tax_rate        DECIMAL(5,2) DEFAULT 19.00,         -- 0, 7, 19
  line_total_net  DECIMAL(12,2),                      -- qty * unit_price_net
  line_tax        DECIMAL(12,2),                      -- line_total_net * tax_rate/100
  line_total_gross DECIMAL(12,2)                      -- line_total_net + line_tax
);
```

### 2.3 Tabelle: `invoice_audit_log` (GoBD-Änderungsprotokoll)

```sql
CREATE TABLE invoice_audit_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id      INT NOT NULL REFERENCES invoices(id),
  action          ENUM('created','updated','status_changed','locked','cancelled','pdf_generated') NOT NULL,
  changed_by      VARCHAR(255),                       -- Benutzer-E-Mail
  changed_at      BIGINT NOT NULL,
  field_changed   VARCHAR(100),
  old_value       TEXT,
  new_value       TEXT,
  snapshot_json   LONGTEXT                            -- vollständiger Snapshot des Dokuments
);
```

### 2.4 Tabelle: `invoice_sequences` (fortlaufende Nummernvergabe)

```sql
CREATE TABLE invoice_sequences (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  year            INT NOT NULL,
  type            ENUM('invoice','offer','credit_note') NOT NULL,
  last_number     INT NOT NULL DEFAULT 0,
  UNIQUE KEY (year, type)
);
```

---

## 3. Geschäftslogik

### 3.1 Rechnungsnummern-Vergabe

Die Nummernvergabe erfolgt **atomar** (Transaktion + SELECT FOR UPDATE) um Lücken und Dopplungen zu vermeiden:

```
Rechnung:    RE-2026-0001, RE-2026-0002, ...
Angebot:     AN-2026-0001, AN-2026-0002, ...
Gutschrift:  GS-2026-0001, GS-2026-0002, ...
```

Lücken in der Nummernfolge sind nach GoBD zu dokumentieren (z.B. durch stornierte Nummern).

### 3.2 Status-Workflow

```
[draft] → [sent] → [accepted] → [invoiced] → [paid]
                                            ↘ [cancelled] → Gutschrift (credit_note)
                              ↘ [overdue]
```

- **draft:** Bearbeitbar, kein PDF, kein Hash
- **sent:** Angebot versendet, noch bearbeitbar (mit Audit-Log)
- **accepted:** Angebot angenommen, Umwandlung in Rechnung möglich
- **invoiced:** Rechnung gestellt, `is_locked = true`, PDF generiert, Hash gespeichert
- **paid:** Zahlung eingegangen, Datum gespeichert
- **cancelled:** Storniert, Gutschrift erstellt, Original bleibt unverändert (GoBD)
- **overdue:** Zahlungsziel überschritten (automatisch gesetzt)

### 3.3 Steuerberechnung

| Modus | Steuersatz | Hinweis |
|---|---|---|
| `standard` | 19 % | Regelsteuersatz |
| `reduced` | 7 % | Ermäßigter Satz (z.B. Bücher, Lebensmittel) |
| `mixed` | Gemischt | Verschiedene Sätze pro Position |
| `tax_free` | 0 % | Steuerfreie Leistung nach §4 UStG |
| `kleinunternehmer` | Kein Ausweis | §19 UStG, Pflichthinweis im PDF |

### 3.4 Manipulationsschutz (GoBD)

Beim Finalisieren (`lock`) wird ein SHA-256-Hash über den normalisierten JSON-Inhalt der Rechnung (alle Felder + Positionen) berechnet und in `content_hash` gespeichert. Bei jedem Abruf kann die Integrität geprüft werden.

```
content_hash = SHA-256(JSON.stringify({
  invoice_number, type, customer_snapshot, items, totals, issue_date, ...
}))
```

### 3.5 GoBD-Archivierung

- PDF wird bei Finalisierung in S3 gespeichert (`invoice-archive/YYYY/RE-YYYY-NNNN.pdf`)
- S3-Objekte erhalten ein **Aufbewahrungsdatum** (10 Jahre ab Ausstellungsdatum)
- Audit-Log-Einträge sind **nicht löschbar** (kein DELETE auf `invoice_audit_log`)
- Stornierte Rechnungen bleiben vollständig erhalten, nur Status ändert sich

---

## 4. PDF-Aufbau (§14 UStG konform)

Das PDF folgt dem DIN-A4-Format mit 1 cm Rand (Benutzerpräferenz):

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]                          Fabrica GmbH           │
│                                  Hüttenstraße 205       │
│                                  50170 Kerpen-Sindorf   │
│                                  Tel: +49 2273 9529429  │
│                                  d.rincon@fabrica3d.eu  │
│                                  USt-IdNr: DE...        │
├─────────────────────────────────────────────────────────┤
│  Empfänger:                                             │
│  [Kundenname / Firma]                                   │
│  [Straße]                                               │
│  [PLZ Ort]                                              │
├─────────────────────────────────────────────────────────┤
│  RECHNUNG Nr. RE-2026-0001        Datum: 09.03.2026     │
│  Lieferdatum: 09.03.2026          Fälligkeit: 23.03.2026│
├─────────────────────────────────────────────────────────┤
│  Pos. │ Beschreibung      │ Menge │ EP netto │ Gesamt   │
│   1   │ CNC-Fräsen AL7057 │  1 Stk│ 3.900,00 │ 3.900,00 │
├─────────────────────────────────────────────────────────┤
│                              Nettobetrag:  3.900,00 €   │
│                              MwSt 19 %:     741,00 €   │
│                              Gesamtbetrag: 4.641,00 €   │
├─────────────────────────────────────────────────────────┤
│  Zahlbar innerhalb von 14 Tagen ohne Abzug.             │
│  IBAN: DE...  BIC: ...                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. DATEV-Export

Der Export folgt dem **DATEV ASCII-Format** (Buchungsstapel):

| Feld | Inhalt |
|---|---|
| Umsatz | `total_gross` |
| Soll/Haben | H (Haben = Erlös) |
| WKZ | EUR |
| Kurs | 1 |
| Basis-Umsatz | `subtotal_net` |
| WKZ Basis-Umsatz | EUR |
| Konto | 8400 (19%) / 8300 (7%) |
| Gegenkonto | Debitorenkonto (Kundennummer) |
| BU-Schlüssel | Steuerschlüssel |
| Belegdatum | `issue_date` |
| Belegnummer | `invoice_number` |
| Buchungstext | Kundenname + Leistungsbeschreibung |

---

## 6. Implementierungsreihenfolge

1. **Datenbank-Migration** — alle 4 Tabellen anlegen
2. **Backend-Routen** — CRUD, Nummernvergabe, Lock, Hash, PDF
3. **PDF-Generierung** — HTML-Template → PDF via `@react-pdf/renderer` oder `puppeteer`
4. **Frontend** — Angebots-/Rechnungsformular, Positionstabelle, Live-Kalkulation
5. **Export** — DATEV-CSV, allgemeiner CSV-Export
6. **Audit-Log-Anzeige** — Änderungshistorie pro Dokument

---

*Dieses Dokument dient als verbindliche Grundlage für die Implementierung. Rechtliche Prüfung durch einen Steuerberater wird empfohlen.*

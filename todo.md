# Fabrica ERP – TODO

## Phase 1: Datenbank & Schema
- [x] Schema: customers (Name, Firma, Typ, E-Mail, Telefon, SevDesk-ID)
- [x] Schema: lead_sources (Name, Typ, monatliche Kosten)
- [x] Schema: projects (Titel, Typ, Status, Kunde, Lead-Quelle, Drive-Link, Notizen)
- [x] Schema: project_items (Name, Menge, Material, Technik, Produktion, EK, VK, Marge)
- [x] Schema: suppliers (Name, Fähigkeiten, Bewertung, aktiv/inaktiv, E-Mail)
- [x] Schema: rfq (Projekt-Item, Lieferanten, Status, Frist)
- [x] Schema: rfq_responses (RFQ, Lieferant, Preis, Notiz, ausgewählt)
- [x] Schema: shipments (Projekt, Dienstleister, Trackingnummer, Versanddatum, Lieferdatum)
- [x] Schema: cad_files (Projekt, Position, Dateiname, Version, S3-URL, Notiz)
- [x] Schema: consultation_entries (Projekt, Kunde, Typ, Titel, Inhalt, Tags, Datum)
- [x] Schema: materials_library (Name, Kategorie, Eigenschaften, Einsatzgebiete, Notizen)
- [x] DB-Migration pushen (via SQL direkt)

## Phase 2: Backend-API (tRPC Router)
- [x] Router: customers (list, create, update, delete)
- [x] Router: lead_sources (list, create, update, delete)
- [x] Router: projects (list, create, update, delete, changeStatus)
- [x] Router: project_items (list, create, update, delete + EK/VK/Marge-Berechnung)
- [x] Router: suppliers (list, create, update, delete)
- [x] Router: rfq (create, addResponse, selectBest, list)
- [x] Router: shipments (create, update, list)
- [x] Router: cad_files (upload, list, addVersion)
- [x] Router: consultation (list, create, update, delete, search)
- [x] Router: materials (list, create, update, delete)
- [x] Router: dashboard (KPIs, monatliche EK/VK/Marge, Lead-ROI)

## Phase 3: Design & Layout
- [x] Design-System: Farben (dunkel, technisch), Typografie, Spacing
- [x] index.css: globale Variablen und Theme
- [x] DashboardLayout mit Sidebar-Navigation
- [x] Sidebar-Einträge: Dashboard, Projekte, Kunden, Lieferanten, Beratung, Materialien, Einstellungen

## Phase 4: Seiten – Projekte & Dashboard
- [x] Dashboard: KPI-Karten (EK, VK, Marge, offene Projekte), Monatsübersicht
- [x] Projektliste: Tabelle + Kanban-Ansicht, Filter nach Status/Typ
- [x] Projekt anlegen/bearbeiten: Formular (Typ, Status, Kunde, Lead-Quelle, Notizen)
- [x] Projekt-Detail: Tabs für Positionen, Versand, CAD-Dateien, Beratungshistorie

## Phase 5: Seiten – Kunden, Lieferanten, Versand
- [x] Kunden-Datenbank: Liste, anlegen, bearbeiten
- [x] Lieferanten-Datenbank: Liste, anlegen, bearbeiten, Fähigkeiten, Bewertung
- [x] Versand & Tracking: Trackingnummer, Dienstleister, Datum pro Projekt
- [ ] RFQ: Massen-Anfrage erstellen, Angebote vergleichen, bestes auswählen → EK (Phase 2)

## Phase 6: Seiten – Controlling, Lead-ROI, CAD, Beratung
- [x] EK/VK/Marge pro Projekt sichtbar (Projekt-Detail)
- [x] Lead-Quellen-Seite: Kosten, Typen, monatliche Übersicht
- [x] Beratungshistorie: globale Liste aller Einträge, Suche
- [x] Materialien-Bibliothek: Werkstoffe, Oberflächen, Verfahren mit Eigenschaften
- [ ] CAD-Datei-Upload (S3-Integration, Phase 2)
- [ ] Monatliche EK/VK/Marge-Diagramme auf Dashboard (Phase 2)

## Phase 6b: KI-Assistent & Wissensdatenbank
- [x] Schema: knowledge_entries, image_library, ai_sessions (via SQL angelegt)
- [x] Router: knowledge (list, create, update, delete, search)
- [x] Router: image_library (upload S3, list, delete)
- [x] Router: ai_assistant (generate consultation text from knowledge, save session)
- [x] KI-Assistent Seite: Chat-Interface mit Prompt-Eingabe und Schnellauswahl
- [x] Generierter Text mit "Kopieren" und "Mit Signatur" Button
- [x] Session-Protokoll: frühere KI-Beratungen in Sidebar
- [x] Wissensdatenbank-Verwaltung: Einträge anlegen, bearbeiten, taggen
- [x] Bilddatenbank-Verwaltung: Bilder hinzufügen, beschreiben, taggen, kategorisieren

## Phase 7: Tests & Finalisierung
- [x] Vitest: auth.logout test
- [x] Vitest: router structure tests (alle Router vorhanden + Procedures)
- [x] TypeScript: 0 Fehler
- [x] Checkpoint erstellen

## Bugs
- [x] "Fehler beim Anlegen" Toast erscheint beim Anlegen (Projekt oder Kunde) — Behoben: Fehlende DB-Tabellen direkt per SQL angelegt (16 Tabellen jetzt vorhanden)
- [x] "Fehler beim Anlegen" bei Lieferanten — Behoben: fehlende `address`-Spalte in suppliers per ALTER TABLE ergänzt
- [x] "Fehler beim Anlegen" bei Kunden — Behoben: alle Spalten korrekt, Insert funktioniert

## Phase 8: Schnellnotiz-Funktion & Datensicherung
- [x] DB-Tabelle: quick_notes (id, text, project_id optional, source, created_at)
- [x] tRPC Router: quickNotes.create, quickNotes.list, quickNotes.delete
- [x] Globaler Schnellnotiz-Button (gelber Blitz) im Header — immer sichtbar
- [x] Modal: Textfeld + optionale Projektzuordnung + Quelle (WhatsApp, Telefon, Persönlich, E-Mail, Sonstiges)
- [x] Strg+Enter Tastenkürzel zum schnellen Speichern
- [x] tRPC Router: export.full (vollständiger JSON-Export aller Tabellen)
- [x] Einstellungen-Seite mit Schnellnotiz-Liste, Löschfunktion und Daten-Export-Button
- [x] Einstellungen-Menüpunkt in Sidebar-Navigation
- [ ] Schnellnotizen-Widget auf dem Dashboard (Phase 3)
- [ ] Schnellnotizen im Projekt-Detail sichtbar (Phase 3)

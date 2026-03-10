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

## Phase 9: Notizen & Erinnerungen + Mobile PWA
- [x] DB: notes Tabelle (id, title, content, project_id optional, status, priority, created_at)
- [x] DB: note_attachments Tabelle (id, note_id, filename, file_url, file_key, file_type, size)
- [x] DB: note_reminders Tabelle (id, note_id, remind_at, is_sent, label)
- [x] tRPC Router: notes (list, getById, create, update, delete, uploadAttachment, deleteAttachment, addReminder, deleteReminder, pendingReminders, markReminderSent)
- [x] S3-Upload für Bilder und PDFs pro Notiz (base64 → storagePut)
- [x] Notizen-Seite: Liste, anlegen, bearbeiten, Anhänge anzeigen, Suche, Filter
- [x] Erinnerungen: Datum+Uhrzeit, mehrere pro Notiz, Status (offen/erledigt)
- [x] Browser Push-Benachrichtigungen für Erinnerungen (Notification API)
- [x] PWA-Manifest (manifest.json, theme-color, apple-mobile-web-app-capable)
- [x] Mobile Layout-Optimierung: Header, KPI-Cards, Projektliste, Buttons responsive
- [x] Notizen-Menüpunkt in Sidebar-Navigation (Bell-Icon)
- [x] Inter-Font eingebunden, font-smoothing aktiviert
- [x] Vitest: 13 neue Tests für Notes-Logik (alle grün)

## Phase 10: Bugfix + Notizen im Projekt-Detail
- [x] Bug: Schnellnotiz-Modal crashed beim Öffnen (leerer SelectItem value "") — behoben mit "none"-Sentinel
- [x] Projekt-Detail: Notizen-Tab mit allen projektbezogenen Notizen
- [x] Projekt-Detail: Neue Notiz direkt aus dem Projekt anlegen (Projekt vorausgefüllt)
- [x] Projekt-Detail: Erinnerungen pro Notiz sichtbar mit Status (offen/überfällig/erledigt)
- [x] Projekt-Detail: Schnellnotizen (quick_notes) ebenfalls im Tab anzeigen

## Phase 11: Datei-Upload im Notizen-Tab des Projekts
- [x] Datei-Upload-Button direkt in NoteCard (Büroklammer-Icon)
- [x] Drag & Drop oder Klick zum Hochladen von Bildern (jpg/png/webp) und PDFs
- [x] Fortschrittsanzeige während des Uploads (base64 → S3)
- [x] Anhänge-Vorschau: Bilder als Thumbnail-Grid, PDFs als Link mit Icon
- [x] Anhang löschen direkt aus dem Notizen-Tab (Hover-X-Button)
- [x] Max. 10 MB Dateigrößen-Validierung mit Fehlermeldung

## Phase 12: Bugfix Schnellnotiz speichern
- [x] Bug: "Fehler beim Speichern" beim Klick auf Speichern im QuickNote-Modal
- [x] Root Cause: drizzle-introspect hatte schema.ts überschrieben → tinyint nicht importiert, Insert-Typen fehlten
- [x] Fix: tinyint/boolean zu schema.ts Import hinzugefügt, alle Insert-Typen wiederhergestellt
- [x] Fix: boolean-Vergleiche auf 0/1 umgestellt (tinyint-kompatibel)
- [x] Fix: Date-Typen auf toISOString() konvertiert (string-kompatibel)
- [x] Fix: Suppliers.tsx und KnowledgeBase.tsx unknown-Typ-Fehler behoben
- [x] 20 Tests grün, 0 TypeScript-Fehler

## Phase 13: Kunden & Lieferanten – Bearbeiten, Adresse, mehrere E-Mails/Namen, Tel-Link
- [x] DB: customers – Spalten email2, email3, contact2, contact3, street, zip, city, country hinzugefügt
- [x] DB: suppliers – Spalten email2, email3, contact2, contact3, street, zip, city, country hinzugefügt
- [x] tRPC: customers.create + update Prozedur mit allen neuen Feldern
- [x] tRPC: suppliers.create + update Prozedur mit allen neuen Feldern
- [x] Kunden-Seite: Edit-Button (Hover) + Bearbeiten-Dialog mit allen Feldern
- [x] Kunden-Seite: Adressblock (Straße, PLZ, Ort, Land)
- [x] Kunden-Seite: bis zu 3 E-Mail-Adressen und 3 Ansprechpartner
- [x] Kunden-Seite: Telefonnummer als klickbarer tel:-Link (grün beim Hover)
- [x] Lieferanten-Seite: Edit-Button (Hover) + Bearbeiten-Dialog mit allen Feldern
- [x] Lieferanten-Seite: Adressblock (Straße, PLZ, Ort, Land)
- [x] Lieferanten-Seite: bis zu 3 E-Mail-Adressen und 3 Ansprechpartner
- [x] Lieferanten-Seite: Telefonnummer als klickbarer tel:-Link (grün beim Hover)
- [x] 20 Tests grün, 0 TypeScript-Fehler

## Phase 14: Kalkulation bearbeitbar + Lieferanten-Angebot-Upload + Reklamationen
- [x] DB: project_items – Spalten supplier_offer_url, supplier_offer_key, supplier_offer_name hinzugefügt
- [x] DB: Neue Tabelle complaints (id, project_id, title, description, status, priority, resolved_at, resolution, created_at)
- [x] DB: complaint_attachments (id, complaint_id, file_url, file_key, filename, file_type)
- [x] tRPC: project_items.update – alle Felder editierbar inkl. supplierOffer-Felder
- [x] tRPC: supplierOffer.upload + supplierOffer.remove
- [x] tRPC: complaints.list, create, update, delete, addAttachment, deleteAttachment
- [x] Frontend: Positionen inline editierbar – InlineEdit + InlineSelect Komponenten
- [x] Frontend: Angebot-Upload-Button pro Position (Büroklammer-Icon grün wenn vorhanden), Vorschau/Download-Link
- [x] Frontend: Reklamations-Tab im Projekt-Detail mit Status-Badges und Priorität
- [x] Frontend: Reklamations-Dialog mit Status, Priorität, Beschreibung, Lösung, Foto-Upload
- [x] 20 Tests grün, 0 TypeScript-Fehler

## Phase 15: Globale Reklamations-Übersicht
- [x] tRPC: complaints.listAll – alle Reklamationen aller Projekte mit Projekt-Name (JOIN mit projects)
- [x] Reklamationen-Seite: Liste aller Reklamationen, sortiert nach Priorität (kritisch zuerst)
- [x] Filter: nach Status (Offen/In Bearbeitung/Gelöst/Geschlossen) und Priorität
- [x] Suche nach Titel, Projekt-Name und Beschreibung
- [x] Klick auf Projekt-Name → direkt zum Projekt-Detail
- [x] Status direkt in der Liste änderbar (Dropdown)
- [x] Erweiterte Details (Beschreibung, Lösung) per Klick aufklappbar
- [x] Sidebar-Menüpunkt "Reklamationen" mit AlertTriangle-Icon
- [x] 20 Tests grün, 0 TypeScript-Fehler

## Phase 16: GoBD-konformes Angebots- und Rechnungsmodul (§14 UStG)
- [x] Technische Spezifikation (docs/invoice-module-spec.md)
- [x] DB: invoices, invoice_items, invoice_audit_log, invoice_number_seq Tabellen
- [x] tRPC: invoices.list, create, update, delete, changeStatus, lock, cancel, exportCsv, exportDatev
- [x] Fortlaufende Rechnungsnummern (RE-YYYY-NNNN, ANG-YYYY-NNNN, GUT-YYYY-NNNN)
- [x] Steuerberechnung: 19%, 7%, 0% (Kleinunternehmer)
- [x] GoBD-Sperrung (isLocked) nach Finalisierung
- [x] SHA-256 Hash für Manipulationsschutz
- [x] Audit-Log für alle Änderungen (GoBD-Versionierung)
- [x] CSV- und DATEV-Export
- [x] Frontend: Angebote & Rechnungen Seite mit Tabs, Suche, Filter
- [x] Frontend: Formular mit Positionen, Steuerberechnung, Sender-/Empfängerdaten
- [x] Frontend: PDF-Download (Browser-Print)
- [x] Frontend: Statusverwaltung, Sperren, Stornieren
- [x] Sidebar-Menüpunkt 'Angebote & Rechnungen' (Receipt-Icon)
- [x] 28 neue Vitest-Tests (Nummernvergabe, Steuer, Hash, DATEV, Status)
- [x] 48 Tests gesamt grün, 0 TypeScript-Fehler

## Phase 17: Firmendaten in Einstellungen + Angebot aus Projekt
- [x] DB: company_settings Tabelle (name, legalForm, street, zip, city, country, phone, email, website, taxNumber, vatId, iban, bic, bankName, logoUrl, logoKey, invoiceFooter, kleinunternehmer)
- [x] tRPC: companySettings.get, companySettings.update, companySettings.uploadLogo
- [x] Einstellungen-Seite: Firmendaten-Tab mit Formular (alle Felder), Logo-Upload
- [x] Rechnungsformular: Firmendaten automatisch als Absender vorausgefüllt
- [x] Rechnungsformular: Kleinunternehmer-Modus automatisch aus Einstellungen
- [x] Rechnungsformular: Rechnungsfußtext aus Einstellungen vorausgefüllt
- [x] Projekt-Detail: Button 'Angebot erstellen' im Header (Receipt-Icon)
- [x] Angebot aus Projekt: Positionen aus project_items übernehmen (Bezeichnung, Menge, VK)
- [x] Angebot aus Projekt: Kundendaten als Empfänger vorausgefüllt
- [x] 48 Tests grün, 0 TypeScript-Fehler

## Phase 18: KI-Datenblatt-Generator
- [x] tRPC: knowledge.generateDatasheet – LLM-Aufruf mit Wissensdatenbank-Kontext
- [x] tRPC: knowledge.list – alle Einträge für Kontext-Auswahl
- [x] Frontend: Datenblatt-Generator-Dialog in der Wissensdatenbank
- [x] Frontend: Konfiguration (Thema, Zielgruppe, Sprache, Detailtiefe, Kundenname)
- [x] Frontend: Vorschau des generierten Datenblatts (Markdown-Rendering)
- [x] Frontend: PDF-Export des Datenblatts (Browser-Print)
- [x] Frontend: Datenblatt-Button im Angebots-Formular (Datenblatt direkt aus Angebot generieren)
- [x] Frontend: Datenblatt-Tab im Projekt-Detail (Schnellzugriff auf Generator)
- [x] Vitest: 22 neue Tests für Datenblatt-Generator (Prompt-Aufbau, Kontext-Selektion, Konfiguration)
- [x] 70 Tests gesamt grün, 0 TypeScript-Fehler

## Phase 19: Konfigurierbarer Nummernkreis
- [x] Schema: companySettings um Präfix- und Format-Felder erweitern
- [x] DB-Migration: ALTER TABLE direkt ausgeführt
- [x] Backend: Nummernvergabe-Logik liest Präfix aus companySettings
- [x] Backend: tRPC companySettings.update mit neuen Feldern + numberPreview-Prozedur
- [x] Frontend: Nummernkreis-Karte in den Firmeneinstellungen
- [x] Frontend: Präfix, Trennzeichen, Nullstellen, Jahreszahl konfigurierbar
- [x] Frontend: Live-Vorschau der generierten Nummer (client-seitig)
- [x] Vitest: 19 neue Tests für konfigurierbare Nummernvergabe (89 Tests gesamt)

## Phase 20: Responsive Layout Fixes
- [x] Invoices-Formular: Typ/Kunde/Projekt-Zeile — grid-cols-[160px_1fr_1fr] mit min-w-0
- [x] Invoices-Formular: Absender/Empfänger-Raster auf sm:grid-cols-2 gesetzt
- [x] Invoices-Formular: Datum/Steuer-Zeile auf sm:grid-cols-2 lg:grid-cols-4
- [x] Invoices-Formular: Dialog-Breite auf w-[95vw] max-w-4xl gesetzt

## Phase 21: Strukturierter ZIP-Export (Notion-Stil)
- [x] Backend: /api/export/zip Endpunkt (Express-Route, nicht tRPC)
- [x] Backend: Ordnerstruktur: Kunden/, Projekte/, Angebote-Rechnungen/, Wissensdatenbank/, Materialien/, Lieferanten/, Notizen/
- [x] Backend: Jeder Datensatz als eigene .md Datei (Markdown)
- [x] Backend: CSV-Übersicht pro Ordner (_übersicht.csv)
- [x] Backend: README.md im ZIP-Root mit Exportdatum und Statistiken
- [x] Backend: ZIP-Komprimierung mit archiver (Level 6)
- [x] Frontend: Export-Dialog mit Format-Optionen (Markdown+CSV, nur CSV, nur JSON)
- [x] Frontend: Bereichs-Auswahl mit Alle/Keine-Buttons
- [x] Frontend: Download-Button mit Progress-Anzeige
- [x] Vitest: 18 neue Tests für slugify, CSV, Formatierung (107 Tests gesamt)

## Phase 22: Bugfixes Invoices
- [x] Bug: Fehlende DB-Spalten (offer_prefix, invoice_prefix etc.) in company_settings nachträglich migriert
- [x] Bug: onError-Handler zu createMut/updateMut hinzugefügt — Fehler jetzt sichtbar als Toast
- [x] Layout: Dialog auf max-w-6xl w-[98vw] vergrößert
- [x] Layout: Absender und Empfänger jetzt nebeneinander (lg:grid-cols-2)
- [x] Layout: Interne Felder in 2-Spalten-Grid angeordnet

## Phase 23: Vollbild-Formular Invoices
- [x] Dialog als Sheet (von rechts, volle Höhe, Breite = 100vw minus Sidebar)
- [x] Formular zweispaltig: Absender | Empfänger nebeneinander

## Phase 24: DB-Fehler Invoices Create
- [x] Bug: taxMode-Spaltenname-Konflikt — Schema auf tax_mode korrigiert, DB-Spalte umbenannt
- [x] Layout: Formular als Sheet (von rechts, volle Höhe, Breite = 100vw minus Sidebar)

## Phase 25: Notizen bearbeiten und löschen
- [x] Backend: notes.update Prozedur bereits vorhanden
- [x] Backend: notes.delete Prozedur bereits vorhanden
- [x] Frontend: Bearbeiten-Button (Stift-Icon) öffnet Dialog mit vorausgefüllten Feldern
- [x] Frontend: Löschen-Button mit AlertDialog-Bestätigung bereits vorhanden
- [x] Verifiziert im Browser: beide Funktionen funktionieren korrekt

## Phase 26: Kalender mit Google Calendar Sync
- [x] DB: calendar_events Tabelle erstellt (id, title, description, start_at, end_at, category, color, google_event_id, customer_id, project_id)
- [x] Backend: calendar.list, create, update, delete, syncFromGoogle Prozeduren
- [x] Backend: Google Calendar Sync via MCP (lesen + schreiben)
- [x] Frontend: Kalender-Seite mit Monats- und Wochenansicht
- [x] Frontend: Termin-Dialog (Titel, Datum/Zeit, Kategorie, Farbe, Kunde/Projekt)
- [x] Frontend: Farbkodierung nach Kategorie
- [x] Frontend: Kalender-Eintrag in Sidebar (CalendarDays-Icon)

## Phase 27: KI-Assistent mit ERP-Kontext
- [x] Backend: ai.generate um includeErpContext erweitert (Kunden, Projekte, Rechnungen, Termine, KPIs)
- [x] Frontend: ERP-Kontext-Toggle im KI-Assistenten
- [x] Frontend: Schnellbefehle-Tabs (Technisch / ERP-Abfragen)
- [x] Frontend: Kategorie-Tabs mit 6 ERP-Schnellbefehlen
- [x] 107 Tests grün, 0 TypeScript-Fehler

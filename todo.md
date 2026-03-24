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

## Phase 28: Bugfix Notizen im Projekt-Detail
- [x] Bug: Bearbeiten-Button (Edit2-Icon) zu NoteCard hinzugefügt — öffnet NoteEditInlineDialog
- [x] Bug: Schnellnotizen im Projekt-Detail haben jetzt Löschen-Button (Trash2-Icon)
- [x] NoteEditInlineDialog-Komponente mit Titel/Inhalt/Priorität-Bearbeitung erstellt
- [x] 107 Tests grün, 0 TypeScript-Fehler

## Phase 29: Klickbare Trackingnummern
- [x] Tracking-URLs für DHL, UPS, FedEx, DPD, Hermes (+ Google-Fallback) implementiert
- [x] Klick auf Trackingnummer öffnet Tracking-Seite im neuen Tab
- [x] Carrier-Erkennung automatisch aus dem Carrier-Feld (case-insensitive)
- [x] ExternalLink-Icon erscheint beim Hover
- [x] 107 Tests grün, 0 TypeScript-Fehler
## Phase 30: Angebot → Rechnung Konvertierung
- [x] Backend: invoices.convertToInvoice Prozedur (Angebot-ID → neue Rechnung mit allen Daten)
- [x] Frontend: "In Rechnung umwandeln" Button in der Angebotsliste
- [x] Frontend: Bestätigungs-Dialog vor der Konvertierung
- [x] Frontend: Nach Konvertierung zur neuen Rechnung navigieren (Tab-Wechsel zu Rechnungen)
- [x] Tests: Vitest für convertToInvoice Logik (10 neue Tests, 117 gesamt)

## Phase 31: sevDesk CSV-Import für Kunden
- [x] Backend: importCustomers tRPC-Procedure (CSV-Zeilen, Duplikat-Erkennung per E-Mail/Firma)
- [x] Frontend: Import-Button in Kunden-Header
- [x] Frontend: CSV-Upload-Dialog mit Datei-Vorschau (erste 5 Zeilen)
- [x] Frontend: Spalten-Mapping (sevDesk-Spalten → ERP-Felder)
- [x] Frontend: Import-Ergebnis (X neu, Y aktualisiert, Z übersprungen)
- [x] Tests: Vitest für CSV-Parse und Duplikat-Logik (25 neue Tests, 142 gesamt)

## Phase 32: Projekt-Dokumente Upload (Lieferantenangebote, NDA, Bestellungen)
- [x] DB: Neue Tabelle project_documents (projectId, category, filename, fileKey, fileUrl, fileSize, mimeType, notes, uploadedBy, createdAt)
- [x] Backend: projectDocs.list, upload, delete Procedures
- [x] Frontend: Neuer "Dokumente"-Tab in ProjectDetail
- [x] Frontend: Upload-Dialog mit Kategorie-Auswahl (Lieferantenangebot, NDA, Bestellung, Sonstiges)
- [x] Frontend: Dokumentenliste mit Download-Link, Vorschau und Löschen
- [x] Tests: Vitest für Dokument-Kategorien und Upload-Logik (19 neue Tests, 161 gesamt)

## Phase 33: Dokumente mit Lieferanten verknüpfen
- [x] DB: supplierId-Spalte zu project_documents hinzufügen
- [x] Backend: upload-Procedure um supplierId erweitern, suppliers.list für Dropdown
- [x] Frontend: Lieferanten-Dropdown im Upload-Dialog (optional, nur bei Lieferantenangebot vorausgewählt)
- [x] Frontend: Lieferantenname in der Dokumentenkarte anzeigen
- [x] Frontend: Filter nach Lieferant in der Dokumentenliste
- [x] Tests: Vitest für Lieferanten-Verknüpfungs-Logik (8 neue Tests, 169 gesamt)

## Phase 34: Dokument-Notiz nachträglich bearbeiten
- [x] Backend: projectDocs.updateNote Procedure (id + notes)
- [x] Frontend: Bearbeiten-Button (Stift-Icon) in ProjectDocCard
- [x] Frontend: Inline-Edit mit Textarea und Speichern/Abbrechen
- [x] Tests: Vitest für updateNote-Logik (5 neue Tests, 174 gesamt)

## Phase 39: Kalender Erinnerung + Layout-Fix
- [x] DB: reminder1, reminder2, reminder3 Felder (Minuten vor dem Termin) zu calendar_events
- [x] Backend: checkReminders Procedure + notifyOwner bei fälligen Erinnerungen
- [x] Frontend: Layout-Fix Kunde/Projekt (untereinander statt nebeneinander)
- [x] Frontend: Erinnerungs-Stufen im Formular (1 Woche / 1 Tag / 1 Stunde / 30 Min)
- [x] Tests: Vitest 186 gesamt, alle grün

## Phase 40: Gesamt-Backup alle Projekte
- [ ] Backend: /api/export/backup-all Route (alle Projekte + Kunden/Lieferanten als CSV)
- [ ] Frontend: Gesamt-Backup-Button im Dashboard (Header)
- [ ] Tests: Vitest für Gesamt-Backup-Logik

## Phase 37: Gesamt-Backup aller Projekte
- [x] Backend-Route GET /api/export/backup-all (exportZip.ts erweitert)
- [x] ZIP enthält: Kunden.csv, Lieferanten.csv, Projekte-Uebersicht.csv
- [x] ZIP enthält: Projekte/<slug>/Projekt-Info.txt, Notizen/, Dokumente/, CAD-Daten/
- [x] Button "Gesamt-Backup" in Projektliste-Header (ArchiveRestore-Icon)
- [x] Ladeindikator während ZIP-Erstellung, Toast bei Erfolg/Fehler
- [x] 186 Tests grün, 0 TypeScript-Fehler

## Phase 38: Kalender-Bugfixes
- [x] Bug: Google Calendar Sync schlägt fehl — Fix: MCP-Ergebnis aus JSON-Datei lesen statt stdout
- [x] Bug: Woche/Monat-Umschaltung — Fix: Wochenansicht vollständig implementiert (getWeekDays, weekAnchor, Wochenspalten-Grid)

## Phase 39: Google Calendar Sync Fix (v2)
- [ ] Bug: Google Sync schlägt weiterhin fehl — tiefere Diagnose und robuste Lösung

## Phase 40: Materialbibliothek – Bearbeiten & Löschen
- [x] Backend: updateMaterial-Procedure (PUT) — bereits vorhanden
- [x] Backend: deleteMaterial-Procedure (DELETE) — bereits vorhanden
- [x] Frontend: Bearbeiten-Button (Stift-Icon) + Edit-Dialog auf jeder Material-Karte
- [x] Frontend: Löschen-Button mit Bestätigungs-Dialog

## Phase 41: Kurznotizen – Bearbeiten & Erinnerung
- [ ] DB-Schema: remindAt-Feld (bigint, nullable) zu notes-Tabelle hinzufügen
- [ ] Backend: updateNote-Procedure implementieren
- [ ] Backend: getDueReminders-Procedure (Notizen mit fälliger Erinnerung)
- [ ] Frontend: Bearbeiten-Button + vorausgefüllter Edit-Dialog
- [ ] Frontend: Erinnerungs-Datum/Uhrzeit-Picker im Notiz-Dialog
- [ ] Frontend: Erinnerungs-Banner/Toast bei fälligen Notizen (Polling alle 60s)

## Phase 41: Kurznotizen – Bearbeiten + Erinnerung
- [x] DB-Schema: remindAt, remindLabel, remindSent, updatedAt Felder in quick_notes
- [x] Backend: updateQuickNote, getDueQuickNoteReminders, markQuickNoteReminderSent in db.ts
- [x] Backend: update, dueReminders, markReminderSent Procedures in routers.ts
- [x] Frontend Settings.tsx: Bearbeiten-Button (Stift-Icon) + EditQuickNoteDialog mit Datum/Uhrzeit-Picker
- [x] Frontend DashboardLayout.tsx: Erinnerungs-Polling alle 60s, Toast mit OK-Button

## Phase 42: CAD-Upload + 3D-Viewer (STL/STP)
- [x] Three.js + STLLoader installieren
- [x] CAD-Viewer-Komponente: STL interaktiv (Orbit, Zoom, Pan, Reset), STP/STEP als Download
- [x] Backend: CAD-Upload-Procedure (S3) für STL, STP, STEP, OBJ, 3MF, IGES
- [x] Projekt-Detail: CAD-Tab mit Drag&Drop-Upload und 3D-Viewer-Dialog
- [x] Dateiliste: Name, Größe, Datum, Download-Link, Löschen, Typ-Badge

## Phase 43: Dokumenttyp CAD Daten
- [x] Dokumenttyp "CAD Daten" vor "Sonstiges" in der Dropdown-Liste ergänzt (icon: 📐, Farbe: emerald)

## Phase 44: Dokument-Typ nachträglich ändern
- [x] Backend: updateCategory-Procedure in projectDocs-Router
- [x] Frontend: Typ-Ändern-Dropdown direkt auf der Dokument-Karte (Inline, Klick auf Typ-Label)

## Phase 45: PDF-Vorschau in Dokument-Karte
- [x] PDF-Vorschau-Button auf Dokument-Karte (blauer FileText-Button beim Hover)
- [x] Dialog mit eingebettetem PDF-Viewer (iframe, 85vh) + Vollbild-Button + Download-Button
- [x] Bild-Vorschau für PNG/JPG/JPEG/GIF/WEBP/SVG/BMP ebenfalls im Dialog

## Phase 46: CAD-Vorschau in Dokument-Karte
- [x] getFilePreviewType: 'stl' und 'cad_other' (STP/STEP/OBJ/3MF/IGES) Typen hinzugefügt
- [x] STL-Vorschau: CadViewer-Komponente im Dialog eingebunden (interaktiver 3D-Viewer, 85vh)
- [x] STP/STEP/OBJ/3MF/IGES-Vorschau: Info-Dialog mit Dateiinfo + programm-spezifischem Hinweis + Download

## Phase 47: Fußzeile 4-spaltig + Startnummern
- [ ] DB-Schema: footerCol1..4 Felder (Adresse/Kontakt/Rechtliches/Bank) + invoiceStartNumber + quoteStartNumber
- [ ] Migration: ALTER TABLE company_settings
- [ ] Einstellungen-UI: 4-spaltiges Fußzeilen-Formular mit Vorschau + Startnummern-Felder
- [ ] PDF-Generator: 4-spaltige Fußzeile rendern
- [ ] Nummerierungslogik: Startnummer als Basis für nächste Rechnungs-/Angebotsnummer

## Phase 47: Fußzeile 4-spaltig + Startnummern
- [x] DB-Schema: footerCol1-4 Felder in company_settings
- [x] DB: ALTER TABLE für neue Spalten
- [x] Backend: footerCol1-4 und Startnummern in companySettings.update Procedure
- [x] Backend: getNextInvoiceNumber berücksichtigt Startnummer aus company_settings
- [x] Frontend Settings.tsx: Startnummern-Karte mit Echtzeit-Vorschau der nächsten Nummer
- [x] Frontend Settings.tsx: 4-spaltiges Fußzeilen-Formular mit Vorschau
- [x] Frontend Invoices.tsx: buildFooterHtml() generiert 4-spaltige Fußzeile im PDF-Druck

## Phase 48: Lieferantenangebot-Import ins Angebots-Formular
- [ ] Backend: extractSupplierOfferItems Procedure — KI liest Positionen aus Lieferanten-PDF
- [ ] Frontend: "Aus Lieferantenangebot importieren"-Button im Angebots-Formular
- [ ] Frontend: Projekt-Auswahl → Lieferantenangebote aus dem Projekt anzeigen
- [ ] Frontend: Positions-Vorschau nach KI-Extraktion mit Bearbeiten-Möglichkeit vor Übernahme
- [ ] Frontend: Projektbezug im Angebot (Referenz auf Quell-Projekt)

## Phase 48: Lieferantenangebot-Import in Angebots-Formular
- [x] Backend: extractItems-Procedure (KI liest PDF via LLM file_url, JSON-Schema-Ausgabe)
- [x] Frontend: Import-Button (amber) im Positionen-Header des Angebots-Formulars
- [x] Frontend: Import-Dialog 4-stufig (Projekt → PDF → KI-Extraktion → Vorschau + Übernahme)
- [x] Projektbezug wird beim Import automatisch gesetzt
- [x] 186 Tests grün, 0 TypeScript-Fehler

## Phase 49: Angebots-Formular Sevdesk-Erweiterungen
- [ ] DB: invoice_items – longDescription, isOptional (tinyint), discount (decimal) Felder
- [ ] DB: company_settings – agbText Feld
- [ ] Backend: invoice_items Felder in create/update Procedures
- [ ] Backend: agbText in companySettings.update Procedure
- [ ] Frontend: Einheiten-Dropdown (Stk, Std, km, pauschal, %, m², m, kg, t, lfm, m³, L, Tag(e))
- [ ] Frontend: Langbeschreibung-Textfeld pro Position (mehrzeilig)
- [ ] Frontend: Optional-Toggle pro Position
- [ ] Frontend: Rabatt-Feld pro Position (%) mit Berechnung
- [ ] Frontend: AGB-Textfeld in Einstellungen
- [ ] Frontend: AGB als automatische 2. Seite im PDF-Druck

## Phase 50: Artikeldatenbank (Produktkatalog)
- [x] DB: articles Tabelle (id, articleNumber, name, description, unit, unitPriceNet, taxRate, category, isActive)
- [x] Backend: articles.list, create, update, delete Procedures
- [x] Frontend: Artikel-Seite mit Liste, Suche, Formular
- [x] Frontend: Artikel-Suche beim Hinzufügen von Positionen in Angeboten/Rechnungen

## Phase 51: UX-Verbesserungen Positionen + Schnellnotizen
- [x] Angebotspositionen: Kopieren-Button pro Position
- [x] Angebotspositionen: Neue Positionen oben einfügen (statt unten)
- [x] Schnellnotizen: Nachträgliches Bearbeiten (Edit-Dialog)

## Phase 52: Angebot konvertieren
- [x] Backend: invoices.convert Mutation (Angebot → Auftragsbestätigung oder Bestellung, alle Positionen übernehmen)
- [x] Frontend: "Konvertieren"-Button in Angebots-Detail und Listenansicht
- [x] Nach Konvertierung: Weiterleitung zum neuen Dokument, Angebot-Status auf "Angenommen" setzen

## Phase 53: Bug-Fixes UI
- [x] Bug: Schnellnotizen lassen sich nicht bearbeiten (Edit-Dialog öffnet sich nicht)
- [x] Bug: Stift-Button in Dokumenten-Liste nur bei Hover sichtbar, soll immer gelb sein

## Phase 54: Schnellnotiz-Dialog Bugs
- [x] Bug: Schnellnotiz-Dialog wird abgeschnitten / überlappt falsch (z-index / Portal-Problem)
- [x] Bug: EditQuickNoteDialog öffnet sich nicht beim Klick auf Stift-Button in Schnellnotizen-Liste
- [x] Verbesserung: Schnellnotiz-Dialog saubereres Design

## Phase 55: Notizen ausbauen + Schnellnotizen entfernen
- [ ] DB: notes-Tabelle um source-Feld (whatsapp, telefon, email, persoenlich, sonstiges) erweitern
- [ ] Backend: notes.create, update, delete Procedures um source-Feld erweitern
- [ ] Frontend: Notizen-Seite mit Quelle-Dropdown, Bearbeiten und Löschen
- [ ] Frontend: Schnellnotizen-Bereich aus Einstellungen entfernen
- [ ] Frontend: Gelber "Schnellnotiz"-Button im Header → öffnet Notizen-Formular direkt
- [ ] Frontend: QuickNoteModal und EditQuickNoteDialog entfernen

## Phase 55: Notizen ausbauen + Schnellnotizen entfernen (ABGESCHLOSSEN)
- [x] DB: notes-Tabelle hat bereits source-Feld (whatsapp, telefon, email, persoenlich, sonstiges)
- [x] Backend: notes.create, update Procedures haben source-Feld
- [x] Frontend: Notizen-Seite mit Quelle-Dropdown, Bearbeiten und Löschen (bereits vorhanden)
- [x] Frontend: Schnellnotizen-Bereich aus Einstellungen entfernt
- [x] Frontend: Gelber "Schnellnotiz"-Button im Header → navigiert zu /notes?new=1
- [x] Frontend: QuickNoteModal und EditQuickNoteDialog entfernt
- [x] Frontend: ProjectDetail.tsx - Schnellnotizen-Sektion entfernt
- [x] 219 Tests grün, 0 TypeScript-Fehler

## Phase 56: Erinnerungen via Manus Push-Benachrichtigung (Mobile + Web)

- [x] getDueNoteReminders und markNoteReminderSent in db.ts
- [x] Cron-Job in server/_core/index.ts (jede Minute fällige Erinnerungen prüfen)
- [x] notifyOwner mit Notiz-Titel und Inhalt aufrufen
- [x] Erinnerung nach Versand als isSent markieren

## Phase 57: Projekt direkt als Auftrag anlegen (Startstatus wählbar)

- [x] Status-Dropdown im "Neues Projekt"-Dialog hinzufügen
- [x] Backend: projects.create Startstatus-Parameter unterstützen (war bereits vorhanden)

## Phase 58: Auftragsbestätigung (PDF + E-Mail) (ABGESCHLOSSEN)

- [x] Firmen- und Kundendaten-Struktur analysiert (alles vorhanden)
- [x] E-Mail-Versand via SMTP (Nodemailer, Infomaniak-Zugangsdaten aus company_settings)
- [x] HTML-E-Mail mit Positionsübersicht (Netto, MwSt., Brutto) als strukturierte Tabelle
- [x] Button "AB" (amber) im Projektdetail-Header
- [x] Dialog: An, CC, Betreff, Nachricht editierbar, Positionstabelle automatisch angehängt
- [x] 219 Tests grün, 0 TypeScript-Fehler

## Phase 59: PDF-Anhang für Auftragsbestätigung

- [ ] PDF-Generator-Strategie festlegen (Puppeteer vs. html-pdf-node vs. pdfkit)
- [ ] HTML-Template für AB-PDF (Firmenlogo, Absender, Empfänger, Positionen, Fußzeile)
- [ ] Backend: PDF generieren und als E-Mail-Anhang hinzufügen
- [ ] Tests und Checkpoint

## Phase 59: PDF-Anhang für Auftragsbestätigung (ABGESCHLOSSEN)

- [x] WeasyPrint-Verfügbarkeit geprüft (Python, kein zusätzliches Paket nötig)
- [x] pdfGenerator.ts mit professionellem DIN-A4-Template (Logo, Empfänger, Positionen, Fußzeile)
- [x] email.ts um attachments-Parameter erweitert (Nodemailer)
- [x] sendOrderConfirmation: PDF wird generiert und als Anhang mitgesendet
- [x] PDF-Fehler ist nicht kritisch – E-Mail wird auch ohne Anhang gesendet
- [x] 219 Tests grün, 0 TypeScript-Fehler

## Phase 60: AB-PDF-Download + E-Mail als Option

- [ ] AB Print-Ansicht (wie Angebote) implementieren – direkter PDF-Download
- [ ] AB-Dialog: Download-Button primär, E-Mail als optionaler zweiter Schritt

## Phase 61: Mahnungsmodul

- [ ] DB: reminders Tabelle (id, invoice_id, level, sent_at, due_date, fee, notes)
- [ ] tRPC: reminders.list, create, send (E-Mail + PDF), markPaid
- [ ] Mahnungs-PDF-Template (DIN A4, Firmenlogo, Fußzeile, Mahngebühr)
- [ ] Frontend: Mahnungs-Tab in Rechnungen oder eigene Seite
- [ ] Mahnungs-Level: 1. Mahnung, 2. Mahnung, Letzte Mahnung

## Phase 56: AB und Bestellung als vollständige Dokumenttypen
- [x] Typ-Dropdown im Formular um "Auftragsbestätigung" und "Bestellung" erweitert
- [x] Tabs in der Listenansicht um "AB" und "Bestellungen" erweitert
- [x] Header-Buttons "AB" und "Bestellung" hinzugefügt
- [x] E-Mail-Button für AB und Bestellung in Liste und Detail-Dialog
- [x] Backend: create-Prozedur akzeptiert order_confirmation und purchase_order
- [x] Nummernkreis: AB-YYYY-NNNN und BE-YYYY-NNNN (bereits in db.ts implementiert)
- [x] PDF-Druck funktioniert für alle Typen (printInvoice)
- [x] 219 Tests grün, 0 TypeScript-Fehler

## Phase 57: Lieferanten-Auswahl bei Bestellungen
- [x] DB: supplierId-Spalte in invoices-Tabelle ergänzen
- [x] Backend: supplierId in create/update/getById unterstützen
- [x] Backend: suppliers.list für Dropdown bereitstellen (bereits vorhanden)
- [x] Frontend: Lieferanten-Dropdown im Formular (nur bei purchase_order sichtbar)
- [x] Frontend: Empfänger-Felder automatisch aus Lieferant befüllen
- [x] Frontend: Lieferant in der Listenansicht anzeigen

## Phase 58: PDF-Layout verbessern
- [x] AGB-Seite 2 überlappt nicht mehr mit Fußzeile (fixed positioning entfernt)
- [x] Fußzeile auf Seite 1 korrekt positioniert (kein Überlappen mit AGB-Titel)
- [x] Seite 2 nur anzeigen wenn AGB-Text vorhanden
- [x] Allgemeines PDF-Layout aufgeräumt (Abstände, Schriften, Tabelle, Empfänger-Label)

## Phase 59: Positionen verbessern
- [x] Beschreibungsfeld als Textarea (Zeilenumbruch per Enter möglich)
- [x] Pfeil-Buttons (hoch/runter) zum Verschieben von Positionen
- [x] PDF: Zeilenumbrüche in Beschreibung korrekt darstellen (white-space:pre-wrap)

## Phase 60: PDF-Layout Fußzeile und Umbrüche
- [x] Fußzeile fixed am unteren Rand (position:fixed, bottom:0), auf jeder Seite
- [x] Seiteninhalt hat genug Abstand zur Fußzeile (@page margin-bottom: 3.5cm)
- [x] Beschreibungs-Zeilenumbrüche im PDF korrekt dargestellt (white-space:pre-wrap)

## Phase 61: Kritische Bugs beheben
- [x] BUG: Positionen werden nach Speichern nicht gespeichert (openEdit lädt jetzt via getById)
- [x] Detailbeschreibung als Textarea (Zeilenumbruch per Enter, wächst automatisch)
- [x] PDF: Fußzeile nur auf der ersten/letzten Seite (kein position:fixed mehr)

## Phase 62: taxRate Typ-Bug
- [x] BUG: taxRate kommt als Zahl aus Artikeldatenbank, Backend erwartet String
- [x] Alle Artikel-Einfüge-Stellen: String-Konvertierung für taxRate, quantity, unitPriceNet
- [x] handleSave: sanitizedItems konvertiert alle numerischen Felder zu String vor dem Senden

## Phase 63: KI-Textverbesserung in Positionen
- [x] Backend: textImprove.improve Prozedur (invokeLLM, professionelle Umformulierung)
- [x] Frontend: KI-Button (Sparkles-Icon, lila) neben Beschreibung und Detailbeschreibung
- [x] Frontend: Vorschau-Panel mit Original vs. KI-Vorschlag, Übernehmen/Verwerfen-Button

## Phase 64: Mengenfeld-Formatierung
- [x] BUG: quantity-Feld zeigt "1.000" mit Punkt (sieht aus wie Tausend) - behoben
- [x] quantity-Input: nur Ziffern und Komma erlauben, kein Tausenderpunkt (Komma wird zu Punkt normalisiert)

## Phase 65: PDF Pflichtänderungen
- [x] HTTP-Links vollständig entfernen aus dem PDF (renderCol entfernt http:// Präfix)
- [x] Fußzeile auf JEDER Seite fixed am unteren Rand (position:fixed, bottom:0, @page margin-bottom:4.5cm)
- [x] Lieferadresse im Bestellblock: nur Straße, PLZ, Ort, Land (kein Firmenname wiederholen)
- [x] Lieferantenblock: nur Firmenname des Lieferanten (keine eigene Firmenadresse)

## Phase 66: Seitennummer in PDF-Fußzeile
- [x] Seitennummer "Seite X von Y" rechts in der Fußzeile anzeigen (CSS counter)

## Phase 67: PDF kritische Bugs
- [x] BUG: Doppelter Name im Lieferantenblock behoben (onSupplierSelect setzt recipientName='')
- [x] BUG: Fußzeile-Position korrigiert (height:3cm, align-items:flex-end, @page margin-bottom:3.5cm)
- [x] SHA-256 Zeile vollständig aus PDF entfernt
- [x] Browser-URL-Zeile: wird vom Browser selbst erzeugt - kann nur durch Druckeinstellungen des Nutzers deaktiviert werden

## Phase 68: Löschen mit Bestätigung und Undo
- [x] Bestätigungsdialog vor dem Löschen: "Löschen? Ja / Nein" direkt am Trash-Button
- [x] Undo-Toast nach dem Löschen (10 Sekunden, "Rükgängig"-Button)
- [x] Gelöschte Position wird im State zwischengespeichert für Undo

## Phase 69: Mengenfeld "1.000" Bug
- [x] quantity in DB als decimal(10,3) -> zeigt immer 3 Nachkommastellen
- [x] Frontend: quantity-Wert beim Laden trimmen (parseFloat -> trailing zeros weg)
- [x] Frontend: quantity beim Speichern und in allen Mapping-Stellen bereinigt

## Phase 70: PDF komplett neu schreiben
- [x] printInvoice komplett neu geschrieben - kein position:fixed mehr
- [x] Fußzeile als normaler Fließtext am Ende des Inhalts (stabil, kein Überlappen)
- [x] Seite 2 (AGB) nur wenn AGB-Text vorhanden
- [x] Sauberes Layout mit flexbox header, klare Struktur

## Phase 71: Datum deutsch + PDF-Download
- [x] Datum im PDF deutsch formatieren (TT.MM.JJJJ) via formatDateDE()
- [x] PDF-Download ohne Druckdialog (html2canvas + jsPDF, direkter Download als .pdf Datei)

## Phase 72: Bestellung - Zahlungsbedingungen und Drucken-Button
- [x] Zahlungsbedingungen bei Bestellungen im Formular ausblenden
- [x] Zahlungsbedingungen bei Bestellungen im PDF ausblenden (printInvoice + downloadPDF)
- [x] Drucken-Button entfernt, nur PDF-Download-Button bleibt

## Phase 73: IBAN bei Bestellungen entfernen
- [x] IBAN bei Bestellungen im PDF nicht anzeigen (beide Stellen: printInvoice + downloadPDF)

## Phase 74: PDF-Bugs - Positionen fehlen + AGB-Seite leer + IBAN in Fußzeile
- [x] Bug: downloadPDF aus der Liste nutzt inv.items=undefined (list-Query hat keine items) → Positionen fehlen
- [x] Bug: AGB-Seite 2 erscheint leer obwohl kein AGB-Text vorhanden (leere Seite)
- [x] Bug: IBAN erscheint noch in der Fußzeile (footerCol4) bei Bestellungen
- [x] Fix: downloadPDF ruft jetzt immer getById auf wenn items fehlen/leer sind
- [x] Fix: agbText.trim() verhindert Whitespace-only AGB-Seite
- [x] Fix: footerCol4 (Bankdaten) bei purchase_order leer gesetzt (beide: printInvoice + downloadPDF)
- [x] Fix: min-height:1063px aus downloadPDF-HTML entfernt → kein leerer Überlauf mehr

## Phase 75: PDF-Generierung auf server-seitiges Puppeteer umstellen
- [x] puppeteer-core installiert (Chromium unter /usr/bin/chromium-browser)
- [x] tRPC-Procedure: invoices.generatePdf (gibt PDF-Buffer als base64 zurück)
- [x] HTML-Template server-seitig in pdfHtml.ts (buildInvoiceHtml)
- [x] Puppeteer: position:fixed Fußzeile am unteren Seitenrand
- [x] Frontend: downloadPDF und printInvoice nutzen generatePdf
- [x] html2canvas + jsPDF Imports entfernt

## Phase 76: PDF ohne Puppeteer/Chromium (Produktions-Server hat kein Chromium)
- [x] WeasyPrint (Python, kein Chromium nötig) als PDF-Engine
- [x] generatePdf Procedure auf WeasyPrint umgestellt
- [x] Live-Test erfolgreich: 1 Seite, Fußzeile unten, Positionen korrekt

## Phase 77: Puppeteer mit eingebettetem Chromium (npm-Paket, kein systemweites Chromium)
- [x] puppeteer mit eingebettetem Chromium installiert (.puppeteer-cache im Projektverzeichnis)
- [x] generatePdf auf puppeteer.executablePath() umgestellt (ESM-kompatibel, kein require())
- [x] PUPPETEER_CACHE_DIR als Umgebungsvariable gesetzt
- [x] Live-Test erfolgreich: Toast 'PDF heruntergeladen' erscheint

## Phase 78: PDF mit @react-pdf/renderer (kein Chromium)
- [x] @react-pdf/renderer 4.3.2 installiert
- [x] generatePdf Procedure auf renderInvoicePdf umgestellt (kein Puppeteer/Chromium mehr)
- [x] PDF-Template: Logo, Absender/Empfänger, Positionen-Tabelle, Summen, Fußzeile
- [x] Live-Test mit echten DB-Daten: 1 Seite, Fußzeile unten, kein IBAN bei Bestellungen
- [ ] Auf Produktions-Domain testen

## Phase 79: Google Drive Integration
- [ ] googleapis npm-Paket installieren
- [ ] Google Drive OAuth2 Credentials (Client ID + Secret) einrichten
- [ ] Google Drive Service: Ordnerstruktur Fabrica ERP / Jahr / Monat
- [ ] PDF-Upload: Bei jeder PDF-Generierung automatisch auf Drive hochladen
- [ ] Datei-Upload: Projektdateien (STL, STEP, Bilder) auf Drive synchronisieren
- [ ] Datenbank-Export: Täglicher automatischer JSON-Export auf Drive
- [ ] Frontend: Google Drive Verbindungs-UI (Connect/Disconnect Button)
- [ ] Frontend: Sync-Status und manuelle Sync-Buttons
- [ ] Testen auf Produktions-Domain

## Phase 80: ZIP-Export für Buchhalter
- [x] archiver npm-Paket installiert
- [x] Backend: exportZip Procedure (Filter: Monat/Jahr, Dokumenttyp)
- [x] Backend: Alle gefilterten Rechnungen als PDFs generieren und in ZIP packen
- [x] Frontend: PDF-Export Button in der Rechnungsliste
- [x] Frontend: Dialog mit Monat/Jahr-Filter und Dokumenttyp-Auswahl
- [x] Testen und Checkpoint (cb719985)

## Phase 81: Lieferschein + Tab-Fix
- [x] Bug: Tab-Filter-Überlappung behoben (flex-wrap, h-auto)
- [x] Feature: delivery_note zum Schema-Enum hinzugefügt + DB-Migration
- [x] Feature: Lieferschein erstellen (direkt über Formular)
- [x] Feature: Lieferschein-PDF ohne Preise (nur #, Beschreibung, Menge, Einheit)
- [x] Feature: Lieferschein-Tab im Filter
- [x] Feature: LS-Präfix + Startnummer in Firmeneinstellungen
- [ ] Testen und Checkpoint

## Phase 82: PDF-Fixes
- [x] Bug: Logo im PDF 20% größer (90→48 / 40→48 px)
- [x] Bug: Zahlungsziel bei Bestellungen ausgeblendet (purchase_order)

## Phase 83: Gmail-Entwurf mit PDF-Anhang
- [ ] Gmail MCP-Tools prüfen (create_draft Funktion)
- [ ] Backend: sendEmailDraft Procedure (PDF generieren + Gmail-Entwurf via MCP)
- [ ] Frontend: E-Mail-Button öffnet Dialog mit Betreff/Text-Vorschau, dann Entwurf erstellen
- [ ] E-Mail-Signatur automatisch einfügen
- [ ] Testen und Checkpoint

## Bugfix: Projekt löschen
- [x] Löschen-Button in Projektdetail-Header einbauen (mit Bestätigungsdialog)
- [x] Backend deleteProject löscht zuerst alle abhängigen Daten (cascade)

## Feature: Angebot → Lieferschein konvertieren
- [x] Backend: invoices.convert Procedure um delivery_note erweitert (kopiert Angebot-Items ohne Preise, erstellt neuen Lieferschein mit LS-Nummer)
- [x] Frontend: "Lieferschein" Option im Konvertierungs-Dialog der Dokumentliste
- [x] Frontend: onSuccess-Handler für delivery_note Label angepasst
- [x] TypeScript: Truck-Icon importiert, 0 Fehler

## Bugfix: Angebot-Button im Projektdetail → 404
- [x] Angebot-Button navigiert zur falschen URL (404) — Route /invoices/new fehlte
- [x] Route /invoices/new in App.tsx hinzugefügt

## Bugfix: Angebots-Modul unzuverlässig (kritisch)
- [x] Positionen nach dem Speichern nicht sichtbar ohne Browser-Refresh
- [x] Cache-Invalidierung nach Mutations erweitert: getById für alle Mutations invalidiert
- [x] QueryClient staleTime=0, refetchOnWindowFocus=true gesetzt
- [x] invoices.update gibt jetzt id zurück für gezielte Invalidierung
- [x] convertMut invalidiert Quell-Angebot und neues Dokument

## Feature: Projektkalkulation → Angebot automatisch übernehmen
- [x] Projekt-Positionen (items) Datenstruktur analysiert: name, description, quantity, unitVk, technique
- [x] Backend: projects.items.list bereits vorhanden, gibt alle Felder zurück
- [x] Frontend: Mapping verbessert — name als Haupttitel, description+material als Langbeschreibung, Einheit aus Technik, calcItem für korrekte Summen
- [x] useEffect auch bei leerem Array ausgeführt (leere Kalkulation öffnet trotzdem Formular)

## Feature: Projektstatus → 'Angebot' bei Angebotserstellung
- [ ] Backend: invoices.create setzt Projektstatus auf 'offer' wenn projectId vorhanden und type='offer'
- [ ] Nur wenn aktueller Status früher als 'offer' ist (inquiry, calculation)

## Bugfix: Cache-Bug beim Angebot bearbeiten (kritisch)
- [x] Nach Speichern → Schließen → Wieder öffnen: alte Daten sichtbar — behoben
- [x] Root Cause: React Query lieferte gecachte Daten beim erneuten Öffnen
- [x] Fix: queryClient.removeQueries in updateMut onSuccess und openEdit — Cache wird direkt gelöscht

## Feature: PWA (Progressive Web App)
- [x] App-Icon generiert (512x512, Fabrica ERP Logo mit 3D-Würfel) und auf CDN hochgeladen
- [x] manifest.json aktualisiert: echtes Icon, theme-color #4f46e5, orientation any, lang de
- [x] Service Worker (sw.js) erstellt: Network-first, API nie gecacht
- [x] Meta-Tags in index.html: theme-color, apple-touch-icon
- [x] Service Worker in main.tsx registriert

## Bugfix: Angebotsnummer ignoriert Einstellungen
- [x] getNextInvoiceNumber ignorierte Einstellungs-Startwert wenn Sequenz bereits existierte
- [x] Fix: Wenn aktuelle Sequenz < Einstellungs-Startwert, wird auf Startwert gesprungen

## Feature: Kunden/Lieferanten Suchfeld (Combobox)
- [x] EntitySearch-Komponente erstellt (Suchfeld + Live-Vorschläge, bis 50 Treffer, Tastatur-Navigation)
- [x] In Invoices.tsx: Kunden- und Lieferanten-Dropdown ersetzt
- [x] In Projects.tsx: Kunden-Dropdown ersetzt
- [x] In ProjectDetail.tsx: Lieferanten-Dropdown im Dokument-Upload ersetzt

## Feature: Kundennummer-Startnummer in Einstellungen
- [x] Schema: customer_number Feld zur customers-Tabelle, customer_start_number zur company_settings-Tabelle
- [x] createCustomer: automatische Kundennummer-Vergabe mit Startwert aus Einstellungen
- [x] settings.update Router: customerStartNumber Parameter hinzugefügt
- [x] Settings.tsx: Feld "Kundennummer Startnummer" eingebaut (unter Nummernkreis)

## Feature: Lieferantenanfragen-Modul
- [x] DB-Schema: inquiries + inquiry_items Tabellen (via SQL angelegt)
- [x] DB-Migration ausgeführt
- [x] Backend: db.ts Hilfsfunktionen (CRUD, getNextInquiryNumber)
- [x] Backend: routers.ts Procedures (list, getById, create, update, delete, updateStatus, generatePdf)
- [x] Einstellungen: ANF-Startnummer in Nummernkreis-Bereich eingebaut
- [x] Frontend: InquiriesPage (Übersicht mit Filter, Suche, Status)
- [x] Frontend: Inquiry-Formular (Lieferant via EntitySearch, Positionen, Freitextfelder, Wunschliefertermin)
- [x] Frontend: PDF-Vorschau und Download
- [x] Navigation: Lieferantenanfragen (SendHorizontal-Icon) in Sidebar eingebaut
- [x] Status-Workflow: Entwurf → Versendet → Beantwortet → Abgeschlossen/Storniert

## Feature: Angebot duplizieren
- [x] Backend: invoices.duplicate Procedure (kopiert alle Felder + Items, neue Nummer, heutiges Datum, Status=draft)
- [x] Frontend: "Duplizieren"-Button (blau, Copy-Icon) in der Angebotsliste für alle Dokumenttypen
- [x] Nach Duplizieren: Kopie direkt zum Bearbeiten geöffnet (Kunde änderbar)

## Feature: Kundenakte mit Google Drive
- [ ] Google Drive API Credentials (OAuth2 Refresh Token) einrichten
- [ ] Backend: Google Drive Helper (Upload, Ordner erstellen, Download-Link, Löschen)
- [ ] DB-Schema: customer_files Tabelle (customerId, projectId, driveFileId, driveUrl, filename, category, notes)
- [ ] Backend: customers.files Procedures (list, upload, delete, updateNote)
- [ ] Frontend: "Akte"-Tab in Customers.tsx (Upload, Dateiliste, Download, Löschen, Notiz bearbeiten)
- [ ] Ordnerstruktur in Google Drive: Fabrica ERP / Kunden / Kundenname / Kategorie /
- [ ] Backup-Button: Metadaten-CSV der Kundenakte in bestehenden Gesamt-Backup integrieren

## Phase 24: Kundenakte mit Google Drive Integration
- [x] Google Drive OAuth2 Web-Client erstellt (Fabrica ERP Web)
- [x] Refresh Token generiert und als GOOGLE_DRIVE_REFRESH_TOKEN Secret gespeichert
- [x] DB: customer_files Tabelle (id, customer_id, project_id, category, filename, drive_file_id, drive_file_url, file_size, mime_type, notes, uploaded_by, created_at)
- [x] server/googleDrive.ts: Ordner-Struktur (Fabrica ERP/Kunden/[Name]/), Upload, Delete, testConnection
- [x] tRPC Router: customerFiles.list, upload, delete, updateNote, testConnection
- [x] Frontend: "Akte"-Button pro Kunden-Karte (blau, FolderOpen-Icon)
- [x] Kundenakte-Dialog: Drag & Drop Upload, Kategorie-Auswahl, Notiz-Feld
- [x] Kategorie-Filter: CAD-Daten, Zeichnungen, Fotos, NDA, Protokolle, Lieferantenangebote, Verträge, Rechnungen, Sonstiges
- [x] Datei-Aktionen: In Google Drive öffnen (ExternalLink), Herunterladen, Löschen
- [x] Max. 50 MB Dateigrößen-Validierung
- [x] Vitest: 3 neue Tests für customerFiles Router (alle grün)
- [x] 222 Tests grün, 0 TypeScript-Fehler

## Phase 25: Kundenakte-Erweiterungen
-- [x] Backend: customerFiles.listByProject – Dateien nach customerId + projectId filtern
- [x] Backend: customerFiles.zipExport – alle Dateien einer Kundenakte als ZIP zurückgeben
- [x] Frontend: Projekt-Detail – neuer "Akte"-Tab mit CustomerAkte-Komponente (gefiltert nach Projekt-ID)
- [x] Frontend: Dashboard – Drive-Verbindungsstatus-Badge (grün/rot) mit E-Mail + Speicherplatz
- [x] Frontend: Akte-Dialog – ZIP-Download-Button für alle Dateien der Kundenakte
## Bugs Phase 25
- [x] Bug: Upload fehlgeschlagen – behoben (neuer Refresh Token mit Web-Client generiert)

## Phase 26: Kundenakte Umbau – Automatische Aggregation (kein separater Upload)
- [x] Analyse: Alle Datei-Quellen im Projekt inventarisiert (cad_files, project_documents, invoices)
- [x] Backend: customerFiles.list – aggregiert alle Projekt-Dateien eines Kunden aus cad_files, project_documents, invoices
- [x] Backend: Google Drive Auto-Sync beim Upload aus dem Projekt (cad_files, project_documents)
- [x] Frontend: Kundenakte-Dialog – Upload-Bereich entfernt, nur Lese-Ansicht mit aggregierten Dateien + Projekt-Info
- [x] Frontend: Info-Banner erklärt dass Uploads direkt im Projekt erfolgen
- [x] ZIP-Export weiterhin funktionsfähig
- [x] 222 Tests grün, 0 TypeScript-Fehler

## Phase 27: Kundenakte Erweiterungen (Fotos, Protokolle, Accordion-Gruppierung)
- [x] Backend: Beratungsprotokolle (consultation_entries) in Aggregations-Query eingebunden
- [x] Backend: Fotos (Bild-MIME-Type aus project_documents) als eigene Kategorie
- [x] Backend: TypeScript-Fehler behoben (AkteFile source-Typ, createdAt null-Fallback, Uint8Array-Spread)
- [x] Frontend: Kundenakte-Dialog nach Projekt gruppiert (Accordion, aufklappbar)
- [x] Frontend: Protokoll-Inhalt als Vorschau-Text in der Dateiliste
- [x] 222 Tests grün, 0 TypeScript-Fehler

## Bug Phase 27: Kundenakte leer trotz vorhandener Daten
- [x] Bug: Ursache war customer_id = NULL in allen Projekten – behoben durch Kunden-Zuordnung als Pflichtfeld (Phase 28)

## Phase 28: Kunden-Zuordnung in Projekten (Pflichtfeld)
- [x] Frontend: Kunden-Feld im Projekt-Anlegen-Dialog als Pflichtfeld (* Markierung, Button deaktiviert ohne Kunde)
- [x] Frontend: Kunden-Badge im Projekt-Header (blau = zugewiesen, amber = nicht zugewiesen, klickbar)
- [x] Frontend: Kunden-Zuweisungs-Dialog im Projekt-Detail (EntitySearch, sofortige Speicherung)
- [x] Backend: projects.update unterstützt bereits customerId (kein Änderungsbedarf)
- [x] 222 Tests grün, 0 Fehler

## Phase 29: Materialbibliothek Accordion-Liste
- [x] Frontend: Materialbibliothek von Karten-Ansicht auf aufklappbare Accordion-Liste umbauen
- [x] Jede Zeile: Name + farbiger Kategorie-Badge + Eigenschaften-Vorschau (truncated)
- [x] Aufgeklappt: Eigenschaften, Anwendung, Vorteile, Notizen mit Bearbeiten/Löschen-Buttons
- [x] Suche bleibt erhalten, 0 TypeScript-Fehler

## Phase 30: Google Drive Projekt-Unterordner
- [x] Google Drive Service: Projekt-Unterordner unter Kunden-Ordner erstellen
- [x] Struktur: Fabrica ERP/Kunden/[Kundenname]/[Projektname]/[Datei]
- [x] Alle Upload-Funktionen (CAD, Dokumente) auf neue Struktur anpassen
- [x] Bestehende Tests grün halten (222 Tests grün)

## Phase 31: Drive-Migration + Sync-Status
- [x] DB: cad_files – Spalte drive_file_id, drive_synced (boolean) hinzugefügt
- [x] DB: project_documents – Spalte drive_file_id, drive_synced (boolean) hinzugefügt
- [x] Backend: Google Drive Migrations-Endpunkt (verschiebt Dateien in Projektordner)
- [x] Backend: CAD-Upload und Dokument-Upload speichern drive_file_id + drive_synced=true
- [x] Frontend: Sync-Status-Icon in CAD-Dateiliste (Google Drive Icon wenn synced, klickbar)
- [x] Frontend: Sync-Status-Icon in Projekt-Dokument-Liste
- [x] Frontend: Migrations-Button in Einstellungen (Datensicherung-Tab) mit Ergebnis-Anzeige
- [x] 222 Tests grün

## Phase 32: Manueller Re-Sync-Button

- [x] Backend: cadFiles.syncToDrive Endpunkt (lädt einzelne Datei erneut zu Drive hoch)
- [x] Backend: projectDocs.syncToDrive Endpunkt (lädt einzelnes Dokument erneut zu Drive hoch)
- [x] Frontend: Re-Sync-Button in CAD-Dateiliste (nur sichtbar wenn driveSynced=0)
- [x] Frontend: Re-Sync-Button in Projekt-Dokument-Liste (nur sichtbar wenn driveSynced=0)
- [x] 222 Tests grün

## Phase 33: Lieferanten als Kunden auswählbar

- [ ] Backend: customers.listAll Endpunkt erweitern um auch Lieferanten zurückzugeben (mit Typ-Label)
- [ ] Frontend: Kundenauswahl in Projekt-Erstellung zeigt Kunden + Lieferanten (gruppiert)
- [ ] Frontend: Kundenauswahl in Projekt-Bearbeitung zeigt Kunden + Lieferanten (gruppiert)
- [ ] 222+ Tests grün

## Phase 34: Mehrfachauswahl beim Upload

- [x] CAD-Datei-Upload: multiple Dateiauswahl + sequenzieller Upload mit Fortschrittsanzeige
- [x] Projekt-Dokument-Upload: multiple Dateiauswahl + sequenzieller Upload mit Fortschrittsanzeige
- [x] Kundenakte-Datei-Upload: multiple Dateiauswahl + sequenzieller Upload mit Fortschrittsanzeige

## Phase 35: Drive-Ordnerstruktur Bugfix

- [x] Migrations-Endpunkt: customerFiles ebenfalls in Projektordner verschieben
- [x] Migrations-Endpunkt: Lieferanten-Projekte berücksichtigen (supplierId)
- [x] customerFiles.upload: Fehler-Logging verbessern (Drive-Fehler sichtbar machen)
- [x] Migrations-UI: Detailliertere Rückmeldung (welche Dateien wurden verschoben)

## Phase 36: Drive-Button im Projekt-Header
- [x] Backend: getProjectDriveFolderUrl Procedure
- [x] Frontend: "In Drive öffnen"-Button im Projekt-Header

## Phase 37: Drive-Ordner bei Projekttitel-Umbenennung
- [x] Google Drive: renameDriveFolder Funktion
- [x] projects.update: Drive-Ordner umbenennen wenn Titel oder Projektnummer geändert

## Phase 38: Angebote an Lieferanten
- [x] Frontend: Umschalter '→ Lieferant wählen' / '→ Kunde wählen' im Angebots-Formular
- [x] Frontend: recipientType State-Variable für alle Dokumenttypen
- [x] Frontend: openNew() unterstützt supplierId prefill
- [x] Frontend: openEdit() setzt recipientType korrekt beim Bearbeiten
- [x] Frontend: Invoice-Liste zeigt [Lieferant]-Badge für alle Typen mit supplierId

## Phase 39: Bearbeiten-Funktionen verbessern
- [x] Projekt-Detail: Bearbeiten-Button im Header (Titel, Typ, Notizen, Projektnummer)
- [x] Projekt-Detail: Projekt-Bearbeiten-Dialog mit allen Feldern
- [x] Kunden: Bearbeiten-Button immer sichtbar (nicht nur beim Hover)
- [x] Lieferanten: Bearbeiten-Button immer sichtbar (nicht nur beim Hover)

## Phase 40: Projekt-Umbenennung Bug-Fix
- [x] Bug: Titel-Änderung im Bearbeiten-Dialog wird nicht gespeichert
- [x] Bug: Google Drive Ordner-Umbenennung bei Titel-Änderung sicherstellen

## Phase 41: PDF-Empfängeradresse Bug-Fix
- [x] Bug: Bei Lieferanten-Auswahl wird name statt company als Firmenname gesetzt → Ansprechpartner erscheint als erste Zeile im PDF
- [x] Fix: onSupplierSelect soll company als recipientCompany und name als recipientName setzen
- [x] Fix: Lieferanten-Suche soll company-Name anzeigen wenn vorhanden

## Phase 42: Nummernvergabe-Logik überarbeiten
- [x] Analyse: Wie wird die Nummer aktuell vergeben (beim Erstellen oder beim Finalisieren)?
- [x] Rechnung/Gutschrift/AB: Nummer erst beim Finalisieren (Status-Wechsel von Entwurf → Gesendet/Bezahlt) vergeben
- [x] Angebot/Bestellung/Lieferschein: Nummer beim Erstellen vergeben, aber Löschen immer erlaubt (keine GoBD-Pflicht)
- [x] Entwurf ohne Nummer: Rechnungs-Entwürfe zeigen "ENTWURF" statt Nummer bis zur Finalisierung
- [x] UI: Hinweis beim Löschen einer Rechnung im Entwurf-Status (Nummer wird nicht verbraucht)

## Phase 43: PDF-Layout Abstand
- [x] Abstand zwischen Rechnungsnummer und Positions-Tabelle vergrößern

## Phase 44: Projekt-Status "Abgeschlossen"
- [ ] Backend: Status-Enum um 'abgeschlossen' erweitern
- [ ] Backend: DB-Migration pushen
- [ ] Frontend: "Als abgeschlossen markieren"-Button im Projekt-Detail Header
- [ ] Frontend: Abgeschlossen-Badge in Projektliste (grüner Haken)
- [ ] Frontend: Status umkehrbar (Button wechselt zu "Wieder öffnen")
- [ ] Frontend: Abgeschlossene Projekte in Kanban/Liste klar kennzeichnen

## Phase 46: Bug Abschließen-Button (weiterhin)
- [ ] Bug: Abschließen-Button dreht sich endlos auch nach AlertDialog-Fix

## Phase 48: Kunden-Hinweise (Flags)
- [x] DB: flags-Feld (JSON-Array) zur customers-Tabelle hinzufügen
- [x] tRPC: customers.create + update mit flags-Feld
- [x] Frontend: Kunden-Bearbeiten-Dialog: Hinweise als Tags eingeben (frei wählbar + Schnellauswahl)
- [x] Frontend: Kunden-Karte: Hinweise als farbige Badges anzeigen
- [x] Frontend: Angebots-/Rechnungsformular: Hinweise des gewählten Kunden als Warnung anzeigen

## Bug-Fix: CAD-Tab Vorschau-Buttons
- [x] Vorschau-Button (FileCode2-Icon) für STL/OBJ dauerhaft sichtbar (war nur bei Hover sichtbar)
- [x] Vorschau-Button auch für STP/STEP-Dateien hinzugefügt (öffnet Info-Dialog mit Download)
- [x] Löschen-Button bleibt weiterhin nur bei Hover sichtbar (verhindert versehentliches Löschen)

## Phase 49: Projekt-Archivierung & Statistik-Dashboard
- [x] DB: projects-Tabelle um archived_at, rejection_reason, rejection_note erweitern
- [x] DB: rejected-Status zum Projektstatus-Enum hinzufügen
- [x] tRPC: projects.archive (Status auf rejected setzen, Felder befüllen)
- [x] tRPC: projects.reactivate (Status zurücksetzen, Felder leeren)
- [x] tRPC: projects.listArchived (alle rejected-Projekte mit Filtern)
- [x] tRPC: statistics.projectStats (Hit Rate, Ablehnungsgründe, Monats-/Jahresverlauf)
- [x] Frontend: "Nicht angenommen"-Button in Projektliste (Hover-Icon)
- [x] Frontend: Archivierungs-Modal (Ablehnungsgrund-Dropdown + Freitextfeld)
- [x] Frontend: Archiv-Tab in Projektliste mit Filter (Jahr, Grund)
- [x] Frontend: Reaktivieren-Button im Archiv
- [x] Frontend: Statistik-Seite /statistics mit Balken- und Tortendiagramm
- [x] Frontend: KPI-Kacheln (Hit Rate, Gesamtangebote, Gesamtaufträge)
- [x] Sidebar-Menüpunkt "Statistik" hinzugefügt
- [x] Vitest-Tests: 226 Tests grün

## Phase 50: Webseiten-Feld für Kunden und Lieferanten
- [x] DB: website-Spalte zu customers und suppliers hinzufügen
- [x] tRPC: website-Feld in create/update für customers und suppliers
- [x] Frontend: Webseiten-Feld im Bearbeiten-Dialog (Kunden + Lieferanten)
- [x] Frontend: Webseiten-Link als klickbarer Link in der Karten-Ansicht

## KRITISCHER BUG: invoice_items INSERT-Fehler bei mehr als 2-3 Positionen
- [x] Ursache analysiert: DB-Verbindung (ECONNRESET/ETIMEDOUT) bricht bei sequenziellen INSERTs ab
- [x] Fix: withRetry-Wrapper + Batch-INSERT (alle Items auf einmal statt einzeln in Schleife)
- [ ] Testen mit 5+ Positionen (bitte von Dani testen)

## Bug-Fix: Positions-Summe Netto/Brutto
- [x] Positions-Summe zeigte Brutto statt Netto → korrigiert auf lineTotalNet

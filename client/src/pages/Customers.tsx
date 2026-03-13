import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Users, Mail, Phone, Building2, MapPin, Edit2, Trash2, User,
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  b2b: "B2B", museum: "Museum", industry: "Industrie", private: "Privat", other: "Sonstige",
};

type CustomerForm = {
  name: string; company: string; type: string;
  email: string; email2: string; email3: string;
  phone: string;
  contact2: string; contact3: string;
  street: string; zip: string; city: string; country: string;
  notes: string;
};

const EMPTY_FORM: CustomerForm = {
  name: "", company: "", type: "b2b",
  email: "", email2: "", email3: "",
  phone: "",
  contact2: "", contact3: "",
  street: "", zip: "", city: "", country: "Deutschland",
  notes: "",
};

// ─── sevDesk CSV-Spalten → ERP-Felder Mapping ────────────────────────────────
// Typische sevDesk-Exportspalten (case-insensitive matching)
const SEVDESK_FIELD_MAP: Record<string, string> = {
  // Name/Kontakt
  "name": "name",
  "vorname": "name",
  "nachname": "name",
  "ansprechpartner": "name",
  "kontaktperson": "name",
  "contact person": "name",
  // Firma
  "firma": "company",
  "firmenname": "company",
  "unternehmen": "company",
  "company": "company",
  "organisation": "company",
  // E-Mail
  "email": "email",
  "e-mail": "email",
  "e_mail": "email",
  "emailadresse": "email",
  "mail": "email",
  // Telefon
  "telefon": "phone",
  "tel": "phone",
  "phone": "phone",
  "mobil": "phone",
  "handynummer": "phone",
  // Adresse
  "straße": "street",
  "strasse": "street",
  "street": "street",
  "adresse": "street",
  "straße und hausnummer": "street",
  // PLZ
  "plz": "zip",
  "postleitzahl": "zip",
  "zip": "zip",
  "postal code": "zip",
  // Stadt
  "ort": "city",
  "stadt": "city",
  "city": "city",
  // Land
  "land": "country",
  "country": "country",
  // Notizen
  "notiz": "notes",
  "notizen": "notes",
  "notes": "notes",
  "anmerkung": "notes",
  "beschreibung": "notes",
  // sevDesk-ID
  "id": "sevdeskId",
  "kundennummer": "sevdeskId",
  "customer number": "sevdeskId",
  "sevdesk id": "sevdeskId",
};

const ERP_FIELDS = [
  { key: "name", label: "Name / Ansprechpartner" },
  { key: "company", label: "Firma" },
  { key: "email", label: "E-Mail" },
  { key: "phone", label: "Telefon" },
  { key: "street", label: "Straße" },
  { key: "zip", label: "PLZ" },
  { key: "city", label: "Stadt" },
  { key: "country", label: "Land" },
  { key: "notes", label: "Notizen" },
  { key: "sevdeskId", label: "sevDesk-ID / Kundennr." },
  { key: "_ignore", label: "— Ignorieren —" },
];

// ─── CSV-Parser ───────────────────────────────────────────────────────────────
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Unterstützt Semikolon (sevDesk Standard) und Komma als Trennzeichen
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Auto-detect Trennzeichen
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

// Auto-Mapping: versucht sevDesk-Spalten automatisch zuzuordnen
function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach(h => {
    const key = h.toLowerCase().trim();
    mapping[h] = SEVDESK_FIELD_MAP[key] ?? "_ignore";
  });
  return mapping;
}

// ─── CSV-Import-Dialog ────────────────────────────────────────────────────────
function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [onDuplicate, setOnDuplicate] = useState<"skip" | "update">("skip");
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; total: number } | null>(null);
  const [showAllPreview, setShowAllPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const importMut = trpc.customers.importCsv.useMutation({
    onSuccess: (data) => {
      utils.customers.list.invalidate();
      setResult(data);
      setStep("result");
    },
    onError: (e) => toast.error("Import-Fehler: " + e.message),
  });

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCsv(text);
      if (h.length === 0) { toast.error("CSV-Datei ist leer oder ungültig"); return; }
      setHeaders(h);
      setRows(r);
      setMapping(autoMap(h));
      setStep("mapping");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) handleFile(file);
    else toast.error("Bitte eine CSV-Datei hochladen");
  }, [handleFile]);

  const handleImport = () => {
    // Zeilen in ERP-Objekte umwandeln
    const mapped = rows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (field && field !== "_ignore" && row[i]) {
          // Bei mehreren Spalten auf dasselbe Feld: zusammenführen
          if (field === "name" && obj.name) {
            obj.name = obj.name + " " + row[i];
          } else {
            obj[field] = row[i];
          }
        }
      });
      return obj;
    }).filter(o => o.name || o.company);

    if (mapped.length === 0) {
      toast.error("Keine gültigen Zeilen gefunden. Bitte Spalten-Mapping prüfen.");
      return;
    }

    importMut.mutate({
      rows: mapped.map(o => ({
        name: o.name || o.company || "",
        company: o.company,
        email: o.email,
        phone: o.phone,
        street: o.street,
        zip: o.zip,
        city: o.city,
        country: o.country,
        notes: o.notes,
        sevdeskId: o.sevdeskId,
      })),
      onDuplicate,
    });
  };

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setShowAllPreview(false);
  };

  const previewRows = showAllPreview ? rows : rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-400" />
            sevDesk CSV-Import
          </DialogTitle>
        </DialogHeader>

        {/* ── Schritt 1: Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportiere deine Kunden in sevDesk unter <strong>Kontakte → Exportieren → CSV</strong> und lade die Datei hier hoch.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">CSV-Datei hier ablegen</p>
              <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
              <p className="text-xs text-muted-foreground mt-2">Unterstützt: sevDesk-Export (Semikolon- oder Komma-getrennt, UTF-8)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* ── Schritt 2: Mapping ── */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{rows.length} Zeilen</strong> erkannt. Prüfe das Spalten-Mapping und passe es bei Bedarf an.
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Neu laden
              </Button>
            </div>

            {/* Spalten-Mapping */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground grid grid-cols-2 gap-2">
                <span>CSV-Spalte</span><span>ERP-Feld</span>
              </div>
              <div className="divide-y divide-border max-h-48 overflow-y-auto">
                {headers.map(h => (
                  <div key={h} className="px-3 py-2 grid grid-cols-2 gap-2 items-center">
                    <span className="text-sm font-mono text-muted-foreground truncate" title={h}>{h}</span>
                    <Select value={mapping[h] ?? "_ignore"} onValueChange={v => setMapping(m => ({ ...m, [h]: v }))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ERP_FIELDS.map(f => (
                          <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Vorschau */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                Vorschau ({showAllPreview ? rows.length : Math.min(5, rows.length)} von {rows.length} Zeilen)
              </p>
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="text-xs w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      {headers.map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {h}
                          {mapping[h] && mapping[h] !== "_ignore" && (
                            <span className="ml-1 text-primary">→ {ERP_FIELDS.find(f => f.key === mapping[h])?.label}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1.5 max-w-[150px] truncate" title={cell}>{cell || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setShowAllPreview(v => !v)}>
                  {showAllPreview ? <><ChevronUp className="h-3 w-3 mr-1" /> Weniger anzeigen</> : <><ChevronDown className="h-3 w-3 mr-1" /> Alle {rows.length} Zeilen anzeigen</>}
                </Button>
              )}
            </div>

            {/* Duplikat-Strategie */}
            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">Bei Duplikaten (gleiche E-Mail oder Name)</p>
                <p className="text-xs text-muted-foreground">Was soll passieren wenn ein Kunde bereits existiert?</p>
              </div>
              <Select value={onDuplicate} onValueChange={v => setOnDuplicate(v as any)}>
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Überspringen</SelectItem>
                  <SelectItem value="update">Aktualisieren</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── Schritt 3: Ergebnis ── */}
        {step === "result" && result && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-400 shrink-0" />
              <div>
                <p className="font-semibold text-lg">Import abgeschlossen</p>
                <p className="text-sm text-muted-foreground">{result.total} Zeilen verarbeitet</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{result.created}</p>
                <p className="text-xs text-muted-foreground mt-1">Neu angelegt</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{result.updated}</p>
                <p className="text-xs text-muted-foreground mt-1">Aktualisiert</p>
              </div>
              <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-1">Übersprungen</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => { onClose(); reset(); }}>Abbrechen</Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={reset}>Zurück</Button>
              <Button
                onClick={handleImport}
                disabled={importMut.isPending}
                className="gap-2"
              >
                {importMut.isPending ? "Importiere..." : <><Upload className="h-4 w-4" /> {rows.length} Kunden importieren</>}
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>Weiteren Import</Button>
              <Button onClick={() => { onClose(); reset(); }}>Fertig</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Kunden-Formular-Dialog ───────────────────────────────────────────────────
function CustomerDialog({
  open, onClose, initial, onSave, title, isPending,
}: {
  open: boolean;
  onClose: () => void;
  initial: CustomerForm;
  onSave: (f: CustomerForm) => void;
  title: string;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CustomerForm>(initial);
  const set = (k: keyof CustomerForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleOpenChange = (o: boolean) => {
    if (o) setForm(initial);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name / Ansprechpartner 1 *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div className="space-y-1.5">
              <Label>Ansprechpartner 2</Label>
              <Input value={form.contact2} onChange={e => set("contact2", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Ansprechpartner 3</Label>
              <Input value={form.contact3} onChange={e => set("contact3", e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Firma</Label>
              <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Musterfirma GmbH" />
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Kontakt</Label>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-Mail 1</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="max@firma.de" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+49 711 123456" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-Mail 2</Label>
                <Input type="email" value={form.email2} onChange={e => set("email2", e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>E-Mail 3</Label>
                <Input type="email" value={form.email3} onChange={e => set("email3", e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Adresse</Label>
          </div>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Straße & Hausnummer</Label>
              <Input value={form.street} onChange={e => set("street", e.target.value)} placeholder="Musterstraße 12" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>PLZ</Label>
                <Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="12345" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Stadt</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Musterstadt" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Land</Label>
              <Input value={form.country} onChange={e => set("country", e.target.value)} placeholder="Deutschland" />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Interne Anmerkungen..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || isPending}>
            {isPending ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Customers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setShowCreate(false);
      toast.success("Kunde angelegt");
    },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setEditId(null);
      toast.success("Kunde gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("Kunde gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const editCustomer = customers.find(c => c.id === editId);
  const editInitial: CustomerForm = editCustomer ? {
    name: editCustomer.name ?? "",
    company: editCustomer.company ?? "",
    type: editCustomer.type ?? "b2b",
    email: editCustomer.email ?? "",
    email2: (editCustomer as any).email2 ?? "",
    email3: (editCustomer as any).email3 ?? "",
    phone: editCustomer.phone ?? "",
    contact2: (editCustomer as any).contact2 ?? "",
    contact3: (editCustomer as any).contact3 ?? "",
    street: (editCustomer as any).street ?? "",
    zip: (editCustomer as any).zip ?? "",
    city: (editCustomer as any).city ?? "",
    country: (editCustomer as any).country ?? "Deutschland",
    notes: editCustomer.notes ?? "",
  } : EMPTY_FORM;

  const handleCreate = (f: CustomerForm) => {
    createMutation.mutate({
      name: f.name,
      company: f.company || undefined,
      type: f.type as any,
      email: f.email || undefined,
      email2: f.email2 || undefined,
      email3: f.email3 || undefined,
      phone: f.phone || undefined,
      contact2: f.contact2 || undefined,
      contact3: f.contact3 || undefined,
      street: f.street || undefined,
      zip: f.zip || undefined,
      city: f.city || undefined,
      country: f.country || undefined,
      notes: f.notes || undefined,
    });
  };

  const handleUpdate = (f: CustomerForm) => {
    if (!editId) return;
    updateMutation.mutate({
      id: editId,
      name: f.name,
      company: f.company || undefined,
      type: f.type as any,
      email: f.email || undefined,
      email2: f.email2 || undefined,
      email3: f.email3 || undefined,
      phone: f.phone || undefined,
      contact2: f.contact2 || undefined,
      contact3: f.contact3 || undefined,
      street: f.street || undefined,
      zip: f.zip || undefined,
      city: f.city || undefined,
      country: f.country || undefined,
      notes: f.notes || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-1">{customers.length} Kunden gesamt</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-400" />
            sevDesk CSV importieren
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />Neuer Kunde
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Kunden suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Kunden...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Users className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Kunden gefunden</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" /> CSV importieren
            </Button>
            <Button onClick={() => setShowCreate(true)}>Ersten Kunden anlegen</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => {
            const c = customer as any;
            const hasAddress = c.street || c.city || c.zip;
            const emails = [customer.email, c.email2, c.email3].filter(Boolean);
            const contacts = [customer.name, c.contact2, c.contact3].filter(Boolean);
            return (
              <div
                key={customer.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group"
              >
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-semibold text-sm">{customer.name.charAt(0).toUpperCase()}</span>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{customer.name}</span>
                    {customer.company && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{customer.company}
                      </span>
                    )}
                  </div>

                  {contacts.length > 1 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {contacts.slice(1).map((ct, i) => (
                        <span key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />{ct}
                        </span>
                      ))}
                    </div>
                  )}

                  {emails.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {emails.map((em, i) => (
                        <a key={i} href={`mailto:${em}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                          <Mail className="h-3 w-3" />{em}
                        </a>
                      ))}
                    </div>
                  )}

                  {customer.phone && (
                    <a href={`tel:${customer.phone.replace(/\s/g, "")}`} className="text-xs text-muted-foreground hover:text-green-400 flex items-center gap-1 w-fit transition-colors">
                      <Phone className="h-3 w-3" />{customer.phone}
                    </a>
                  )}

                  {hasAddress && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[c.street, [c.zip, c.city].filter(Boolean).join(" "), c.country !== "Deutschland" ? c.country : ""].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">{TYPE_LABELS[customer.type] ?? customer.type}</Badge>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300" onClick={() => setEditId(customer.id)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`Kunde "${customer.name}" wirklich löschen?`)) deleteMutation.mutate({ id: customer.id }); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CSV-Import-Dialog */}
      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />

      {/* Create Dialog */}
      <CustomerDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initial={EMPTY_FORM}
        onSave={handleCreate}
        title="Neuen Kunden anlegen"
        isPending={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editId !== null && (
        <CustomerDialog
          open={true}
          onClose={() => setEditId(null)}
          initial={editInitial}
          onSave={handleUpdate}
          title="Kunde bearbeiten"
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

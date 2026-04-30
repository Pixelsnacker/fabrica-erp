import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Plus, Search, Users, Mail, Phone, Building2, MapPin, Edit2, Trash2, User,
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp,
  FolderOpen, Download, FileText, Image, File, Shield, ClipboardList, Package,
  Loader2, ExternalLink, FolderSync, Wifi, WifiOff, Tag, AlertTriangle, Globe, Receipt,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  b2b: "B2B", museum: "Museum", industry: "Industrie", private: "Privat", other: "Sonstige",
};

// Vordefinierte Flag-Vorschläge für schnelles Hinzufügen
const FLAG_PRESETS = [
  { label: "Vorkasse", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { label: "Schlechter Zahler", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { label: "Stammkunde", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { label: "Rechnungs-E-Mail abweichend", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { label: "Nur Barzahlung", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { label: "Gesperrt", color: "bg-red-600/20 text-red-500 border-red-600/30" },
];

// Farbe für einen Flag-Text bestimmen (basierend auf Inhalt)
export function getFlagColor(flag: string): string {
  const lower = flag.toLowerCase();
  if (lower.includes("vorkasse") || lower.includes("gesperrt") || lower.includes("barzahlung")) {
    return "bg-red-500/20 text-red-400 border-red-500/30";
  }
  if (lower.includes("schlecht") || lower.includes("mahnung") || lower.includes("inkasso")) {
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  }
  if (lower.includes("stamm") || lower.includes("vip") || lower.includes("premium")) {
    return "bg-green-500/20 text-green-400 border-green-500/30";
  }
  if (lower.includes("email") || lower.includes("e-mail") || lower.includes("abweichend")) {
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  }
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

// ─── Flag-Tag-Editor ──────────────────────────────────────────────────────────
function FlagEditor({ flags, onChange }: { flags: string[]; onChange: (flags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addFlag = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || flags.includes(trimmed)) return;
    onChange([...flags, trimmed]);
    setInput("");
  };

  const removeFlag = (flag: string) => {
    onChange(flags.filter(f => f !== flag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFlag(input);
    } else if (e.key === "Backspace" && !input && flags.length > 0) {
      removeFlag(flags[flags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
        Hinweise / Flags
      </Label>
      <p className="text-xs text-muted-foreground">
        Wichtige Hinweise zu diesem Kunden. Werden beim Erstellen von Dokumenten als Warnung angezeigt.
      </p>

      {/* Aktive Flags */}
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-muted/30 border border-border min-h-[36px]">
          {flags.map(flag => (
            <span
              key={flag}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getFlagColor(flag)}`}
            >
              {flag}
              <button
                type="button"
                onClick={() => removeFlag(flag)}
                className="hover:opacity-70 transition-opacity ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Eingabefeld */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Hinweis eingeben + Enter"
          className="text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addFlag(input)}
          disabled={!input.trim()}
          className="shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Vorschläge */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs text-muted-foreground self-center">Schnell hinzufügen:</span>
        {FLAG_PRESETS.filter(p => !flags.includes(p.label)).map(preset => (
          <button
            key={preset.label}
            type="button"
            onClick={() => addFlag(preset.label)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-pointer hover:opacity-80 transition-opacity ${preset.color}`}
          >
            <Plus className="h-2.5 w-2.5" />
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Flag-Anzeige (nur lesen) ─────────────────────────────────────────────────
export function CustomerFlags({ flags }: { flags: string[] | null | undefined }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map(flag => (
        <span
          key={flag}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getFlagColor(flag)}`}
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {flag}
        </span>
      ))}
    </div>
  );
}

// ─── Flag-Warn-Banner (für Dokument-Formular) ─────────────────────────────────
export function CustomerFlagWarning({ flags, customerName }: { flags: string[] | null | undefined; customerName?: string }) {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
      <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-yellow-400">
          Hinweise zu {customerName ? `"${customerName}"` : "diesem Kunden"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {flags.map(flag => (
            <span
              key={flag}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getFlagColor(flag)}`}
            >
              {flag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type CustomerForm = {
  name: string; company: string; type: string;
  email: string; email2: string; email3: string;
  phone: string;
  contact2: string; contact3: string;
  street: string; zip: string; city: string; country: string;
  notes: string;
  website: string;
  flags: string[];
  customerNumber: string;
};

const EMPTY_FORM: CustomerForm = {
  name: "", company: "", type: "b2b",
  email: "", email2: "", email3: "",
  phone: "",
  contact2: "", contact3: "",
  street: "", zip: "", city: "", country: "Deutschland",
  notes: "",
  website: "",
  flags: [],
  customerNumber: "",
};

// ─── sevDesk CSV-Spalten → ERP-Felder Mapping ────────────────────────────────
const SEVDESK_FIELD_MAP: Record<string, string> = {
  "name": "name", "vorname": "name", "nachname": "name",
  "ansprechpartner": "name", "kontaktperson": "name", "contact person": "name",
  "firma": "company", "firmenname": "company", "unternehmen": "company",
  "company": "company", "organisation": "company",
  "email": "email", "e-mail": "email", "e_mail": "email",
  "emailadresse": "email", "mail": "email",
  "telefon": "phone", "tel": "phone", "phone": "phone",
  "mobil": "phone", "handynummer": "phone",
  "straße": "street", "strasse": "street", "street": "street",
  "adresse": "street", "straße und hausnummer": "street",
  "plz": "zip", "postleitzahl": "zip", "zip": "zip", "postal code": "zip",
  "ort": "city", "stadt": "city", "city": "city",
  "land": "country", "country": "country",
  "notiz": "notes", "notizen": "notes", "notes": "notes",
  "anmerkung": "notes", "beschreibung": "notes",
  "id": "sevdeskId", "kundennummer": "sevdeskId",
  "customer number": "sevdeskId", "sevdesk id": "sevdeskId",
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
        result.push(cur.trim()); cur = "";
      } else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

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
      setHeaders(h); setRows(r); setMapping(autoMap(h)); setStep("mapping");
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
    const mapped = rows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const field = mapping[h];
        if (field && field !== "_ignore" && row[i]) {
          if (field === "name" && obj.name) obj.name = obj.name + " " + row[i];
          else obj[field] = row[i];
        }
      });
      return obj;
    }).filter(o => o.name || o.company);
    if (mapped.length === 0) { toast.error("Keine gültigen Zeilen gefunden. Bitte Spalten-Mapping prüfen."); return; }
    importMut.mutate({
      rows: mapped.map(o => ({
        name: o.name || o.company || "",
        company: o.company, email: o.email, phone: o.phone,
        street: o.street, zip: o.zip, city: o.city, country: o.country,
        notes: o.notes, sevdeskId: o.sevdeskId,
      })),
      onDuplicate,
    });
  };

  const reset = () => {
    setStep("upload"); setHeaders([]); setRows([]); setMapping({}); setResult(null); setShowAllPreview(false);
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

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exportiere deine Kunden in sevDesk unter <strong>Kontakte → Exportieren → CSV</strong> und lade die Datei hier hoch.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">CSV-Datei hier ablegen</p>
              <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
              <p className="text-xs text-muted-foreground mt-2">Unterstützt: sevDesk-Export (Semikolon- oder Komma-getrennt, UTF-8)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{rows.length} Zeilen</strong> erkannt. Bitte Spalten zuordnen:
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Duplikate:</span>
                <Select value={onDuplicate} onValueChange={v => setOnDuplicate(v as any)}>
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Überspringen</SelectItem>
                    <SelectItem value="update">Aktualisieren</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {headers.map(h => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate text-muted-foreground">{h}</span>
                  <span className="text-muted-foreground">→</span>
                  <Select value={mapping[h] ?? "_ignore"} onValueChange={v => setMapping(m => ({ ...m, [h]: v }))}>
                    <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ERP_FIELDS.map(f => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Vorschau ({previewRows.length} von {rows.length}):</p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-muted/50">
                      {headers.map(h => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {row.map((cell, j) => <td key={j} className="px-2 py-1 max-w-[120px] truncate">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && (
                <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs" onClick={() => setShowAllPreview(!showAllPreview)}>
                  {showAllPreview ? "Weniger anzeigen" : `Alle ${rows.length} Zeilen anzeigen`}
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Import abgeschlossen</span>
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
              <Button onClick={handleImport} disabled={importMut.isPending} className="gap-2">
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
              <Label>Kunden-Nr.</Label>
              <Input type="number" value={form.customerNumber} onChange={e => set("customerNumber", e.target.value)} placeholder="z. B. 111" />
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
              <Label>Straße &amp; Hausnummer</Label>
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
            <Label>Webseite</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://www.beispiel.de" className="pl-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Interne Anmerkungen..." />
          </div>

          <Separator />

          {/* Flags / Hinweise */}
          <FlagEditor
            flags={form.flags}
            onChange={flags => setForm(f => ({ ...f, flags }))}
          />
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

// ─── Kategorie-Konfiguration ─────────────────────────────────────────────────
const FILE_CATEGORIES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  cad_data:       { label: 'CAD-Daten',          icon: FolderSync,    color: 'text-blue-400' },
  drawing:        { label: 'Zeichnungen',         icon: FileText,      color: 'text-purple-400' },
  photo:          { label: 'Fotos',               icon: Image,         color: 'text-green-400' },
  nda:            { label: 'NDA / Verträge',      icon: Shield,        color: 'text-red-400' },
  protocol:       { label: 'Protokolle',          icon: ClipboardList, color: 'text-yellow-400' },
  supplier_quote: { label: 'Lieferantenangebote', icon: Package,       color: 'text-orange-400' },
  contract:       { label: 'Verträge',            icon: Shield,        color: 'text-pink-400' },
  invoice:        { label: 'Rechnungen',          icon: FileText,      color: 'text-cyan-400' },
  other:          { label: 'Sonstiges',           icon: File,          color: 'text-muted-foreground' },
};

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AkteFileRow({ file }: { file: any }) {
  const cfg = FILE_CATEGORIES[file.category] ?? FILE_CATEGORIES.other;
  const Icon = cfg.icon;
  const isProtocol = file.source === 'protocol';
  const isPhoto = file.source === 'photo' || (file.mimeType && file.mimeType.startsWith('image/'));

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all group">
      {isPhoto && file.fileUrl ? (
        <div className="h-10 w-10 rounded overflow-hidden border border-border shrink-0 cursor-pointer"
          onClick={() => window.open(file.fileUrl, '_blank')}>
          <img src={file.fileUrl} alt={file.filename} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="h-8 w-8 rounded flex items-center justify-center bg-card border border-border shrink-0">
          <Icon className={`h-4 w-4 ${cfg.color}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.filename}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
          {file.fileSize && (
            <><span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(file.fileSize)}</span></>
          )}
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleDateString('de-DE')}</span>
        </div>
        {isProtocol && file.notes && (
          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{file.notes}</p>
        )}
        {!isProtocol && file.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{file.notes}</p>
        )}
      </div>
      {!isProtocol && file.fileUrl && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300"
            onClick={() => window.open(file.fileUrl, '_blank')} title="Datei öffnen">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
            onClick={() => { const a = document.createElement('a'); a.href = file.fileUrl; a.download = file.filename; a.target = '_blank'; a.click(); }}
            title="Herunterladen">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

function CustomerAkte({ customer }: { customer: { id: number; name: string; company?: string | null } }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [zipping, setZipping] = useState(false);
  const [openProjects, setOpenProjects] = useState<string[]>([]);

  const zipMut = trpc.customerFiles.zipExport.useMutation({
    onSuccess: ({ url, fileCount }: { url: string; fileCount: number }) => {
      window.open(url, '_blank');
      toast.success(`ZIP mit ${fileCount} Dateien wird heruntergeladen`);
    },
    onError: (e: any) => toast.error(`ZIP-Export fehlgeschlagen: ${e.message}`),
    onSettled: () => setZipping(false),
  });

  const { data: files = [], isLoading } = trpc.customerFiles.list.useQuery(
    { customerId: customer.id },
    { refetchOnWindowFocus: true }
  );

  const filteredFiles = selectedCategory === 'all'
    ? (files as any[])
    : (files as any[]).filter((f: any) => f.category === selectedCategory);

  const categoryCounts = (files as any[]).reduce((acc: Record<string, number>, f: any) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const projectGroups = filteredFiles.reduce((acc: Record<string, { title: string; number: string | null; files: any[] }>, f: any) => {
    const key = f.projectId ? String(f.projectId) : 'no-project';
    if (!acc[key]) acc[key] = { title: f.projectTitle || 'Ohne Projekt', number: f.projectNumber, files: [] };
    acc[key].files.push(f);
    return acc;
  }, {});

  const projectGroupEntries = Object.entries(projectGroups);

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
        <FolderSync className="h-4 w-4 shrink-0" />
        <span>Alle Dateien werden automatisch aus den Projekten dieses Kunden zusammengeführt. Uploads erfolgen direkt im jeweiligen Projekt.</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} size="sm"
          onClick={() => setSelectedCategory('all')} className="h-7 text-xs">
          Alle ({(files as any[]).length})
        </Button>
        {Object.entries(categoryCounts).map(([cat, count]) => {
          const cfg = FILE_CATEGORIES[cat];
          if (!cfg) return null;
          return (
            <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm"
              onClick={() => setSelectedCategory(cat)} className="h-7 text-xs gap-1">
              <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
              {cfg.label} ({count})
            </Button>
          );
        })}
        {(files as any[]).length > 0 && (
          <Button variant="outline" size="sm"
            onClick={() => { setZipping(true); zipMut.mutate({ customerId: customer.id }); }}
            disabled={zipping}
            className="h-7 text-xs gap-1 ml-auto border-green-500/30 text-green-400 hover:bg-green-500/10">
            {zipping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            ZIP-Export
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />Lade Dateien...
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <FolderOpen className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            {selectedCategory === 'all'
              ? 'Noch keine Dateien in den Projekten dieses Kunden'
              : `Keine ${FILE_CATEGORIES[selectedCategory]?.label ?? 'Dateien'} vorhanden`}
          </p>
        </div>
      ) : (
        <Accordion
          type="multiple"
          value={openProjects.length > 0 ? openProjects : projectGroupEntries.map(([k]) => k)}
          onValueChange={setOpenProjects}
          className="space-y-2"
        >
          {projectGroupEntries.map(([projectKey, group]) => (
            <AccordionItem key={projectKey} value={projectKey}
              className="border border-border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/20">
                <div className="flex items-center gap-3 text-left">
                  <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium">
                      {group.number ? <span className="text-primary/60 mr-1">#{group.number}</span> : null}
                      {group.title}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">{group.files.length} Datei{group.files.length !== 1 ? 'en' : ''}</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 pt-1">
                <div className="space-y-2">
                  {group.files.map((file: any) => (
                    <AkteFileRow key={`${file.source}-${file.id}`} file={file} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

// ─── Dokumente-Tab für Kundenakte ────────────────────────────────────
const CUST_DOC_TYPE_LABELS: Record<string, string> = {
  offer: 'Angebot', invoice: 'Rechnung', order_confirmation: 'Auftragsbestätigung',
  delivery_note: 'Lieferschein', credit_note: 'Gutschrift', purchase_order: 'Bestellung',
};
const CUST_DOC_TYPE_COLORS: Record<string, string> = {
  offer: 'text-blue-400', invoice: 'text-green-400', order_confirmation: 'text-yellow-400',
  delivery_note: 'text-purple-400', credit_note: 'text-red-400', purchase_order: 'text-orange-400',
};
const CUST_DOC_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf', sent: 'Versendet', paid: 'Bezahlt', cancelled: 'Storniert',
  overdue: 'Überfällig', accepted: 'Angenommen', rejected: 'Abgelehnt',
  partial: 'Teilbezahlt', open: 'Offen', delivered: 'Geliefert',
};
function fmtCustCurrency(v: any) {
  const n = parseFloat(v ?? '0');
  return isNaN(n) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function fmtCustDate(v: any) {
  if (!v) return '—';
  const d = new Date(typeof v === 'number' ? v : v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('de-DE');
}
function CustomerInvoicesTab({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [activeType, setActiveType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { data: docs = [], isLoading } = trpc.invoices.listByCustomer.useQuery({ customerId });
  const types = ['all', 'offer', 'invoice', 'order_confirmation', 'delivery_note', 'credit_note', 'purchase_order'];
  const typeLabels: Record<string, string> = { all: 'Alle', ...CUST_DOC_TYPE_LABELS };
  const filtered = (docs as any[]).filter(d => {
    if (activeType !== 'all' && d.type !== activeType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (d.invoice_number ?? d.invoiceNumber ?? '').toLowerCase().includes(q) ||
        (d.recipient_name ?? d.recipientName ?? '').toLowerCase().includes(q) ||
        (d.recipient_company ?? d.recipientCompany ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });
  const typeCounts = (docs as any[]).reduce((acc: Record<string, number>, d: any) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Suche nach Nummer oder Empfänger…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm bg-secondary border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeType === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {typeLabels[t]}{t !== 'all' && typeCounts[t] ? ` (${typeCounts[t]})` : t === 'all' ? ` (${(docs as any[]).length})` : ''}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" />Lade Dokumente…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <FileText className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">
            {(docs as any[]).length === 0
              ? 'Noch keine Dokumente für diesen Kunden'
              : 'Keine Treffer für diese Filterauswahl'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((doc: any) => {
            const num = doc.invoice_number ?? doc.invoiceNumber ?? `#${doc.id}`;
            const recipient = doc.recipient_company ?? doc.recipientCompany ?? doc.recipient_name ?? doc.recipientName ?? '—';
            const total = doc.total_gross ?? doc.totalGross ?? '0';
            const status = doc.status ?? 'draft';
            const issueDate = doc.issue_date ?? doc.issueDate;
            const color = CUST_DOC_TYPE_COLORS[doc.type] ?? 'text-muted-foreground';
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/40 cursor-pointer transition-all group"
                onClick={() => { onClose(); setLocation(`/invoices/${doc.id}`); }}
              >
                <FileText className={`h-4 w-4 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{num}</span>
                    <span className={`text-xs ${color}`}>{CUST_DOC_TYPE_LABELS[doc.type] ?? doc.type}</span>
                    <span className="text-xs text-muted-foreground">{recipient}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{fmtCustDate(issueDate)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs font-medium">{fmtCustCurrency(total)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{CUST_DOC_STATUS_LABELS[status] ?? status}</span>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Hauptkomponente ────────────────────────────────
export default function Customers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [akteCustomer, setAkteCustomer] = useState<{ id: number; name: string; company?: string | null } | null>(null);
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
    website: (editCustomer as any).website ?? "",
    flags: (editCustomer as any).flags ?? [],
    customerNumber: String((editCustomer as any).customerNumber ?? ""),
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
      website: f.website || undefined,
      flags: f.flags.length > 0 ? f.flags : undefined,
      customerNumber: f.customerNumber ? parseInt(f.customerNumber, 10) : undefined,
    } as any);
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
      website: f.website || undefined,
      flags: f.flags,
      customerNumber: f.customerNumber ? parseInt(f.customerNumber, 10) : undefined,
    } as any);
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
            const flags: string[] = c.flags ?? [];
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

                  {(c as any).website && (
                    <a
                      href={(c as any).website.startsWith('http') ? (c as any).website : `https://${(c as any).website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-blue-400 flex items-center gap-1 w-fit transition-colors"
                    >
                      <Globe className="h-3 w-3" />{(c as any).website.replace(/^https?:\/\//, '')}
                    </a>
                  )}

                  {/* Flags / Hinweise */}
                  {flags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {flags.map(flag => (
                        <span
                          key={flag}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getFlagColor(flag)}`}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">{TYPE_LABELS[customer.type] ?? customer.type}</Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 gap-1"
                      onClick={() => setAkteCustomer({ id: customer.id, name: customer.name, company: (customer as any).company })}
                      title="Kundenakte öffnen"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />Akte
                    </Button>
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

      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />

      <CustomerDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initial={EMPTY_FORM}
        onSave={handleCreate}
        title="Neuen Kunden anlegen"
        isPending={createMutation.isPending}
      />

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

      {akteCustomer && (
        <Dialog open={true} onOpenChange={open => { if (!open) setAkteCustomer(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-blue-400" />
                Kundenakte: {akteCustomer.company || akteCustomer.name}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="akte">
              <TabsList className="w-full">
                <TabsTrigger value="akte" className="flex-1 gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />Dateien &amp; Projekte
                </TabsTrigger>
                <TabsTrigger value="dokumente" className="flex-1 gap-1.5">
                  <Receipt className="h-3.5 w-3.5" />Angebote &amp; Rechnungen
                </TabsTrigger>
              </TabsList>
              <TabsContent value="akte" className="mt-4">
                <CustomerAkte customer={akteCustomer} />
              </TabsContent>
              <TabsContent value="dokumente" className="mt-4">
                <CustomerInvoicesTab customerId={akteCustomer.id} onClose={() => setAkteCustomer(null)} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

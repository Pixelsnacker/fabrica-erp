import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Download, Trash2, MessageCircle, Phone, UserCheck, Mail, MoreHorizontal,
  Zap, Database, Shield, Building2, Upload, X, Loader2, FileText, Table2, Code2, CheckSquare, Square, FolderOpen, FileJson,
  Pencil, Bell
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

type QuickNoteForEdit = { id: number; text: string; source?: string; remindAt?: string | null; remindLabel?: string | null };
const SOURCE_OPTIONS_EDIT = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefon", label: "Telefon" },
  { value: "persoenlich", label: "Persönlich" },
  { value: "email", label: "E-Mail" },
  { value: "sonstiges", label: "Sonstiges" },
];

function EditQuickNoteDialog({ note, onClose }: { note: QuickNoteForEdit | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [text, setText] = useState("");
  const [source, setSource] = useState("sonstiges");
  const [remindAt, setRemindAt] = useState("");
  const [remindLabel, setRemindLabel] = useState("");

  useEffect(() => {
    if (note) {
      setText(note.text);
      setSource(note.source ?? "sonstiges");
      setRemindLabel(note.remindLabel ?? "");
      if (note.remindAt) {
        const d = new Date(note.remindAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        setRemindAt(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } else {
        setRemindAt("");
      }
    }
  }, [note]);

  const updateMutation = trpc.quickNotes.update.useMutation({
    onSuccess: () => { utils.quickNotes.list.invalidate(); toast.success("Notiz aktualisiert"); onClose(); },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  return (
    <Dialog open={!!note} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Schnellnotiz bearbeiten
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Notiztext</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label>Quelle</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS_EDIT.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-yellow-400" /> Erinnerung (optional)
            </Label>
            <input
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {remindAt && (
            <div className="space-y-1.5">
              <Label>Erinnerungstext (optional)</Label>
              <Input placeholder="z.B. Angebot nachfassen" value={remindLabel} onChange={(e) => setRemindLabel(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            onClick={() => note && updateMutation.mutate({ id: note.id, text: text.trim(), source: source as any, remindAt: remindAt ? new Date(remindAt).toISOString() : null, remindLabel: remindLabel.trim() || null })}
            disabled={!text.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SOURCE_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  telefon: Phone,
  persoenlich: UserCheck,
  email: Mail,
  sonstiges: MoreHorizontal,
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telefon: "Telefon",
  persoenlich: "Persönlich",
  email: "E-Mail",
  sonstiges: "Sonstiges",
};

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "bg-green-500/10 text-green-400 border-green-500/20",
  telefon: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  persoenlich: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  email: "bg-orange-500/10 text-orange-400 border-border",
  sonstiges: "bg-muted text-muted-foreground border-border",
};

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"markdown_csv" | "csv_only" | "json">("markdown_csv");
  const [exportSections, setExportSections] = useState<string[]>(["kunden", "projekte", "rechnungen", "wissensdatenbank", "materialien", "lieferanten", "notizen"]);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Company form state
  const [form, setForm] = useState({
    name: "",
    legalForm: "",
    street: "",
    zip: "",
    city: "",
    country: "Deutschland",
    phone: "",
    email: "",
    website: "",
    taxNumber: "",
    vatId: "",
    iban: "",
    bic: "",
    bankName: "",
    invoiceFooter: "",
    // 4-spaltige Fußzeile
    footerCol1: "",
    footerCol2: "",
    footerCol3: "",
    footerCol4: "",
    kleinunternehmer: false,
    // Nummernkreis
    offerPrefix: "AN",
    invoicePrefix: "RE",
    creditNotePrefix: "GS",
    numberSeparator: "-",
    numberPadding: 4,
    includeYear: true,
    // Startnummern (Migration von Sevdesk etc.)
    offerStartNumber: 1,
    invoiceStartNumber: 1,
    creditNoteStartNumber: 1,
    // AGB
    agbText: "",
    // SMTP
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    smtpSecure: false,
    emailSignature: "",
  });

  const { data: companyData, isLoading: isLoadingCompany } = trpc.companySettings.get.useQuery();
  const { data: quickNotesList, isLoading } = trpc.quickNotes.list.useQuery();
  const [editNote, setEditNote] = useState<QuickNoteForEdit | null>(null);
  const utils = trpc.useUtils();

  const updateCompany = trpc.companySettings.update.useMutation({
    onSuccess: () => {
      toast.success("Firmendaten gespeichert");
      utils.companySettings.get.invalidate();
      setIsSaving(false);
    },
    onError: () => {
      toast.error("Fehler beim Speichern");
      setIsSaving(false);
    },
  });

  const uploadLogo = trpc.companySettings.uploadLogo.useMutation({
    onSuccess: (data) => {
      toast.success("Logo hochgeladen");
      setLogoPreview(data.url);
      utils.companySettings.get.invalidate();
    },
    onError: () => toast.error("Fehler beim Logo-Upload"),
  });

  const deleteNote = trpc.quickNotes.delete.useMutation({
    onSuccess: () => {
      toast.success("Notiz gelöscht");
      utils.quickNotes.list.invalidate();
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  // Populate form when data loads
  useEffect(() => {
    if (companyData) {
      setForm({
        name: companyData.name ?? "",
        legalForm: companyData.legalForm ?? "",
        street: companyData.street ?? "",
        zip: companyData.zip ?? "",
        city: companyData.city ?? "",
        country: companyData.country ?? "Deutschland",
        phone: companyData.phone ?? "",
        email: companyData.email ?? "",
        website: companyData.website ?? "",
        taxNumber: companyData.taxNumber ?? "",
        vatId: companyData.vatId ?? "",
        iban: companyData.iban ?? "",
        bic: companyData.bic ?? "",
        bankName: companyData.bankName ?? "",
        invoiceFooter: companyData.invoiceFooter ?? "",
        footerCol1: (companyData as any).footerCol1 ?? "",
        footerCol2: (companyData as any).footerCol2 ?? "",
        footerCol3: (companyData as any).footerCol3 ?? "",
        footerCol4: (companyData as any).footerCol4 ?? "",
        kleinunternehmer: Boolean(companyData.kleinunternehmer),
        offerPrefix: companyData.offerPrefix ?? "AN",
        invoicePrefix: companyData.invoicePrefix ?? "RE",
        creditNotePrefix: companyData.creditNotePrefix ?? "GS",
        numberSeparator: companyData.numberSeparator ?? "-",
        numberPadding: companyData.numberPadding ?? 4,
        includeYear: (companyData.includeYear ?? 1) === 1,
        offerStartNumber: (companyData as any).offerStartNumber ?? 1,
        invoiceStartNumber: (companyData as any).invoiceStartNumber ?? 1,
        creditNoteStartNumber: (companyData as any).creditNoteStartNumber ?? 1,
        agbText: (companyData as any).agbText ?? "",
        smtpHost: (companyData as any).smtpHost ?? "",
        smtpPort: (companyData as any).smtpPort ?? 587,
        smtpUser: (companyData as any).smtpUser ?? "",
        smtpPass: (companyData as any).smtpPass ?? "",
        smtpFrom: (companyData as any).smtpFrom ?? "",
        smtpSecure: Boolean((companyData as any).smtpSecure),
        emailSignature: (companyData as any).emailSignature ?? "",
      });
      if (companyData.logoUrl) setLogoPreview(companyData.logoUrl);
    }
  }, [companyData]);

  const handleSaveCompany = () => {
    setIsSaving(true);
    updateCompany.mutate({
      ...form,
      numberPadding: Number(form.numberPadding),
    });
  };

  // Live-Vorschau der Nummern
  const previewOffer = (() => {
    const sep = form.numberSeparator || '-';
    const pad = Math.max(1, Math.min(8, Number(form.numberPadding) || 4));
    const year = new Date().getFullYear();
    const num = '1'.padStart(pad, '0');
    return form.includeYear ? `${form.offerPrefix}${sep}${year}${sep}${num}` : `${form.offerPrefix}${sep}${num}`;
  })();
  const previewInvoice = (() => {
    const sep = form.numberSeparator || '-';
    const pad = Math.max(1, Math.min(8, Number(form.numberPadding) || 4));
    const year = new Date().getFullYear();
    const num = '1'.padStart(pad, '0');
    return form.includeYear ? `${form.invoicePrefix}${sep}${year}${sep}${num}` : `${form.invoicePrefix}${sep}${num}`;
  })();
  const previewCredit = (() => {
    const sep = form.numberSeparator || '-';
    const pad = Math.max(1, Math.min(8, Number(form.numberPadding) || 4));
    const year = new Date().getFullYear();
    const num = '1'.padStart(pad, '0');
    return form.includeYear ? `${form.creditNotePrefix}${sep}${year}${sep}${num}` : `${form.creditNotePrefix}${sep}${num}`;
  })();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo darf maximal 2 MB groß sein");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogo.mutate({ base64, mimeType: file.type, filename: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
    if (exportSections.length === 0) {
      toast.error("Bitte mindestens einen Bereich auswählen");
      return;
    }
    setIsExporting(true);
    setExportProgress("Daten werden zusammengestellt...");
    try {
      const params = new URLSearchParams({
        format: exportFormat,
        sections: exportSections.join(","),
      });
      setExportProgress("ZIP wird erstellt...");
      const response = await fetch(`/api/export/zip?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Export fehlgeschlagen");
      setExportProgress("Download startet...");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fabrica-erp-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export erfolgreich heruntergeladen");
    } catch {
      toast.error("Fehler beim Export");
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const ALL_SECTIONS = [
    { key: "kunden", label: "Kunden", icon: "👥" },
    { key: "projekte", label: "Projekte", icon: "📁" },
    { key: "rechnungen", label: "Angebote & Rechnungen", icon: "📄" },
    { key: "wissensdatenbank", label: "Wissensdatenbank", icon: "📚" },
    { key: "materialien", label: "Materialien", icon: "🧱" },
    { key: "lieferanten", label: "Lieferanten", icon: "🏭" },
    { key: "notizen", label: "Notizen", icon: "📝" },
  ];

  const toggleSection = (key: string) => {
    setExportSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Firmendaten, Datensicherung und Schnellnotizen</p>
        </div>

        <Tabs defaultValue="company">
          <TabsList className="w-full">
            <TabsTrigger value="company" className="flex-1">
              <Building2 className="h-4 w-4 mr-2" />
              Firmendaten
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex-1">
              <Shield className="h-4 w-4 mr-2" />
              Datensicherung
            </TabsTrigger>
            <TabsTrigger value="quicknotes" className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              Schnellnotizen
            </TabsTrigger>
          </TabsList>

          {/* ─── Firmendaten Tab ─── */}
          <TabsContent value="company" className="space-y-4 mt-4">
            {isLoadingCompany ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Logo */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Firmenlogo</CardTitle>
                    <CardDescription>Wird auf Angeboten und Rechnungen angezeigt (max. 2 MB, PNG/JPG)</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img src={logoPreview} alt="Logo" className="h-20 w-auto max-w-[200px] object-contain rounded border bg-white p-2" />
                        <button
                          onClick={() => { setLogoPreview(null); updateCompany.mutate({ ...form }); }}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="h-20 w-40 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground text-sm">
                        Kein Logo
                      </div>
                    )}
                    <div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadLogo.isPending}>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadLogo.isPending ? "Hochladen..." : "Logo hochladen"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Stammdaten */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Stammdaten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Firmenname *</Label>
                        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Fabrica GmbH" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Rechtsform</Label>
                        <Input value={form.legalForm} onChange={e => setForm(f => ({ ...f, legalForm: e.target.value }))} placeholder="GmbH, UG, Einzelunternehmen..." />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Straße und Hausnummer</Label>
                      <Input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="Musterstraße 1" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>PLZ</Label>
                        <Input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} placeholder="50170" />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label>Ort</Label>
                        <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Kerpen" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Land</Label>
                        <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Telefon</Label>
                        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+49 2273 9529429" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>E-Mail</Label>
                        <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="info@fabrica3d.eu" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Website</Label>
                        <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="www.fabrica3d.de" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Steuer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Steuer & Umsatzsteuer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div>
                        <p className="font-medium text-sm">Kleinunternehmerregelung (§19 UStG)</p>
                        <p className="text-xs text-muted-foreground">Keine Umsatzsteuer auf Rechnungen ausweisen</p>
                      </div>
                      <Switch
                        checked={form.kleinunternehmer}
                        onCheckedChange={v => setForm(f => ({ ...f, kleinunternehmer: v }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Steuernummer</Label>
                        <Input value={form.taxNumber} onChange={e => setForm(f => ({ ...f, taxNumber: e.target.value }))} placeholder="123/456/78901" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>USt-IdNr.</Label>
                        <Input value={form.vatId} onChange={e => setForm(f => ({ ...f, vatId: e.target.value }))} placeholder="DE123456789" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Bankdaten */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Bankverbindung</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>Bank</Label>
                      <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="Sparkasse Köln Bonn" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>IBAN</Label>
                        <Input value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="DE89 3704 0044 0532 0130 00" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>BIC</Label>
                        <Input value={form.bic} onChange={e => setForm(f => ({ ...f, bic: e.target.value }))} placeholder="COBADEFFXXX" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Nummernkreis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Nummernkreis</CardTitle>
                    <CardDescription>Präfix, Trennzeichen und Format für Angebots-, Rechnungs- und Gutschriftnummern</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Präfixe */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Angebots-Präfix</Label>
                        <Input value={form.offerPrefix} onChange={e => setForm(f => ({ ...f, offerPrefix: e.target.value }))} placeholder="AN" maxLength={20} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Rechnungs-Präfix</Label>
                        <Input value={form.invoicePrefix} onChange={e => setForm(f => ({ ...f, invoicePrefix: e.target.value }))} placeholder="RE" maxLength={20} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gutschrift-Präfix</Label>
                        <Input value={form.creditNotePrefix} onChange={e => setForm(f => ({ ...f, creditNotePrefix: e.target.value }))} placeholder="GS" maxLength={20} />
                      </div>
                    </div>
                    {/* Format */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Trennzeichen</Label>
                        <Input value={form.numberSeparator} onChange={e => setForm(f => ({ ...f, numberSeparator: e.target.value }))} placeholder="-" maxLength={5} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Stellen (Nullen)</Label>
                        <Input type="number" min={1} max={8} value={form.numberPadding} onChange={e => setForm(f => ({ ...f, numberPadding: parseInt(e.target.value) || 4 }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block mb-2">Jahreszahl einbeziehen</Label>
                        <div className="flex items-center gap-2 pt-1">
                          <Switch checked={form.includeYear} onCheckedChange={v => setForm(f => ({ ...f, includeYear: v }))} />
                          <span className="text-sm text-muted-foreground">{form.includeYear ? 'Ja' : 'Nein'}</span>
                        </div>
                      </div>
                    </div>
                    {/* Vorschau */}
                    <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vorschau nächste Nummern</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Angebot</p>
                          <Badge variant="outline" className="font-mono text-sm px-3 py-1">{previewOffer}</Badge>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Rechnung</p>
                          <Badge variant="outline" className="font-mono text-sm px-3 py-1">{previewInvoice}</Badge>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Gutschrift</p>
                          <Badge variant="outline" className="font-mono text-sm px-3 py-1">{previewCredit}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Startnummern */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Startnummern (Migration)</CardTitle>
                    <CardDescription>Trage hier die letzte Nummer aus deinem bisherigen System ein (z.B. Sevdesk), damit die Nummerierung nahtlos weiterläuft. Wird nur beim ersten Dokument des laufenden Jahres berücksichtigt.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Angebot Startnummer</Label>
                        <Input type="number" min={1} value={form.offerStartNumber} onChange={e => setForm(f => ({ ...f, offerStartNumber: parseInt(e.target.value) || 1 }))} placeholder="z.B. 42" />
                        <p className="text-xs text-muted-foreground">Nächstes Angebot: {form.offerPrefix}{form.numberSeparator}{form.includeYear ? new Date().getFullYear() + form.numberSeparator : ""}{String(form.offerStartNumber).padStart(form.numberPadding, "0")}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Rechnung Startnummer</Label>
                        <Input type="number" min={1} value={form.invoiceStartNumber} onChange={e => setForm(f => ({ ...f, invoiceStartNumber: parseInt(e.target.value) || 1 }))} placeholder="z.B. 128" />
                        <p className="text-xs text-muted-foreground">Nächste Rechnung: {form.invoicePrefix}{form.numberSeparator}{form.includeYear ? new Date().getFullYear() + form.numberSeparator : ""}{String(form.invoiceStartNumber).padStart(form.numberPadding, "0")}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gutschrift Startnummer</Label>
                        <Input type="number" min={1} value={form.creditNoteStartNumber} onChange={e => setForm(f => ({ ...f, creditNoteStartNumber: parseInt(e.target.value) || 1 }))} placeholder="z.B. 5" />
                        <p className="text-xs text-muted-foreground">Nächste Gutschrift: {form.creditNotePrefix}{form.numberSeparator}{form.includeYear ? new Date().getFullYear() + form.numberSeparator : ""}{String(form.creditNoteStartNumber).padStart(form.numberPadding, "0")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Rechnungsfußzeile 4-spaltig */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Rechnungsfußzeile</CardTitle>
                    <CardDescription>Wird am Ende jeder Rechnung und jedes Angebots als 4-spaltiger Footer angezeigt (wie auf professionellen Geschäftsbriefen)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Spalte 1 — Firmenadresse</Label>
                        <Textarea
                          value={form.footerCol1}
                          onChange={e => setForm(f => ({ ...f, footerCol1: e.target.value }))}
                          placeholder={`Fabrica GmbH\nHüttenstraße 205\n50170 Kerpen\nDeutschland`}
                          rows={4}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Spalte 2 — Kontakt</Label>
                        <Textarea
                          value={form.footerCol2}
                          onChange={e => setForm(f => ({ ...f, footerCol2: e.target.value }))}
                          placeholder={`Tel. 02273-9529429\nFax. 0221790760092\nE-Mail kontakt@fabrica3d.eu\nWeb www.fabrica3d.de`}
                          rows={4}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Spalte 3 — Rechtliches</Label>
                        <Textarea
                          value={form.footerCol3}
                          onChange={e => setForm(f => ({ ...f, footerCol3: e.target.value }))}
                          placeholder={`Amtsgericht Köln\nHR-Nr. 81094\nUSt.-ID DE295059929\nSteuer-Nr. 203/5741/0780\nGeschäftsführung Daniel Rincon`}
                          rows={4}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Spalte 4 — Bankverbindung</Label>
                        <Textarea
                          value={form.footerCol4}
                          onChange={e => setForm(f => ({ ...f, footerCol4: e.target.value }))}
                          placeholder={`Bank Kreissparkasse Köln\nIBAN DE40 3705 0299 0000 4241 65\nBIC COKSDE33XXX`}
                          rows={4}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                    {/* Vorschau */}
                    {(form.footerCol1 || form.footerCol2 || form.footerCol3 || form.footerCol4) && (
                      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vorschau Fußzeile</p>
                        <div className="grid grid-cols-4 gap-4 text-xs text-muted-foreground">
                          {[form.footerCol1, form.footerCol2, form.footerCol3, form.footerCol4].map((col, i) => (
                            <div key={i} className="space-y-0.5">
                              {(col || "").split("\n").map((line, j) => (
                                <p key={j}>{line}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AGB */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Allgemeine Geschäftsbedingungen (AGB)</CardTitle>
                    <CardDescription>Wird automatisch als zweite Seite an Angebots-PDFs angehängt. Leer lassen = kein AGB-Anhang.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={form.agbText}
                      onChange={e => setForm(f => ({ ...f, agbText: e.target.value }))}
                      placeholder="§1 Geltungsbereich&#10;§2 Vertragsschluss&#10;..."
                      rows={12}
                      className="font-mono text-xs resize-y"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {form.agbText ? `${form.agbText.length} Zeichen — AGB wird beim PDF-Druck als Seite 2 angehängt` : 'Kein AGB-Text hinterlegt'}
                    </p>
                  </CardContent>
                </Card>

                {/* SMTP E-Mail-Einstellungen */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">E-Mail-Versand (SMTP)</CardTitle>
                    <CardDescription>SMTP-Zugangsdaten für den direkten E-Mail-Versand von Angeboten aus dem System.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>SMTP-Server (Host)</Label>
                        <Input value={form.smtpHost} onChange={e => setForm(f => ({ ...f, smtpHost: e.target.value }))} placeholder="mail.fabrica3d.eu" />
                      </div>
                      <div>
                        <Label>Port</Label>
                        <Input type="number" value={form.smtpPort} onChange={e => setForm(f => ({ ...f, smtpPort: Number(e.target.value) }))} placeholder="587" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Benutzername / E-Mail</Label>
                        <Input value={form.smtpUser} onChange={e => setForm(f => ({ ...f, smtpUser: e.target.value }))} placeholder="d.rincon@fabrica3d.eu" />
                      </div>
                      <div>
                        <Label>Passwort</Label>
                        <Input type="password" value={form.smtpPass} onChange={e => setForm(f => ({ ...f, smtpPass: e.target.value }))} placeholder="••••••••" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Absender-Adresse (Von)</Label>
                        <Input value={form.smtpFrom} onChange={e => setForm(f => ({ ...f, smtpFrom: e.target.value }))} placeholder="Fabrica GmbH &lt;d.rincon@fabrica3d.eu&gt;" />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <Switch checked={form.smtpSecure} onCheckedChange={v => setForm(f => ({ ...f, smtpSecure: v }))} />
                        <Label>SSL/TLS (Port 465)</Label>
                      </div>
                    </div>
                    <div>
                      <Label>E-Mail-Signatur</Label>
                      <Textarea
                        value={form.emailSignature}
                        onChange={e => setForm(f => ({ ...f, emailSignature: e.target.value }))}
                        placeholder="Mit freundlichen Grüßen&#10;Daniel Rincón&#10;Fabrica GmbH..."
                        rows={6}
                        className="font-mono text-xs resize-y"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Wird automatisch an jede versendete Angebots-E-Mail angehängt.</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button onClick={handleSaveCompany} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSaving ? "Speichern..." : "Firmendaten speichern"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* ─── Datensicherung Tab ─── */}
          <TabsContent value="backup" className="mt-4 space-y-4">
            {/* Format-Auswahl */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exportformat</CardTitle>
                <CardDescription>Wähle das Format für die Datensicherung</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setExportFormat("markdown_csv")}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border-2 text-left transition-colors ${
                      exportFormat === "markdown_csv"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium text-sm">Markdown + CSV</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Jeder Datensatz als eigene .md Datei, plus CSV-Übersichten. Ideal für Notion-Import.</p>
                  </button>
                  <button
                    onClick={() => setExportFormat("csv_only")}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border-2 text-left transition-colors ${
                      exportFormat === "csv_only"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Table2 className="h-5 w-5 text-green-400" />
                      <span className="font-medium text-sm">Nur CSV</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Nur Übersichts-CSV pro Bereich. Ideal für Excel oder Google Sheets.</p>
                  </button>
                  <button
                    onClick={() => setExportFormat("json")}
                    className={`flex flex-col items-start gap-2 p-4 rounded-lg border-2 text-left transition-colors ${
                      exportFormat === "json"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileJson className="h-5 w-5 text-orange-400" />
                      <span className="font-medium text-sm">JSON (Rohdaten)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Vollständige Rohdaten als JSON. Ideal für technische Sicherung und Wiederherstellung.</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Bereiche-Auswahl */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Bereiche einschließen</CardTitle>
                    <CardDescription>Wähle welche Datenbereiche exportiert werden sollen</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExportSections(ALL_SECTIONS.map(s => s.key))}>Alle</Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExportSections([])}>Keine</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_SECTIONS.map(section => {
                    const isSelected = exportSections.includes(section.key);
                    return (
                      <button
                        key={section.key}
                        onClick={() => toggleSection(section.key)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? "border-primary/50 bg-primary/5"
                            : "border-border hover:bg-muted/30"
                        }`}
                      >
                        {isSelected
                          ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          : <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        }
                        <span className="text-sm">{section.icon} {section.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Export-Button */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <FolderOpen className="h-8 w-8 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">ZIP-Datei herunterladen</p>
                      <p className="text-sm text-muted-foreground">
                        {exportSections.length === 0
                          ? "Keine Bereiche ausgewählt"
                          : `${exportSections.length} Bereich${exportSections.length !== 1 ? "e" : ""} • Format: ${
                              exportFormat === "markdown_csv" ? "Markdown + CSV" :
                              exportFormat === "csv_only" ? "Nur CSV" : "JSON"
                            }`
                        }
                      </p>
                      {isExporting && exportProgress && (
                        <p className="text-xs text-primary mt-1 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {exportProgress}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleExport}
                    disabled={isExporting || exportSections.length === 0}
                    className="gap-2 shrink-0"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? "Exportiere..." : "Jetzt exportieren"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4 border-t pt-3">
                  Empfehlung: Einmal pro Woche exportieren und in Google Drive oder einem lokalen Ordner sichern.
                  Der Code ist zusätzlich über den GitHub-Export in den Manus-Einstellungen sicherbar.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Schnellnotizen Tab ─── */}
          <TabsContent value="quicknotes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  Schnellnotizen
                </CardTitle>
                <CardDescription>
                  Alle gespeicherten Schnellnotizen aus WhatsApp, Telefon und persönlichen Gesprächen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Lade Notizen...</div>
                ) : !quickNotesList || quickNotesList.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground">Noch keine Schnellnotizen vorhanden.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {quickNotesList.map((note: any) => {
                      const SourceIcon = SOURCE_ICONS[note.source] ?? MoreHorizontal;
                      return (
                        <div key={note.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group">
                          <SourceIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-relaxed">{note.text}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${SOURCE_COLORS[note.source] ?? "bg-muted text-muted-foreground border-border"}`}>
                                {SOURCE_LABELS[note.source] ?? note.source}
                              </span>
                              {note.projectId && <span className="text-xs text-muted-foreground">Projekt #{note.projectId}</span>}
                              <span className="text-xs text-muted-foreground">
                                {new Date(note.createdAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {note.remindAt && (
                              <span className="text-xs text-yellow-400 flex items-center gap-0.5 mr-1">
                                <Bell className="h-3 w-3" />
                                {new Date(note.remindAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setEditNote(note)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteNote.mutate({ id: note.id })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <EditQuickNoteDialog note={editNote} onClose={() => setEditNote(null)} />
      </div>
    </DashboardLayout>
  );
}

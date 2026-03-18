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
  Download, Trash2,
  Database, Shield, Building2, Upload, X, Loader2, FileText, Table2, Code2, CheckSquare, Square, FolderOpen, FileJson, RefreshCw, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";


export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"markdown_csv" | "csv_only" | "json">("markdown_csv");
  const [exportSections, setExportSections] = useState<string[]>(["kunden", "projekte", "rechnungen", "wissensdatenbank", "materialien", "lieferanten", "notizen"]);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ movedCount: number; errorCount: number; errors: string[] } | null>(null);
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
    customerStartNumber: 10000,
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
        customerStartNumber: (companyData as any).customerStartNumber ?? 10000,
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

  const migrateMut = trpc.customerFiles.migrateToProjectFolders.useMutation({
    onSuccess: (result) => {
      setIsMigrating(false);
      setMigrationResult(result);
      if (result.errorCount === 0) {
        toast.success(`Migration abgeschlossen: ${result.movedCount} Datei${result.movedCount !== 1 ? 'en' : ''} verschoben`);
      } else {
        toast.warning(`Migration: ${result.movedCount} verschoben, ${result.errorCount} Fehler`);
      }
    },
    onError: (e: any) => {
      setIsMigrating(false);
      toast.error('Migrationsfehler: ' + e.message);
    },
  });

  const handleMigrate = () => {
    setIsMigrating(true);
    setMigrationResult(null);
    migrateMut.mutate();
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
          <p className="text-muted-foreground mt-1">Firmendaten und Datensicherung</p>
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

                    {/* Kundennummer + Anfrage */}
                    <div className="pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Kundennummer Startnummer</Label>
                        <Input type="number" min={1} value={form.customerStartNumber} onChange={e => setForm(f => ({ ...f, customerStartNumber: parseInt(e.target.value) || 10000 }))} placeholder="z.B. 10000" />
                        <p className="text-xs text-muted-foreground">Neuer Kunde bekommt mindestens Kundennummer {form.customerStartNumber}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Lieferantenanfrage Startnummer</Label>
                        <Input type="number" min={1} value={(form as any).inquiryStartNumber ?? 1} onChange={e => setForm(f => ({ ...f, inquiryStartNumber: parseInt(e.target.value) || 1 }))} placeholder="z.B. 1" />
                        <p className="text-xs text-muted-foreground">Nächste Anfrage: ANF-{new Date().getFullYear()}-{String((form as any).inquiryStartNumber ?? 1).padStart(4, "0")}</p>
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

            {/* Google Drive Migration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                  Google Drive – Ordnerstruktur migrieren
                </CardTitle>
                <CardDescription>
                  Verschiebt bereits hochgeladene Dateien aus dem Kunden-Root-Ordner in die richtigen Projekt-Unterordner.
                  Neue Struktur: <code className="text-xs bg-muted px-1 rounded">Fabrica ERP / Kunden / [Kunde] / [Projekt] / Datei</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    {migrationResult && (
                      <div className={`flex items-start gap-2 p-3 rounded-lg text-sm mb-3 ${
                        migrationResult.errorCount === 0
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {migrationResult.errorCount === 0
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                          : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-medium">
                            {migrationResult.movedCount} Datei{migrationResult.movedCount !== 1 ? 'en' : ''} erfolgreich verschoben
                            {migrationResult.errorCount > 0 ? `, ${migrationResult.errorCount} Fehler` : ''}
                          </p>
                          {migrationResult.errors.length > 0 && (
                            <ul className="mt-1 text-xs space-y-0.5 opacity-80">
                              {migrationResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                              {migrationResult.errors.length > 5 && <li>... und {migrationResult.errors.length - 5} weitere</li>}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Nur einmalig nötig. Dateien die bereits in Projektordnern liegen werden nicht doppelt verschoben.
                    </p>
                  </div>
                  <Button
                    onClick={handleMigrate}
                    disabled={isMigrating}
                    variant="outline"
                    className="gap-2 shrink-0"
                  >
                    {isMigrating
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <RefreshCw className="h-4 w-4" />}
                    {isMigrating ? 'Migriere...' : 'Migration starten'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

      </div>
    </DashboardLayout>
  );
}

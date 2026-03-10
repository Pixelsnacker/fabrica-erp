import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, BookOpen, Trash2, FileText, Loader2, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  material: "Material",
  surface_treatment: "Oberflächenbehandlung",
  process: "Verfahren",
  supplier_info: "Lieferanteninfo",
  project_type: "Projekttyp",
  pricing: "Kalkulation",
  general: "Allgemein",
};

// Simple Markdown renderer for the datasheet preview
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold mt-3 mb-1 text-primary">{line.slice(3)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
        if (line.startsWith("| ")) {
          const cells = line.split("|").filter(c => c.trim() !== "").map(c => c.trim());
          const isSeparator = cells.every(c => /^[-:]+$/.test(c));
          if (isSeparator) return null;
          return (
            <div key={i} className="flex gap-2 border-b border-border py-1">
              {cells.map((cell, j) => (
                <span key={j} className={`flex-1 text-xs ${j === 0 ? "font-medium" : "text-muted-foreground"}`}>{cell}</span>
              ))}
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        // Inline bold
        const boldParts = line.split(/\*\*(.*?)\*\*/g);
        if (boldParts.length > 1) {
          return (
            <p key={i}>
              {boldParts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
            </p>
          );
        }
        return <p key={i} className="text-muted-foreground">{line}</p>;
      })}
    </div>
  );
}

export default function KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "material", tags: "" });

  // Datasheet generator state
  const [showDatasheet, setShowDatasheet] = useState(false);
  const [dsForm, setDsForm] = useState({
    topic: "",
    audience: "customer" as "customer" | "internal" | "supplier",
    language: "de" as "de" | "en",
    detail: "standard" as "brief" | "standard" | "detailed",
    customerName: "",
    projectName: "",
    selectedEntryIds: [] as number[],
  });
  const [generatedText, setGeneratedText] = useState("");
  const [showEntrySelector, setShowEntrySelector] = useState(false);

  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.knowledge.list.useQuery(
    { search: categoryFilter !== "all" ? categoryFilter : undefined }
  );
  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate();
      setShowCreate(false);
      setForm({ title: "", content: "", category: "material", tags: "" });
      toast.success("Eintrag gespeichert");
    },
  });
  const deleteMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); toast.success("Eintrag gelöscht"); },
  });
  const generateMutation = trpc.knowledge.generateDatasheet.useMutation({
    onSuccess: (data) => {
      setGeneratedText(data.text);
      toast.success(`Datenblatt generiert — ${data.usedEntries.length} Wissenseinträge verwendet`);
    },
    onError: () => toast.error("Fehler bei der Generierung"),
  });

  const filtered = entries.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.content.toLowerCase().includes(search.toLowerCase())
  );

  const toggleEntry = (id: number) => {
    setDsForm(f => ({
      ...f,
      selectedEntryIds: f.selectedEntryIds.includes(id)
        ? f.selectedEntryIds.filter(x => x !== id)
        : [...f.selectedEntryIds, id],
    }));
  };

  const handleGenerate = () => {
    if (!dsForm.topic.trim()) { toast.error("Bitte ein Thema eingeben"); return; }
    setGeneratedText("");
    generateMutation.mutate(dsForm);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Datenblatt – ${dsForm.topic}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 2cm; color: #000; }
        h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
        h2 { font-size: 14pt; color: #333; margin-top: 20px; }
        h3 { font-size: 12pt; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
        li { margin-bottom: 4px; }
        @media print { body { margin: 1.5cm; } }
      </style></head><body>
      <div id="content"></div>
      <script>
        document.getElementById('content').innerHTML = ${JSON.stringify(
          generatedText
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[hul])/gm, '')
        )};
        window.print();
      </script></body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wissensdatenbank</h1>
          <p className="text-muted-foreground text-sm mt-1">Ihr gesammeltes Fachwissen — Grundlage für den KI-Assistenten</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowDatasheet(true); setGeneratedText(""); }} className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Datenblatt generieren</span>
            <span className="sm:hidden">Datenblatt</span>
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Neuer Eintrag</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Wissen suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Einträge...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <BookOpen className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Noch keine Wissenseinträge</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Tragen Sie Ihr Fachwissen ein — Materialien, Verfahren, Oberflächen. Der KI-Assistent nutzt diese Daten für Beratungsempfehlungen und Datenblätter.
          </p>
          <Button onClick={() => setShowCreate(true)}>Ersten Eintrag anlegen</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(entry => (
            <div key={entry.id} className="p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{entry.title}</div>
                  <Badge variant="secondary" className="text-xs mt-1">{CATEGORY_LABELS[entry.category] ?? entry.category}</Badge>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost" size="sm" className="text-primary hover:text-primary"
                    onClick={() => { setDsForm(f => ({ ...f, topic: entry.title, selectedEntryIds: [entry.id] })); setGeneratedText(""); setShowDatasheet(true); }}
                    title="Datenblatt aus diesem Eintrag generieren"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate({ id: entry.id })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-4 whitespace-pre-wrap">{entry.content}</p>
              {Boolean(entry.tags && Array.isArray(entry.tags) && (entry.tags as unknown[]).length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(entry.tags as unknown[]).map((tag, i) => <Badge key={i} variant="outline" className="text-xs">{String(tag)}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Neuer Eintrag Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neuen Wissenseintrag anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Titel *</Label>
              <Input placeholder="z.B. Harteloxal auf AL 7075" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Inhalt *</Label>
              <Textarea placeholder="Eigenschaften, Einsatzgebiete, Erfahrungen, Empfehlungen..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (kommagetrennt)</Label>
              <Input placeholder="Aluminium, Außenbereich, Museum" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: form.title, content: form.content, category: form.category as any,
                tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined,
              })}
              disabled={!form.title || !form.content || createMutation.isPending}
            >
              {createMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Datenblatt-Generator Dialog ── */}
      <Dialog open={showDatasheet} onOpenChange={setShowDatasheet}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              KI-Datenblatt generieren
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Configuration */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Thema / Titel des Datenblatts *</Label>
                <Input
                  placeholder="z.B. FDM-Druck mit PETG, CNC-Fräsen AL7075..."
                  value={dsForm.topic}
                  onChange={e => setDsForm(f => ({ ...f, topic: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Zielgruppe</Label>
                  <Select value={dsForm.audience} onValueChange={v => setDsForm(f => ({ ...f, audience: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Kunde (B2B)</SelectItem>
                      <SelectItem value="internal">Intern</SelectItem>
                      <SelectItem value="supplier">Lieferant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sprache</Label>
                  <Select value={dsForm.language} onValueChange={v => setDsForm(f => ({ ...f, language: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Detailtiefe</Label>
                <Select value={dsForm.detail} onValueChange={v => setDsForm(f => ({ ...f, detail: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Kurz (max. 300 Wörter)</SelectItem>
                    <SelectItem value="standard">Standard (400–700 Wörter)</SelectItem>
                    <SelectItem value="detailed">Detailliert (700–1200 Wörter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kundenname (optional)</Label>
                  <Input placeholder="Keck GmbH" value={dsForm.customerName} onChange={e => setDsForm(f => ({ ...f, customerName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Projektname (optional)</Label>
                  <Input placeholder="KZ Testmodell" value={dsForm.projectName} onChange={e => setDsForm(f => ({ ...f, projectName: e.target.value }))} />
                </div>
              </div>

              {/* Entry selector */}
              {entries.length > 0 && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowEntrySelector(s => !s)}
                  >
                    {showEntrySelector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Wissenseinträge auswählen
                    {dsForm.selectedEntryIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{dsForm.selectedEntryIds.length} ausgewählt</Badge>
                    )}
                  </button>
                  {showEntrySelector && (
                    <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      <p className="text-xs text-muted-foreground">Leer lassen = KI wählt automatisch passende Einträge</p>
                      {entries.map(e => (
                        <div key={e.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`entry-${e.id}`}
                            checked={dsForm.selectedEntryIds.includes(e.id)}
                            onCheckedChange={() => toggleEntry(e.id)}
                          />
                          <label htmlFor={`entry-${e.id}`} className="text-sm cursor-pointer flex-1 min-w-0">
                            <span className="font-medium">{e.title}</span>
                            <Badge variant="outline" className="text-xs ml-2">{CATEGORY_LABELS[e.category] ?? e.category}</Badge>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!dsForm.topic.trim() || generateMutation.isPending}
                className="w-full gap-2"
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generiere Datenblatt...</>
                ) : (
                  <><FileText className="h-4 w-4" />Datenblatt generieren</>
                )}
              </Button>
            </div>

            {/* Right: Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vorschau</Label>
                {generatedText && (
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" />
                    Als PDF drucken
                  </Button>
                )}
              </div>
              <div className="border border-border rounded-lg p-4 min-h-64 max-h-[50vh] overflow-y-auto bg-muted/20">
                {generateMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">KI erstellt Datenblatt aus Ihrer Wissensdatenbank...</p>
                  </div>
                ) : generatedText ? (
                  <MarkdownPreview content={generatedText} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Hier erscheint das generierte Datenblatt</p>
                    <p className="text-xs text-center max-w-xs">Thema eingeben und auf "Datenblatt generieren" klicken</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDatasheet(false)}>Schließen</Button>
            {generatedText && (
              <Button onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Als PDF drucken / speichern
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

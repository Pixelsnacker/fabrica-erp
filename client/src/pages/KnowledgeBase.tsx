import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  material: "Material", process: "Verfahren", surface: "Oberfläche",
  supplier_info: "Lieferanteninfo", pricing: "Kalkulation", other: "Sonstige",
};

export default function KnowledgeBase() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", category: "material", tags: "" });
  const utils = trpc.useUtils();
  const { data: entries = [], isLoading } = trpc.knowledge.list.useQuery({ search: categoryFilter !== "all" ? categoryFilter : undefined });
  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); setShowCreate(false); setForm({ title: "", content: "", category: "material", tags: "" }); toast.success("Eintrag gespeichert"); },
  });
  const deleteMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => { utils.knowledge.list.invalidate(); toast.success("Eintrag gelöscht"); },
  });

  const filtered = entries.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Wissensdatenbank</h1>
          <p className="text-muted-foreground text-sm mt-1">Ihr gesammeltes Fachwissen — Grundlage für den KI-Assistenten</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Neuer Eintrag</Button>
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

      {isLoading ? <div className="text-muted-foreground text-sm">Lade Einträge...</div> : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <BookOpen className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Noch keine Wissenseinträge</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">Tragen Sie Ihr Fachwissen ein — Materialien, Verfahren, Oberflächen. Der KI-Assistent nutzt diese Daten für Beratungsempfehlungen.</p>
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
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMutation.mutate({ id: entry.id })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-4 whitespace-pre-wrap">{entry.content}</p>
              {entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(entry.tags as string[]).map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Neuen Wissenseintrag anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titel *</Label><Input placeholder="z.B. Harteloxal auf AL 7075" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Inhalt *</Label><Textarea placeholder="Eigenschaften, Einsatzgebiete, Erfahrungen, Empfehlungen..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6} /></div>
            <div className="space-y-1.5"><Label>Tags (kommagetrennt)</Label><Input placeholder="Aluminium, Außenbereich, Museum" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={() => createMutation.mutate({ title: form.title, content: form.content, category: form.category as any, tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined })} disabled={!form.title || !form.content || createMutation.isPending}>
              {createMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

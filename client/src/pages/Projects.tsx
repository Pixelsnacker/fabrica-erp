import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, FolderKanban, Euro, Calendar, LayoutGrid, List, ArchiveRestore } from "lucide-react";
import { EntitySearch } from "@/components/EntitySearch";
import { useLocation } from "wouter";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Anfrage", calculation: "Kalkulation", offer: "Angebot",
  order: "Auftrag", production: "Produktion", shipping: "Versand",
  completed: "Abgeschlossen", cancelled: "Storniert",
};
const STATUS_ORDER = ["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"];

const TYPE_LABELS: Record<string, string> = {
  serial_part: "Serienteil", spare_part: "Ersatzteil", museum: "Museum/Modellbau",
  consulting: "Beratung", cad_work: "CAD-Bearbeitung", other: "Sonstige",
};

export default function Projects() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [form, setForm] = useState({ title: "", projectNumber: "", type: "other", notes: "", status: "inquiry", compositeId: "" });
  // compositeId: 'c:123' = Kunde, 's:456' = Lieferant

  const handleFullBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/export/backup-all");
      if (!res.ok) throw new Error("Backup fehlgeschlagen");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `fabrica-gesamt-backup_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Gesamt-Backup heruntergeladen");
    } catch {
      toast.error("Backup fehlgeschlagen");
    } finally {
      setIsBackingUp(false);
    }
  };

  const utils = trpc.useUtils();
  const { data: projects = [], isLoading } = trpc.projects.list.useQuery({});
  const { data: projectEntities = [] } = trpc.customers.listForProjects.useQuery();
  const { data: leadSources = [] } = trpc.leadSources.list.useQuery();
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); setShowCreate(false); setForm({ title: "", projectNumber: "", type: "other", notes: "", status: "inquiry", compositeId: "" }); toast.success("Projekt angelegt"); },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Projekte</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">{projects.length} Projekte gesamt</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleFullBackup}
            disabled={isBackingUp}
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs md:text-sm"
            title="Alle Projekte als ZIP herunterladen"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBackingUp ? "Erstelle..." : "Gesamt-Backup"}</span>
          </Button>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5 text-xs md:text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Neues Projekt</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Projekt suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
          <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("kanban")}><LayoutGrid className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Projekte...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <FolderKanban className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Projekte gefunden</p>
          <Button onClick={() => setShowCreate(true)}>Erstes Projekt anlegen</Button>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {filtered.map(project => (
            <div key={project.id} className="flex items-center gap-2 md:gap-4 p-3 md:p-4 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-all" onClick={() => setLocation(`/projects/${project.id}`)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{project.title}</span>
                  {project.projectNumber && <span className="text-xs text-muted-foreground">#{project.projectNumber}</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[project.type] ?? project.type}</span>
                  {project.deadline && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.deadline).toLocaleDateString("de-DE")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-primary">{parseFloat(project.totalVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                  <div className="text-xs text-green-400">{parseFloat(project.marginPercent ?? "0").toFixed(1)}% Marge</div>
                </div>
                <Badge className={`status-${project.status} text-xs whitespace-nowrap`}>{STATUS_LABELS[project.status]}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Kanban View
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STATUS_ORDER.map(status => {
            const cols = filtered.filter(p => p.status === status);
            return (
              <div key={status} className="flex-shrink-0 w-64">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm font-medium">{STATUS_LABELS[status]}</span>
                  <Badge variant="secondary" className="text-xs">{cols.length}</Badge>
                </div>
                <div className="space-y-2">
                  {cols.map(project => (
                    <Card key={project.id} className="bg-card border-border hover:border-primary/50 cursor-pointer transition-all" onClick={() => setLocation(`/projects/${project.id}`)}>
                      <CardContent className="p-3">
                        <div className="font-medium text-sm truncate">{project.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{TYPE_LABELS[project.type] ?? project.type}</div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-primary font-medium">{parseFloat(project.totalVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €</span>
                          <span className="text-xs text-green-400">{parseFloat(project.marginPercent ?? "0").toFixed(0)}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {cols.length === 0 && <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Leer</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Neues Projekt anlegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Projekttitel *</Label>
              <Input placeholder="z.B. Gehäuse Müller GmbH" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Projektnummer</Label>
              <Input placeholder="z.B. 2024-001" value={form.projectNumber} onChange={e => setForm(f => ({ ...f, projectNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Projekttyp</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Startstatus</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.filter(s => s !== 'cancelled').map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kunde <span className="text-destructive">*</span></Label>
              <EntitySearch
                options={(projectEntities as any[]).map((e: any) => ({ id: e.compositeId, label: e.label, sublabel: e.group }))}
                value={form.compositeId || undefined}
                onChange={v => setForm(f => ({ ...f, compositeId: v ? String(v) : '' }))}
                placeholder="Kunde oder Lieferant suchen..."
                emptyLabel="Kein Eintrag"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notizen</Label>
              <Textarea placeholder="Interne Notizen..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={() => {
                const isSupplier = form.compositeId.startsWith('s:');
                const rawId = parseInt(form.compositeId.replace(/^[cs]:/, ''));
                createMutation.mutate({
                  title: form.title,
                  projectNumber: form.projectNumber || undefined,
                  type: form.type as any,
                  notes: form.notes || undefined,
                  status: form.status as any,
                  customerId: isSupplier ? undefined : rawId,
                  supplierId: isSupplier ? rawId : undefined,
                });
              }} disabled={!form.title || !form.compositeId || createMutation.isPending}>
              {createMutation.isPending ? "Wird angelegt..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { Plus, Search, FolderKanban, Calendar, LayoutGrid, List, ArchiveRestore, CheckCircle2, Archive, RotateCcw, BarChart2, XCircle } from "lucide-react";
import { EntitySearch } from "@/components/EntitySearch";
import { useLocation } from "wouter";
import { toast } from "sonner";

export const STATUS_LABELS: Record<string, string> = {
  inquiry: "Anfrage", calculation: "Kalkulation", offer: "Angebot",
  order: "Auftrag", production: "Produktion", shipping: "Versand",
  completed: "Abgeschlossen", cancelled: "Storniert", rejected: "Nicht angenommen",
};
const STATUS_ORDER = ["inquiry", "calculation", "offer", "order", "production", "shipping", "completed", "cancelled"];

const TYPE_LABELS: Record<string, string> = {
  serial_part: "Serienteil", spare_part: "Ersatzteil", museum: "Museum/Modellbau",
  consulting: "Beratung", cad_work: "CAD-Bearbeitung", other: "Sonstige",
};

const REJECTION_REASON_LABELS: Record<string, string> = {
  preis: "Preis zu hoch",
  timing: "Timing / Lieferzeit",
  wettbewerber: "Wettbewerber gewählt",
  kein_feedback: "Kein Feedback",
  sonstiges: "Sonstiges",
};

export default function Projects() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list");
  const [activeTab, setActiveTab] = useState<"active" | "archive">("active");
  const [showCreate, setShowCreate] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [form, setForm] = useState({ title: "", projectNumber: "", type: "other", notes: "", status: "inquiry", compositeId: "" });

  // Archive modal state
  const [archiveTarget, setArchiveTarget] = useState<{ id: number; title: string } | null>(null);
  const [archiveReason, setArchiveReason] = useState<string>("kein_feedback");
  const [archiveNote, setArchiveNote] = useState("");

  // Archive filter state
  const [archiveYearFilter, setArchiveYearFilter] = useState<number | undefined>(undefined);
  const [archiveReasonFilter, setArchiveReasonFilter] = useState<string | undefined>(undefined);

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
  const { data: archivedProjects = [], isLoading: isLoadingArchive } = trpc.projects.listArchived.useQuery({
    year: archiveYearFilter,
    rejectionReason: archiveReasonFilter,
  });
  const { data: projectEntities = [] } = trpc.customers.listForProjects.useQuery();

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      setShowCreate(false);
      setForm({ title: "", projectNumber: "", type: "other", notes: "", status: "inquiry", compositeId: "" });
      toast.success("Projekt angelegt");
    },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const archiveMutation = trpc.projects.archive.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.listArchived.invalidate();
      setArchiveTarget(null);
      setArchiveNote("");
      setArchiveReason("kein_feedback");
      toast.success("Projekt archiviert");
    },
    onError: () => toast.error("Fehler beim Archivieren"),
  });

  const reactivateMutation = trpc.projects.reactivate.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      utils.projects.listArchived.invalidate();
      toast.success("Projekt reaktiviert – Status: Anfrage");
    },
    onError: () => toast.error("Fehler beim Reaktivieren"),
  });

  // Active projects: exclude rejected
  const activeProjects = projects.filter(p => p.status !== 'rejected');
  const filtered = activeProjects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
    ((p as any).customerCompany ?? "").toLowerCase().includes(search.toLowerCase()) ||
    ((p as any).customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredArchive = (archivedProjects as any[]).filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.projectNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.customerCompany ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.customerName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Projekte</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            {activeProjects.length} aktiv · {(archivedProjects as any[]).length} archiviert
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs md:text-sm"
            onClick={() => setLocation("/statistics")}
            title="Statistik & Hit Rate"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Statistik</span>
          </Button>
          <Button
            onClick={handleFullBackup}
            disabled={isBackingUp}
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs md:text-sm"
            title="Alle Projekte als ZIP herunterladen"
          >
            <ArchiveRestore className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isBackingUp ? "Erstelle..." : "Backup"}</span>
          </Button>
          <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5 text-xs md:text-sm">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Neues Projekt</span>
            <span className="sm:hidden">Neu</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Aktive Projekte <Badge variant="secondary" className="ml-1.5 text-xs">{activeProjects.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab("archive")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "archive" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Archive className="h-3.5 w-3.5" />
          Nicht angenommen <Badge variant="secondary" className="ml-1 text-xs">{(archivedProjects as any[]).length}</Badge>
        </button>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Projekt suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {activeTab === "active" && (
          <div className="flex border border-border rounded-lg overflow-hidden shrink-0">
            <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
            <Button variant={viewMode === "kanban" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("kanban")}><LayoutGrid className="h-4 w-4" /></Button>
          </div>
        )}
        {activeTab === "archive" && (
          <div className="flex items-center gap-2">
            <Select value={archiveYearFilter?.toString() ?? "all"} onValueChange={v => setArchiveYearFilter(v === "all" ? undefined : parseInt(v))}>
              <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="Jahr" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jahre</SelectItem>
                {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={archiveReasonFilter ?? "all"} onValueChange={v => setArchiveReasonFilter(v === "all" ? undefined : v)}>
              <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Grund" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Gründe</SelectItem>
                {Object.entries(REJECTION_REASON_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Active Projects Tab */}
      {activeTab === "active" && (
        <>
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
                <div key={project.id} className={`flex items-center gap-2 md:gap-4 p-3 md:p-4 rounded-lg bg-card border cursor-pointer transition-all group ${
                    project.status === 'completed'
                      ? 'border-emerald-500/30 hover:border-emerald-500/60 opacity-75 hover:opacity-100'
                      : 'border-border hover:border-primary/50'
                  }`} onClick={() => setLocation(`/projects/${project.id}`)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {project.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                      <span className="font-medium truncate">{project.title}</span>
                      {project.projectNumber && <span className="text-xs text-muted-foreground">#{project.projectNumber}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[project.type] ?? project.type}</span>
                      {(project.customerCompany || project.customerName) && (
                        <span className="text-xs text-cyan-400/80 font-medium truncate max-w-[200px]">
                          {project.customerCompany || project.customerName}
                        </span>
                      )}
                      {project.deadline && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(project.deadline).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-semibold text-primary">{parseFloat(project.totalVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                      <div className="text-xs text-green-400">{parseFloat(project.marginPercent ?? "0").toFixed(1)}% Marge</div>
                    </div>
                    <Badge className={`status-${project.status} text-xs whitespace-nowrap`}>{STATUS_LABELS[project.status]}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Als nicht angenommen archivieren"
                      onClick={e => { e.stopPropagation(); setArchiveTarget({ id: project.id, title: project.title }); }}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
                            {(project.customerCompany || project.customerName) && (
                              <div className="text-xs text-cyan-400/80 font-medium truncate mt-0.5">
                                {project.customerCompany || project.customerName}
                              </div>
                            )}
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
        </>
      )}

      {/* Archive Tab */}
      {activeTab === "archive" && (
        <>
          {isLoadingArchive ? (
            <div className="text-muted-foreground text-sm">Lade Archiv...</div>
          ) : filteredArchive.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Archive className="h-12 w-12 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Keine archivierten Projekte</p>
              <p className="text-xs text-muted-foreground">Projekte die nicht angenommen wurden, erscheinen hier.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredArchive.map((project: any) => (
                <div key={project.id} className="flex items-center gap-2 md:gap-4 p-3 md:p-4 rounded-lg bg-card border border-border/50 opacity-80 hover:opacity-100 transition-all">
                  <XCircle className="h-4 w-4 text-destructive/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{project.title}</span>
                      {project.projectNumber && <span className="text-xs text-muted-foreground">#{project.projectNumber}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {project.customerCompany || project.customerName || "–"}
                      </span>
                      {project.rejectionReason && (
                        <Badge variant="outline" className="text-xs border-destructive/30 text-destructive/80">
                          {REJECTION_REASON_LABELS[project.rejectionReason] ?? project.rejectionReason}
                        </Badge>
                      )}
                      {project.rejectionNote && (
                        <span className="text-xs text-muted-foreground italic truncate max-w-xs">"{project.rejectionNote}"</span>
                      )}
                      {project.archivedAt && (
                        <span className="text-xs text-muted-foreground">
                          Archiviert: {new Date(project.archivedAt).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-semibold text-muted-foreground">{parseFloat(project.totalVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      title="Projekt reaktivieren"
                      onClick={() => reactivateMutation.mutate({ id: project.id })}
                      disabled={reactivateMutation.isPending}
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span className="hidden sm:inline">Reaktivieren</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setLocation(`/projects/${project.id}`)}
                    >
                      Öffnen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Archive Modal */}
      <Dialog open={!!archiveTarget} onOpenChange={open => { if (!open) { setArchiveTarget(null); setArchiveNote(""); setArchiveReason("kein_feedback"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-destructive" />
              Projekt archivieren
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Das Projekt <strong>"{archiveTarget?.title}"</strong> wird als "Nicht angenommen" archiviert und aus der aktiven Liste entfernt. Es kann jederzeit reaktiviert werden.
            </p>
            <div className="space-y-1.5">
              <Label>Ablehnungsgrund *</Label>
              <Select value={archiveReason} onValueChange={setArchiveReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REJECTION_REASON_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notiz (optional)</Label>
              <Textarea
                placeholder="z.B. Kunde hat sich für günstigeren Anbieter entschieden..."
                value={archiveNote}
                onChange={e => setArchiveNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setArchiveTarget(null); setArchiveNote(""); setArchiveReason("kein_feedback"); }}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => archiveTarget && archiveMutation.mutate({
                id: archiveTarget.id,
                rejectionReason: archiveReason as any,
                rejectionNote: archiveNote || undefined,
              })}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Archiviere..." : "Archivieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

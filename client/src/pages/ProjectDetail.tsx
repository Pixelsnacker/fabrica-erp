import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Package, Truck, FileCode2, MessageSquare, ExternalLink, Bell, StickyNote, Clock, Paperclip, CheckCircle2, Circle, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Anfrage", calculation: "Kalkulation", offer: "Angebot",
  order: "Auftrag", production: "Produktion", shipping: "Versand",
  completed: "Abgeschlossen", cancelled: "Storniert",
};
const STATUS_ORDER = ["inquiry","calculation","offer","order","production","shipping","completed","cancelled"];
const TECHNIQUE_LABELS: Record<string, string> = {
  "3d_print": "3D-Druck", cnc: "CNC", painting: "Lackierung",
  cad_work: "CAD-Bearbeitung", model_making: "Modellbau", assembly: "Montage", other: "Sonstige",
};
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  niedrig: { label: "Niedrig", color: "text-blue-400" },
  normal: { label: "Normal", color: "text-muted-foreground" },
  hoch: { label: "Hoch", color: "text-red-400" },
};
const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp", telefon: "Telefon", persoenlich: "Persönlich",
  email: "E-Mail", sonstiges: "Sonstiges",
};

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.projects.byId.useQuery({ id });
  const { data: items = [] } = trpc.projectItems.list.useQuery({ projectId: id });
  const { data: shipments = [] } = trpc.shipments.byProject.useQuery({ projectId: id });
  const { data: cadFiles = [] } = trpc.cadFiles.byProject.useQuery({ projectId: id });
  const { data: consultations = [] } = trpc.consultation.list.useQuery({ projectId: id });
  const { data: projectNotes = [] } = trpc.notes.list.useQuery({ projectId: id });
  const { data: projectQuickNotes = [] } = trpc.quickNotes.list.useQuery({ projectId: id });

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [showAddConsultation, setShowAddConsultation] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showNoteDetail, setShowNoteDetail] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", quantity: 1, material: "", technique: "3d_print", productionType: "external", unitEk: "0.00", unitVk: "0.00" });
  const [shipmentForm, setShipmentForm] = useState({ carrier: "", trackingNumber: "", notes: "" });
  const [consultForm, setConsultForm] = useState({ title: "", content: "", type: "general", outcome: "" });
  const [noteForm, setNoteForm] = useState({ title: "", content: "", priority: "normal" });

  const changeStatus = trpc.projects.changeStatus.useMutation({
    onSuccess: () => { utils.projects.byId.invalidate({ id }); toast.success("Status aktualisiert"); },
  });
  const addItem = trpc.projectItems.create.useMutation({
    onSuccess: () => { utils.projectItems.list.invalidate({ projectId: id }); utils.projects.byId.invalidate({ id }); setShowAddItem(false); toast.success("Position hinzugefügt"); },
  });
  const deleteItem = trpc.projectItems.delete.useMutation({
    onSuccess: () => { utils.projectItems.list.invalidate({ projectId: id }); utils.projects.byId.invalidate({ id }); toast.success("Position gelöscht"); },
  });
  const addShipment = trpc.shipments.create.useMutation({
    onSuccess: () => { utils.shipments.byProject.invalidate({ projectId: id }); setShowAddShipment(false); toast.success("Versand hinzugefügt"); },
  });
  const addConsultation = trpc.consultation.create.useMutation({
    onSuccess: () => { utils.consultation.list.invalidate({ projectId: id }); setShowAddConsultation(false); toast.success("Beratungseintrag gespeichert"); },
  });
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate({ projectId: id });
      setShowAddNote(false);
      setNoteForm({ title: "", content: "", priority: "normal" });
      toast.success("Notiz gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });
  const toggleNoteStatus = trpc.notes.update.useMutation({
    onSuccess: () => utils.notes.list.invalidate({ projectId: id }),
  });
  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => { utils.notes.list.invalidate({ projectId: id }); toast.success("Notiz gelöscht"); },
  });

  const totalNotesCount = projectNotes.length + projectQuickNotes.length;

  if (isLoading) return <div className="p-6 text-muted-foreground">Lade Projekt...</div>;
  if (!project) return <div className="p-6 text-muted-foreground">Projekt nicht gefunden</div>;

  const totalEk = parseFloat(project.totalEk ?? "0");
  const totalVk = parseFloat(project.totalVk ?? "0");
  const margin = totalVk - totalEk;
  const marginPct = parseFloat(project.marginPercent ?? "0");

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold truncate">{project.title}</h1>
            {project.projectNumber && <span className="text-muted-foreground text-sm">#{project.projectNumber}</span>}
            <Badge className={`status-${project.status}`}>{STATUS_LABELS[project.status]}</Badge>
          </div>
          {project.notes && <p className="text-sm text-muted-foreground mt-1">{project.notes}</p>}
        </div>
        {project.driveFolderUrl && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={project.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
              <ExternalLink className="h-4 w-4" /> Drive
            </a>
          </Button>
        )}
      </div>

      {/* Status Pipeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_ORDER.slice(0, 7).map(s => (
          <button key={s} onClick={() => changeStatus.mutate({ id, status: s as any })}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${project.status === s ? `status-${s} scale-105` : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="bg-card border-border"><CardContent className="p-3 md:p-4">
          <div className="text-xs text-muted-foreground mb-1">EK</div>
          <div className="text-lg md:text-xl font-bold text-yellow-400">{totalEk.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 md:p-4">
          <div className="text-xs text-muted-foreground mb-1">VK</div>
          <div className="text-lg md:text-xl font-bold text-primary">{totalVk.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 md:p-4">
          <div className="text-xs text-muted-foreground mb-1">Marge</div>
          <div className="text-lg md:text-xl font-bold text-green-400">{margin.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € <span className="text-xs">({marginPct.toFixed(1)}%)</span></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList className="bg-secondary flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="items" className="gap-1.5 text-xs md:text-sm"><Package className="h-3.5 w-3.5" /><span className="hidden sm:inline">Positionen</span> ({items.length})</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs md:text-sm"><StickyNote className="h-3.5 w-3.5" /><span className="hidden sm:inline">Notizen</span> ({totalNotesCount})</TabsTrigger>
          <TabsTrigger value="shipment" className="gap-1.5 text-xs md:text-sm"><Truck className="h-3.5 w-3.5" /><span className="hidden sm:inline">Versand</span> ({shipments.length})</TabsTrigger>
          <TabsTrigger value="cad" className="gap-1.5 text-xs md:text-sm"><FileCode2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">CAD</span> ({cadFiles.length})</TabsTrigger>
          <TabsTrigger value="consultation" className="gap-1.5 text-xs md:text-sm"><MessageSquare className="h-3.5 w-3.5" /><span className="hidden sm:inline">Beratung</span> ({consultations.length})</TabsTrigger>
        </TabsList>

        {/* ── Positionen ── */}
        <TabsContent value="items" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddItem(true)} className="gap-2"><Plus className="h-4 w-4" />Position hinzufügen</Button>
          </div>
          {items.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch keine Positionen</div> : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 md:p-4 rounded-lg bg-card border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.name}</span>
                      <Badge variant="secondary" className="text-xs">{item.quantity}x</Badge>
                      {item.technique && <Badge variant="outline" className="text-xs">{TECHNIQUE_LABELS[item.technique] ?? item.technique}</Badge>}
                      <Badge variant={item.productionType === "in_house" ? "default" : "secondary"} className="text-xs">{item.productionType === "in_house" ? "In-House" : "Extern"}</Badge>
                    </div>
                    {item.material && <div className="text-xs text-muted-foreground mt-1">{item.material}</div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-muted-foreground">EK: <span className="text-yellow-400">{parseFloat(item.totalEk ?? "0").toFixed(2)} €</span></div>
                    <div className="text-xs text-muted-foreground">VK: <span className="text-primary">{parseFloat(item.totalVk ?? "0").toFixed(2)} €</span></div>
                    <div className="text-xs text-green-400">{parseFloat(item.marginPercent ?? "0").toFixed(1)}%</div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={() => deleteItem.mutate({ id: item.id })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Notizen & Erinnerungen ── */}
        <TabsContent value="notes" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{projectNotes.length} Notiz{projectNotes.length !== 1 ? "en" : ""} · {projectQuickNotes.length} Schnellnotiz{projectQuickNotes.length !== 1 ? "en" : ""}</p>
            <Button size="sm" onClick={() => setShowAddNote(true)} className="gap-2">
              <Plus className="h-4 w-4" />Notiz hinzufügen
            </Button>
          </div>

          {/* Vollständige Notizen */}
          {projectNotes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" /> Notizen
              </h3>
              {projectNotes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onToggle={() => toggleNoteStatus.mutate({ id: note.id, status: note.status === "offen" ? "erledigt" : "offen" })}
                  onDelete={() => deleteNote.mutate({ id: note.id })}
                  onOpen={() => setShowNoteDetail(note.id)}
                />
              ))}
            </div>
          )}

          {/* Schnellnotizen */}
          {projectQuickNotes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-yellow-400" /> Schnellnotizen
              </h3>
              {projectQuickNotes.map((qn: any) => (
                <div key={qn.id} className="p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-start gap-2">
                    <Zap className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{qn.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{SOURCE_LABELS[qn.source] ?? qn.source}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{new Date(qn.createdAt).toLocaleDateString("de-DE")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalNotesCount === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <StickyNote className="h-10 w-10 opacity-20" />
              <p className="text-sm">Noch keine Notizen für dieses Projekt</p>
              <Button size="sm" onClick={() => setShowAddNote(true)}>Erste Notiz anlegen</Button>
            </div>
          )}
        </TabsContent>

        {/* ── Versand ── */}
        <TabsContent value="shipment" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddShipment(true)} className="gap-2"><Plus className="h-4 w-4" />Versand hinzufügen</Button>
          </div>
          {shipments.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch kein Versand erfasst</div> : (
            <div className="space-y-2">
              {shipments.map(s => (
                <div key={s.id} className="p-4 rounded-lg bg-card border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{s.carrier ?? "Unbekannter Carrier"}</span>
                      {s.trackingNumber && <div className="text-xs text-primary mt-1 font-mono">{s.trackingNumber}</div>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {s.shippedAt && <div>Versandt: {new Date(s.shippedAt).toLocaleDateString("de-DE")}</div>}
                      {s.estimatedDelivery && <div>Erwartet: {new Date(s.estimatedDelivery).toLocaleDateString("de-DE")}</div>}
                    </div>
                  </div>
                  {s.notes && <div className="text-xs text-muted-foreground mt-2">{s.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CAD ── */}
        <TabsContent value="cad" className="mt-4">
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileCode2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            CAD-Datei-Upload folgt in Phase 2
          </div>
        </TabsContent>

        {/* ── Beratung ── */}
        <TabsContent value="consultation" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddConsultation(true)} className="gap-2"><Plus className="h-4 w-4" />Beratungseintrag</Button>
          </div>
          {consultations.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch keine Beratungseinträge</div> : (
            <div className="space-y-3">
              {consultations.map(c => (
                <div key={c.id} className="p-4 rounded-lg bg-card border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.createdAt).toLocaleDateString("de-DE")}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{c.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{c.content}</p>
                  {c.outcome && <div className="mt-2 text-xs text-green-400 border-t border-border pt-2">Ergebnis: {c.outcome}</div>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Position hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Bezeichnung *</Label><Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Menge</Label><Input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} /></div>
              <div className="space-y-1.5"><Label>Material</Label><Input value={itemForm.material} onChange={e => setItemForm(f => ({ ...f, material: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Technik</Label>
                <Select value={itemForm.technique} onValueChange={v => setItemForm(f => ({ ...f, technique: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TECHNIQUE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Produktion</Label>
                <Select value={itemForm.productionType} onValueChange={v => setItemForm(f => ({ ...f, productionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="external">Extern</SelectItem><SelectItem value="in_house">In-House</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>EK (Einzel) €</Label><Input type="number" step="0.01" value={itemForm.unitEk} onChange={e => setItemForm(f => ({ ...f, unitEk: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>VK (Einzel) €</Label><Input type="number" step="0.01" value={itemForm.unitVk} onChange={e => setItemForm(f => ({ ...f, unitVk: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Abbrechen</Button>
            <Button onClick={() => addItem.mutate({ projectId: id, name: itemForm.name, quantity: itemForm.quantity, material: itemForm.material || undefined, technique: itemForm.technique as any, productionType: itemForm.productionType as any, unitEk: itemForm.unitEk, unitVk: itemForm.unitVk })} disabled={!itemForm.name || addItem.isPending}>
              {addItem.isPending ? "Speichert..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddShipment} onOpenChange={setShowAddShipment}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Versand erfassen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Carrier</Label><Input placeholder="DHL, UPS, DPD..." value={shipmentForm.carrier} onChange={e => setShipmentForm(f => ({ ...f, carrier: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Trackingnummer</Label><Input placeholder="1Z999AA10123456784" value={shipmentForm.trackingNumber} onChange={e => setShipmentForm(f => ({ ...f, trackingNumber: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notizen</Label><Textarea value={shipmentForm.notes} onChange={e => setShipmentForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShipment(false)}>Abbrechen</Button>
            <Button onClick={() => addShipment.mutate({ projectId: id, carrier: shipmentForm.carrier || undefined, trackingNumber: shipmentForm.trackingNumber || undefined, notes: shipmentForm.notes || undefined })} disabled={addShipment.isPending}>
              {addShipment.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddConsultation} onOpenChange={setShowAddConsultation}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Beratungseintrag hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titel *</Label><Input value={consultForm.title} onChange={e => setConsultForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Typ</Label>
              <Select value={consultForm.type} onValueChange={v => setConsultForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="material_advice">Materialberatung</SelectItem>
                  <SelectItem value="process_advice">Verfahrensberatung</SelectItem>
                  <SelectItem value="technical_analysis">Technische Analyse</SelectItem>
                  <SelectItem value="offer_discussion">Angebotsgespräch</SelectItem>
                  <SelectItem value="general">Allgemein</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Inhalt *</Label><Textarea value={consultForm.content} onChange={e => setConsultForm(f => ({ ...f, content: e.target.value }))} rows={4} /></div>
            <div className="space-y-1.5"><Label>Ergebnis</Label><Input value={consultForm.outcome} onChange={e => setConsultForm(f => ({ ...f, outcome: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddConsultation(false)}>Abbrechen</Button>
            <Button onClick={() => addConsultation.mutate({ projectId: id, title: consultForm.title, content: consultForm.content, type: consultForm.type as any, outcome: consultForm.outcome || undefined })} disabled={!consultForm.title || !consultForm.content || addConsultation.isPending}>
              {addConsultation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neue Notiz Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4" />Notiz hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Titel *</Label>
              <Input placeholder="Kurze Beschreibung..." value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Inhalt</Label>
              <Textarea placeholder="Details, Informationen..." value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Priorität</Label>
              <Select value={noteForm.priority} onValueChange={v => setNoteForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)}>Abbrechen</Button>
            <Button onClick={() => createNote.mutate({ title: noteForm.title, content: noteForm.content || undefined, projectId: id, priority: noteForm.priority as any })} disabled={!noteForm.title || createNote.isPending}>
              {createNote.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notiz-Detail Dialog */}
      {showNoteDetail && (
        <NoteDetailDialog noteId={showNoteDetail} onClose={() => setShowNoteDetail(null)} onRefresh={() => utils.notes.list.invalidate({ projectId: id })} />
      )}
    </div>
  );
}

// ── NoteCard Komponente ──────────────────────────────────────────────────────
function NoteCard({ note, onToggle, onDelete, onOpen }: {
  note: { id: number; title: string; content?: string | null; status: string; priority: string; createdAt: Date | string };
  onToggle: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const prio = PRIORITY_CONFIG[note.priority] ?? PRIORITY_CONFIG.normal;
  const isDone = note.status === "erledigt";

  return (
    <div className={`p-3 rounded-lg border transition-all ${isDone ? "bg-secondary/30 border-border opacity-70" : "bg-card border-border hover:border-primary/40"}`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5 shrink-0">
          {isDone
            ? <CheckCircle2 className="h-4 w-4 text-green-400" />
            : <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
          }
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>{note.title}</span>
            {note.priority !== "normal" && (
              <span className={`text-xs ${prio.color}`}>● {prio.label}</span>
            )}
          </div>
          {note.content && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{note.content}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleDateString("de-DE")}</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0 h-7 w-7 p-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── NoteDetailDialog Komponente ──────────────────────────────────────────────
function NoteDetailDialog({ noteId, onClose, onRefresh }: { noteId: number; onClose: () => void; onRefresh: () => void }) {
  const { data: note, isLoading } = trpc.notes.getById.useQuery({ id: noteId });
  const utils = trpc.useUtils();

  const addReminder = trpc.notes.addReminder.useMutation({
    onSuccess: () => { utils.notes.getById.invalidate({ id: noteId }); toast.success("Erinnerung gesetzt"); },
  });
  const deleteReminder = trpc.notes.deleteReminder.useMutation({
    onSuccess: () => utils.notes.getById.invalidate({ id: noteId }),
  });

  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderLabel, setReminderLabel] = useState("");

  const handleAddReminder = () => {
    if (!reminderDate) return;
    const dt = new Date(`${reminderDate}T${reminderTime}:00`);
    addReminder.mutate({ noteId, remindAt: dt.toISOString(), label: reminderLabel || undefined });
    setReminderDate("");
    setReminderLabel("");
  };

  if (isLoading) return null;
  if (!note) return null;

  const now = new Date();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            {note.title}
          </DialogTitle>
        </DialogHeader>

        {note.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
        )}

        {/* Anhänge */}
        {note.attachments && note.attachments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" /> Anhänge ({note.attachments.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {note.attachments.map((att: any) => (
                <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary text-xs hover:bg-secondary/80 transition-colors">
                  <Paperclip className="h-3 w-3" />
                  {att.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Erinnerungen */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Erinnerungen
          </h4>

          {note.reminders && note.reminders.length > 0 ? (
            <div className="space-y-1.5">
              {note.reminders.map((r: any) => {
                const remindDate = new Date(r.remindAt);
                const isPast = remindDate < now;
                const isSent = r.isSent;
                return (
                  <div key={r.id} className={`flex items-center gap-2 p-2 rounded-md border text-xs ${isSent ? "bg-secondary/30 border-border opacity-60" : isPast ? "bg-red-950/30 border-red-900/50" : "bg-secondary/50 border-border"}`}>
                    {isSent ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    ) : isPast ? (
                      <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{remindDate.toLocaleDateString("de-DE")} {remindDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                      {r.label && <span className="text-muted-foreground ml-1.5">— {r.label}</span>}
                      {isSent && <span className="text-green-400 ml-1.5">✓ Gesendet</span>}
                      {isPast && !isSent && <span className="text-red-400 ml-1.5">Überfällig</span>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteReminder.mutate({ id: r.id })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Noch keine Erinnerungen</p>
          )}

          {/* Neue Erinnerung */}
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium">Neue Erinnerung</p>
            <div className="flex gap-2">
              <Input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className="text-xs h-8 flex-1" />
              <Input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className="text-xs h-8 w-24" />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Bezeichnung (optional)" value={reminderLabel} onChange={e => setReminderLabel(e.target.value)} className="text-xs h-8 flex-1" />
              <Button size="sm" onClick={handleAddReminder} disabled={!reminderDate || addReminder.isPending} className="h-8 gap-1 text-xs">
                <Bell className="h-3 w-3" /> Setzen
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

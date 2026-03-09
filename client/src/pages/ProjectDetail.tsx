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
import { ArrowLeft, Plus, Trash2, Package, Truck, FileCode2, MessageSquare, ExternalLink } from "lucide-react";
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

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [showAddConsultation, setShowAddConsultation] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", quantity: 1, material: "", technique: "3d_print", productionType: "external", unitEk: "0.00", unitVk: "0.00" });
  const [shipmentForm, setShipmentForm] = useState({ carrier: "", trackingNumber: "", notes: "" });
  const [consultForm, setConsultForm] = useState({ title: "", content: "", type: "general", outcome: "" });

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

  if (isLoading) return <div className="p-6 text-muted-foreground">Lade Projekt...</div>;
  if (!project) return <div className="p-6 text-muted-foreground">Projekt nicht gefunden</div>;

  const totalEk = parseFloat(project.totalEk ?? "0");
  const totalVk = parseFloat(project.totalVk ?? "0");
  const margin = totalVk - totalEk;
  const marginPct = parseFloat(project.marginPercent ?? "0");

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{project.title}</h1>
            {project.projectNumber && <span className="text-muted-foreground text-sm">#{project.projectNumber}</span>}
            <Badge className={`status-${project.status}`}>{STATUS_LABELS[project.status]}</Badge>
          </div>
          {project.notes && <p className="text-sm text-muted-foreground mt-1">{project.notes}</p>}
        </div>
        {project.driveFolderUrl && (
          <Button variant="outline" size="sm" asChild>
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
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${project.status === s ? `status-${s} scale-105` : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Einkauf (EK)</div>
          <div className="text-xl font-bold text-yellow-400">{totalEk.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Verkauf (VK)</div>
          <div className="text-xl font-bold text-primary">{totalVk.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Marge</div>
          <div className="text-xl font-bold text-green-400">{margin.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € <span className="text-sm">({marginPct.toFixed(1)}%)</span></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList className="bg-secondary">
          <TabsTrigger value="items" className="gap-2"><Package className="h-4 w-4" />Positionen ({items.length})</TabsTrigger>
          <TabsTrigger value="shipment" className="gap-2"><Truck className="h-4 w-4" />Versand ({shipments.length})</TabsTrigger>
          <TabsTrigger value="cad" className="gap-2"><FileCode2 className="h-4 w-4" />CAD ({cadFiles.length})</TabsTrigger>
          <TabsTrigger value="consultation" className="gap-2"><MessageSquare className="h-4 w-4" />Beratung ({consultations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddItem(true)} className="gap-2"><Plus className="h-4 w-4" />Position hinzufügen</Button>
          </div>
          {items.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch keine Positionen</div> : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border">
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
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteItem.mutate({ id: item.id })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

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

        <TabsContent value="cad" className="mt-4">
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileCode2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            CAD-Datei-Upload folgt in Phase 2
          </div>
        </TabsContent>

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

      {/* Dialogs */}
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
                  <SelectItem value="other">Sonstige</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Inhalt *</Label><Textarea value={consultForm.content} onChange={e => setConsultForm(f => ({ ...f, content: e.target.value }))} rows={5} placeholder="Beratungsinhalt, Empfehlungen, Diskussion..." /></div>
            <div className="space-y-1.5"><Label>Ergebnis / Entscheidung</Label><Textarea value={consultForm.outcome} onChange={e => setConsultForm(f => ({ ...f, outcome: e.target.value }))} rows={2} placeholder="Welche Entscheidung wurde getroffen?" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddConsultation(false)}>Abbrechen</Button>
            <Button onClick={() => addConsultation.mutate({ projectId: id, title: consultForm.title, content: consultForm.content, type: consultForm.type as any, outcome: consultForm.outcome || undefined })} disabled={!consultForm.title || !consultForm.content || addConsultation.isPending}>
              {addConsultation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Search, FlaskConical, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  plastic: "Kunststoff", metal: "Metall", composite: "Verbundwerkstoff",
  surface_treatment: "Oberflächenbehandlung", process: "Verfahren", other: "Sonstige",
};

const CATEGORY_COLORS: Record<string, string> = {
  plastic: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  metal: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20",
  composite: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  surface_treatment: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  process: "bg-green-500/15 text-green-400 border-green-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

type MaterialForm = {
  name: string;
  category: string;
  properties: string;
  applications: string;
  advantages: string;
  notes: string;
};

const EMPTY_FORM: MaterialForm = {
  name: "", category: "metal", properties: "", applications: "", advantages: "", notes: "",
};

export default function Materials() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<MaterialForm>(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data: materials = [], isLoading } = trpc.materials.list.useQuery();

  const createMutation = trpc.materials.create.useMutation({
    onSuccess: () => {
      utils.materials.list.invalidate();
      setShowCreate(false);
      setForm(EMPTY_FORM);
      toast.success("Material angelegt");
    },
  });

  const updateMutation = trpc.materials.update.useMutation({
    onSuccess: () => {
      utils.materials.list.invalidate();
      setEditId(null);
      setForm(EMPTY_FORM);
      toast.success("Material aktualisiert");
    },
  });

  const deleteMutation = trpc.materials.delete.useMutation({
    onSuccess: () => {
      utils.materials.list.invalidate();
      setDeleteId(null);
      toast.success("Material gelöscht");
    },
  });

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.properties ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (m.applications ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(mat: typeof materials[0], e: React.MouseEvent) {
    e.stopPropagation();
    setForm({
      name: mat.name,
      category: mat.category,
      properties: mat.properties ?? "",
      applications: mat.applications ?? "",
      advantages: (mat as any).advantages ?? "",
      notes: mat.notes ?? "",
    });
    setEditId(mat.id);
  }

  const deleteName = materials.find(m => m.id === deleteId)?.name ?? "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materialbibliothek</h1>
          <p className="text-muted-foreground text-sm mt-1">Werkstoffe, Oberflächen und Verfahren mit Eigenschaften</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" />Neues Material
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Material suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Materialien...</div>
      ) : materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <FlaskConical className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Noch keine Materialien angelegt</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">
            Legen Sie Ihre Materialien und Oberflächen an — z.B. AL 7075, Harteloxal, VeroMetal. Der KI-Assistent nutzt diese Daten.
          </p>
          <Button onClick={() => setShowCreate(true)}>Erstes Material anlegen</Button>
        </div>
      ) : filtered.length === 0 && search ? (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Keine Materialien für „{search}" gefunden.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Accordion type="multiple" className="w-full">
            {filtered.map((mat, idx) => (
              <AccordionItem
                key={mat.id}
                value={String(mat.id)}
                className={idx < filtered.length - 1 ? "border-b border-border" : "border-none"}
              >
                <div className="flex items-center group hover:bg-muted/30 transition-colors">
                  <AccordionTrigger className="flex-1 px-4 py-3 hover:no-underline [&>svg]:ml-2 [&>svg]:shrink-0">
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-medium text-sm">{mat.name}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[mat.category] ?? CATEGORY_COLORS.other}`}>
                        {CATEGORY_LABELS[mat.category] ?? mat.category}
                      </span>
                      {mat.properties && (
                        <span className="text-xs text-muted-foreground truncate max-w-xs hidden md:block">
                          {mat.properties.slice(0, 80)}{mat.properties.length > 80 ? "…" : ""}
                        </span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <div className="flex gap-1 pr-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => openEdit(mat, e)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(mat.id); }}
                      title="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="space-y-2.5 text-sm border-t border-border/50 pt-3 mt-0">
                    {mat.properties && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Eigenschaften</span>
                        <p className="text-foreground/80 mt-1 leading-relaxed">{mat.properties}</p>
                      </div>
                    )}
                    {mat.applications && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Typische Anwendungen</span>
                        <p className="text-foreground/80 mt-1 leading-relaxed">{mat.applications}</p>
                      </div>
                    )}
                    {(mat as any).advantages && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vorteile</span>
                        <p className="text-foreground/80 mt-1 leading-relaxed">{(mat as any).advantages}</p>
                      </div>
                    )}
                    {mat.notes && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notizen</span>
                        <p className="text-foreground/80 mt-1 leading-relaxed">{mat.notes}</p>
                      </div>
                    )}
                    {!mat.properties && !mat.applications && !(mat as any).advantages && !mat.notes && (
                      <p className="text-muted-foreground text-xs italic">Keine weiteren Details hinterlegt.</p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={(e) => openEdit(mat, e)}
                      >
                        <Pencil className="h-3 w-3" />Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(mat.id); }}
                      >
                        <Trash2 className="h-3 w-3" />Löschen
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* ── Neues Material anlegen ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Neues Material anlegen</DialogTitle></DialogHeader>
          <MaterialFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate({
                name: form.name,
                category: form.category as any,
                properties: form.properties || undefined,
                applications: form.applications || undefined,
                advantages: form.advantages || undefined,
                notes: form.notes || undefined,
              })}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? "Wird angelegt..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Material bearbeiten ── */}
      <Dialog open={editId !== null} onOpenChange={open => { if (!open) { setEditId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Material bearbeiten</DialogTitle></DialogHeader>
          <MaterialFormFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditId(null); setForm(EMPTY_FORM); }}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (editId === null) return;
                updateMutation.mutate({
                  id: editId,
                  name: form.name || undefined,
                  category: form.category as any,
                  properties: form.properties || undefined,
                  applications: form.applications || undefined,
                  advantages: form.advantages || undefined,
                  notes: form.notes || undefined,
                });
              }}
              disabled={!form.name || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Löschen bestätigen ── */}
      <Dialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Material löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Soll <span className="font-medium text-foreground">„{deleteName}"</span> wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteId !== null) deleteMutation.mutate({ id: deleteId }); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Wird gelöscht..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared Form Fields ──────────────────────────────────────────────────────
function MaterialFormFields({
  form,
  setForm,
}: {
  form: MaterialForm;
  setForm: React.Dispatch<React.SetStateAction<MaterialForm>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Name *</Label>
        <Input
          placeholder="z.B. AL 7075, Harteloxal, VeroMetal Bronze"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Kategorie</Label>
        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Eigenschaften</Label>
        <Textarea
          placeholder="Härte, Temperaturbeständigkeit, Farben, Optik..."
          value={form.properties}
          onChange={e => setForm(f => ({ ...f, properties: e.target.value }))}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Typische Anwendungen</Label>
        <Textarea
          placeholder="Außenbereich, Museum, Industrie, Fassade..."
          value={form.applications}
          onChange={e => setForm(f => ({ ...f, applications: e.target.value }))}
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notizen</Label>
        <Textarea
          placeholder="Eigene Erfahrungen, Hinweise..."
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2}
        />
      </div>
    </div>
  );
}

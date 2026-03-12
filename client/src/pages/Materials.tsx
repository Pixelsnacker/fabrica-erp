import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, FlaskConical, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  plastic: "Kunststoff", metal: "Metall", composite: "Verbundwerkstoff",
  surface_treatment: "Oberflächenbehandlung", process: "Verfahren", other: "Sonstige",
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

  function openEdit(mat: typeof materials[0]) {
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(mat => (
            <div key={mat.id} className="p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{mat.name}</div>
                  <Badge variant="secondary" className="text-xs mt-1">{CATEGORY_LABELS[mat.category] ?? mat.category}</Badge>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(mat)}
                    title="Bearbeiten"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(mat.id)}
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {mat.notes && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{mat.notes}</p>}
              {mat.properties && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="text-foreground/60">Eigenschaften:</span> {mat.properties}
                </div>
              )}
              {mat.applications && (
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="text-foreground/60">Anwendung:</span> {mat.applications}
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && search && (
            <div className="col-span-2 text-center text-muted-foreground py-8 text-sm">
              Keine Materialien für „{search}" gefunden.
            </div>
          )}
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

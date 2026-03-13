import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, Copy, Package } from "lucide-react";

const UNIT_OPTIONS = [
  "Stk.", "Std.", "km", "Pauschal", "%",
  "m²", "m", "kg", "t", "lfm", "m³", "L",
  "Tag(e)", "Woche(n)", "Monat(e)",
];

const TAX_OPTIONS = [
  { value: 19, label: "19 % MwSt" },
  { value: 7, label: "7 % MwSt" },
  { value: 0, label: "0 % (steuerfrei)" },
];

type ArticleForm = {
  articleNumber: string;
  name: string;
  description: string;
  longDescription: string;
  unit: string;
  unitPriceNet: string;
  taxRate: number;
  category: string;
  isActive: boolean;
};

const emptyForm: ArticleForm = {
  articleNumber: "",
  name: "",
  description: "",
  longDescription: "",
  unit: "Stk.",
  unitPriceNet: "0.00",
  taxRate: 19,
  category: "",
  isActive: true,
};

export default function Articles() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: articles = [], isLoading } = trpc.articles.list.useQuery({
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    activeOnly: false,
  });

  const { data: categories = [] } = trpc.articles.categories.useQuery();

  const createMut = trpc.articles.create.useMutation({
    onSuccess: () => {
      toast.success("Artikel angelegt");
      utils.articles.list.invalidate();
      utils.articles.categories.invalidate();
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const updateMut = trpc.articles.update.useMutation({
    onSuccess: () => {
      toast.success("Artikel gespeichert");
      utils.articles.list.invalidate();
      utils.articles.categories.invalidate();
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  const deleteMut = trpc.articles.delete.useMutation({
    onSuccess: () => {
      toast.success("Artikel gelöscht");
      utils.articles.list.invalidate();
      setDeleteId(null);
    },
    onError: (e) => toast.error("Fehler: " + e.message),
  });

  function openNew() {
    setForm(emptyForm);
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(a: any) {
    setForm({
      articleNumber: a.articleNumber ?? "",
      name: a.name,
      description: a.description ?? "",
      longDescription: a.longDescription ?? "",
      unit: a.unit ?? "Stk.",
      unitPriceNet: String(a.unitPriceNet ?? "0.00"),
      taxRate: a.taxRate ?? 19,
      category: a.category ?? "",
      isActive: a.isActive === 1 || a.isActive === true,
    });
    setEditId(a.id);
    setShowForm(true);
  }

  function openDuplicate(a: any) {
    setForm({
      articleNumber: "",
      name: a.name + " (Kopie)",
      description: a.description ?? "",
      longDescription: a.longDescription ?? "",
      unit: a.unit ?? "Stk.",
      unitPriceNet: String(a.unitPriceNet ?? "0.00"),
      taxRate: a.taxRate ?? 19,
      category: a.category ?? "",
      isActive: true,
    });
    setEditId(null);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error("Name ist Pflichtfeld"); return; }
    const payload = {
      articleNumber: form.articleNumber || undefined,
      name: form.name.trim(),
      description: form.description || undefined,
      longDescription: form.longDescription || undefined,
      unit: form.unit,
      unitPriceNet: parseFloat(form.unitPriceNet || "0").toFixed(2),
      taxRate: form.taxRate,
      category: form.category || undefined,
      isActive: form.isActive,
    };
    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const set = (key: keyof ArticleForm, val: any) => setForm(f => ({ ...f, [key]: val }));

  const netPrice = parseFloat(form.unitPriceNet || "0");
  const grossPrice = netPrice * (1 + form.taxRate / 100);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Artikeldatenbank
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {articles.length} Artikel gespeichert — per Klick in Angebote & Rechnungen einfügen
            </p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Artikel
          </Button>
        </div>

        {/* Filter-Leiste */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Artikelnummer, Beschreibung..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Artikel-Liste */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Lade Artikel...</div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Noch keine Artikel angelegt</p>
            <p className="text-sm mt-1">Lege Artikel an und füge sie per Klick in Angebote ein.</p>
            <Button onClick={openNew} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Ersten Artikel anlegen
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Art.-Nr.</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bezeichnung</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kategorie</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">EP netto</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">EP brutto</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Einheit</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">MwSt</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a: any, i: number) => {
                  const net = parseFloat(a.unitPriceNet ?? 0);
                  const gross = net * (1 + (a.taxRate ?? 19) / 100);
                  const active = a.isActive === 1 || a.isActive === true;
                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors group ${!active ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {a.articleNumber || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{a.name}</div>
                        {a.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {a.category ? (
                          <Badge variant="secondary" className="text-xs">{a.category}</Badge>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {net.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {gross.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{a.unit}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{a.taxRate} %</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={active ? "default" : "secondary"} className="text-xs">
                          {active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Duplizieren" onClick={() => openDuplicate(a)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Bearbeiten" onClick={() => openEdit(a)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Löschen"
                            onClick={() => setDeleteId(a.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Artikel-Formular (Sheet) */}
      <Sheet open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditId(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Artikel bearbeiten" : "Neuer Artikel"}</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-6">
            {/* Artikelnummer + Name */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Artikelnummer</Label>
                <Input
                  value={form.articleNumber}
                  onChange={e => set("articleNumber", e.target.value)}
                  placeholder="z.B. ART-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Input
                  value={form.category}
                  onChange={e => set("category", e.target.value)}
                  placeholder="z.B. 3D-Druck, Montage..."
                  list="categories-list"
                />
                <datalist id="categories-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Bezeichnung <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Artikelname / Leistungsbezeichnung"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Kurzbeschreibung</Label>
              <Input
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Erscheint als Zusatzzeile in der Positionsliste"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Detailbeschreibung</Label>
              <Textarea
                value={form.longDescription}
                onChange={e => set("longDescription", e.target.value)}
                placeholder="Technische Details, Hinweise, Spezifikationen..."
                className="min-h-[80px] resize-none"
              />
            </div>

            {/* Preis + Einheit + MwSt */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>EP netto (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unitPriceNet}
                  onChange={e => set("unitPriceNet", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Einheit</Label>
                <Select value={form.unit} onValueChange={v => set("unit", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>MwSt</Label>
                <Select value={String(form.taxRate)} onValueChange={v => set("taxRate", parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_OPTIONS.map(t => (
                      <SelectItem key={t.value} value={String(t.value)}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Brutto-Vorschau */}
            <div className="rounded-md bg-muted/40 px-4 py-3 text-sm flex justify-between items-center">
              <span className="text-muted-foreground">EP brutto (inkl. {form.taxRate} % MwSt):</span>
              <span className="font-semibold text-primary">
                {grossPrice.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={e => set("isActive", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="isActive" className="cursor-pointer">Artikel aktiv (erscheint in der Suche)</Label>
            </div>
          </div>

          <SheetFooter className="px-0 py-4 border-t border-border">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) ? "Speichern..." : "Speichern"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Löschen-Bestätigung */}
      <Dialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Artikel löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Dieser Artikel wird dauerhaft gelöscht. Bereits verwendete Positionen in Angeboten und Rechnungen bleiben erhalten.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMut.mutate({ id: deleteId })}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Löschen..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

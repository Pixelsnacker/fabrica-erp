import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Truck, Star, Mail, Phone, MapPin, Edit2, Trash2, User, Globe,
} from "lucide-react";
import { toast } from "sonner";

type SupplierForm = {
  name: string; company: string;
  email: string; email2: string; email3: string;
  phone: string;
  contact2: string; contact3: string;
  street: string; zip: string; city: string; country: string;
  capabilities: string;
  rating: number;
  notes: string;
  website: string;
};

const EMPTY_FORM: SupplierForm = {
  name: "", company: "",
  email: "", email2: "", email3: "",
  phone: "",
  contact2: "", contact3: "",
  street: "", zip: "", city: "", country: "Deutschland",
  capabilities: "",
  rating: 3,
  notes: "",
  website: "",
};

function SupplierDialog({
  open, onClose, initial, onSave, title, isPending,
}: {
  open: boolean;
  onClose: () => void;
  initial: SupplierForm;
  onSave: (f: SupplierForm) => void;
  title: string;
  isPending: boolean;
}) {
  const [form, setForm] = useState<SupplierForm>(initial);
  const set = (k: keyof SupplierForm, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleOpenChange = (o: boolean) => {
    if (o) setForm(initial);
    else onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Basis */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name / Ansprechpartner 1 *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div className="space-y-1.5">
              <Label>Ansprechpartner 2</Label>
              <Input value={form.contact2} onChange={e => set("contact2", e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Ansprechpartner 3</Label>
              <Input value={form.contact3} onChange={e => set("contact3", e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Firma</Label>
            <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Musterfirma GmbH" />
          </div>

          <Separator />

          {/* Kontakt */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Kontakt</Label>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-Mail 1</Label>
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="info@firma.de" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+49 711 123456" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-Mail 2</Label>
                <Input type="email" value={form.email2} onChange={e => set("email2", e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>E-Mail 3</Label>
                <Input type="email" value={form.email3} onChange={e => set("email3", e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Adresse */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Adresse</Label>
          </div>
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Straße & Hausnummer</Label>
              <Input value={form.street} onChange={e => set("street", e.target.value)} placeholder="Musterstraße 12" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>PLZ</Label>
                <Input value={form.zip} onChange={e => set("zip", e.target.value)} placeholder="12345" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Stadt</Label>
                <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Musterstadt" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Land</Label>
              <Input value={form.country} onChange={e => set("country", e.target.value)} placeholder="Deutschland" />
            </div>
          </div>

          <Separator />

          {/* Fähigkeiten & Bewertung */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label>Fähigkeiten (kommagetrennt)</Label>
              <Input
                value={form.capabilities}
                onChange={e => set("capabilities", e.target.value)}
                placeholder="3D-Druck FDM, CNC, Lackierung"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bewertung: {form.rating}/5</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => set("rating", n)}>
                    <Star className={`h-6 w-6 ${n <= form.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Webseite</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://www.beispiel.de" className="pl-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Interne Anmerkungen..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name || isPending}>
            {isPending ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Suppliers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery();

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      setShowCreate(false);
      toast.success("Lieferant angelegt");
    },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      setEditId(null);
      toast.success("Lieferant gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => {
      utils.suppliers.list.invalidate();
      toast.success("Lieferant gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (s.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    ((s as any).city ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(s.capabilities) ? (s.capabilities as unknown[]).map(String).join(",") : String(s.capabilities ?? "")).toLowerCase().includes(search.toLowerCase())
  );

  const editSupplier = suppliers.find(s => s.id === editId);
  const editInitial: SupplierForm = editSupplier ? {
    name: editSupplier.name ?? "",
    company: editSupplier.company ?? "",
    email: editSupplier.email ?? "",
    email2: (editSupplier as any).email2 ?? "",
    email3: (editSupplier as any).email3 ?? "",
    phone: editSupplier.phone ?? "",
    contact2: (editSupplier as any).contact2 ?? "",
    contact3: (editSupplier as any).contact3 ?? "",
    street: (editSupplier as any).street ?? "",
    zip: (editSupplier as any).zip ?? "",
    city: (editSupplier as any).city ?? "",
    country: (editSupplier as any).country ?? "Deutschland",
    capabilities: Array.isArray(editSupplier.capabilities)
      ? (editSupplier.capabilities as unknown[]).map(String).join(", ")
      : String(editSupplier.capabilities ?? ""),
    rating: editSupplier.rating ?? 3,
    notes: editSupplier.notes ?? "",
    website: (editSupplier as any).website ?? "",
  } : EMPTY_FORM;

  const toMutationInput = (f: SupplierForm) => ({
    name: f.name,
    company: f.company || undefined,
    email: f.email || undefined,
    email2: f.email2 || undefined,
    email3: f.email3 || undefined,
    phone: f.phone || undefined,
    contact2: f.contact2 || undefined,
    contact3: f.contact3 || undefined,
    street: f.street || undefined,
    zip: f.zip || undefined,
    city: f.city || undefined,
    country: f.country || undefined,
    capabilities: f.capabilities ? f.capabilities.split(",").map(c => c.trim()).filter(Boolean) : undefined,
    rating: f.rating,
    notes: f.notes || undefined,
    website: f.website || undefined,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lieferanten</h1>
          <p className="text-muted-foreground text-sm mt-1">{suppliers.length} Lieferanten gesamt</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />Neuer Lieferant
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Lieferant suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Lieferanten...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Truck className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Lieferanten gefunden</p>
          <Button onClick={() => setShowCreate(true)}>Ersten Lieferanten anlegen</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(supplier => {
            const s = supplier as any;
            const hasAddress = s.street || s.city || s.zip;
            const emails = [supplier.email, s.email2, s.email3].filter(Boolean);
            const contacts = [supplier.name, s.contact2, s.contact3].filter(Boolean);
            const caps = Array.isArray(supplier.capabilities)
              ? (supplier.capabilities as unknown[]).map(String).filter(Boolean)
              : String(supplier.capabilities ?? "").split(",").map(c => c.trim()).filter(Boolean);

            return (
              <div
                key={supplier.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, a')) return;
                  setLocation(`/suppliers/${supplier.id}`);
                }}
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-semibold text-sm">{supplier.name.charAt(0).toUpperCase()}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Name + Firma */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{supplier.name}</span>
                    {supplier.company && (
                      <span className="text-sm text-muted-foreground">{supplier.company}</span>
                    )}
                    {!Boolean(supplier.isActive) && (
                      <Badge variant="destructive" className="text-xs">Inaktiv</Badge>
                    )}
                  </div>

                  {/* Weitere Ansprechpartner */}
                  {contacts.length > 1 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {contacts.slice(1).map((ct, i) => (
                        <span key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />{ct}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* E-Mails */}
                  {emails.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {emails.map((em, i) => (
                        <a
                          key={i}
                          href={`mailto:${em}`}
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          <Mail className="h-3 w-3" />{em}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Telefon – klickbar */}
                  {supplier.phone && (
                    <a
                      href={`tel:${supplier.phone.replace(/\s/g, "")}`}
                      className="text-xs text-muted-foreground hover:text-green-400 flex items-center gap-1 w-fit transition-colors"
                    >
                      <Phone className="h-3 w-3" />{supplier.phone}
                    </a>
                  )}

                  {/* Adresse */}
                  {hasAddress && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[s.street, [s.zip, s.city].filter(Boolean).join(" "), s.country !== "Deutschland" ? s.country : ""].filter(Boolean).join(", ")}
                    </div>
                  )}

                  {(s as any).website && (
                    <a
                      href={(s as any).website.startsWith('http') ? (s as any).website : `https://${(s as any).website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-blue-400 flex items-center gap-1 w-fit transition-colors"
                    >
                      <Globe className="h-3 w-3" />{(s as any).website.replace(/^https?:\/\//, '')}
                    </a>
                  )}

                  {/* Fähigkeiten */}
                  {caps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {caps.map((cap: string) => (
                        <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sterne + Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < (supplier.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300"
                      onClick={() => setEditId(supplier.id)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Lieferant "${supplier.name}" wirklich löschen?`)) {
                          deleteMutation.mutate({ id: supplier.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <SupplierDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initial={EMPTY_FORM}
        onSave={(f) => createMutation.mutate(toMutationInput(f))}
        title="Neuen Lieferanten anlegen"
        isPending={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editId !== null && (
        <SupplierDialog
          open={true}
          onClose={() => setEditId(null)}
          initial={editInitial}
          onSave={(f) => updateMutation.mutate({ id: editId, ...toMutationInput(f) })}
          title="Lieferant bearbeiten"
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

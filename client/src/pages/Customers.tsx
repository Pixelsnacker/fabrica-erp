import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Users, Mail, Phone, Building2, MapPin, Edit2, Trash2, User,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  b2b: "B2B", museum: "Museum", industry: "Industrie", private: "Privat", other: "Sonstige",
};

type CustomerForm = {
  name: string; company: string; type: string;
  email: string; email2: string; email3: string;
  phone: string;
  contact2: string; contact3: string;
  street: string; zip: string; city: string; country: string;
  notes: string;
};

const EMPTY_FORM: CustomerForm = {
  name: "", company: "", type: "b2b",
  email: "", email2: "", email3: "",
  phone: "",
  contact2: "", contact3: "",
  street: "", zip: "", city: "", country: "Deutschland",
  notes: "",
};

function CustomerDialog({
  open, onClose, initial, onSave, title, isPending,
}: {
  open: boolean;
  onClose: () => void;
  initial: CustomerForm;
  onSave: (f: CustomerForm) => void;
  title: string;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CustomerForm>(initial);
  const set = (k: keyof CustomerForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Reset form when dialog opens with new initial
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Firma</Label>
              <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Musterfirma GmbH" />
            </div>
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
                <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="max@firma.de" />
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

          {/* Notizen */}
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

export default function Customers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setShowCreate(false);
      toast.success("Kunde angelegt");
    },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setEditId(null);
      toast.success("Kunde gespeichert");
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("Kunde gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const editCustomer = customers.find(c => c.id === editId);
  const editInitial: CustomerForm = editCustomer ? {
    name: editCustomer.name ?? "",
    company: editCustomer.company ?? "",
    type: editCustomer.type ?? "b2b",
    email: editCustomer.email ?? "",
    email2: (editCustomer as any).email2 ?? "",
    email3: (editCustomer as any).email3 ?? "",
    phone: editCustomer.phone ?? "",
    contact2: (editCustomer as any).contact2 ?? "",
    contact3: (editCustomer as any).contact3 ?? "",
    street: (editCustomer as any).street ?? "",
    zip: (editCustomer as any).zip ?? "",
    city: (editCustomer as any).city ?? "",
    country: (editCustomer as any).country ?? "Deutschland",
    notes: editCustomer.notes ?? "",
  } : EMPTY_FORM;

  const handleCreate = (f: CustomerForm) => {
    createMutation.mutate({
      name: f.name,
      company: f.company || undefined,
      type: f.type as any,
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
      notes: f.notes || undefined,
    });
  };

  const handleUpdate = (f: CustomerForm) => {
    if (!editId) return;
    updateMutation.mutate({
      id: editId,
      name: f.name,
      company: f.company || undefined,
      type: f.type as any,
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
      notes: f.notes || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-1">{customers.length} Kunden gesamt</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />Neuer Kunde
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Kunden suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Kunden...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Users className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Kunden gefunden</p>
          <Button onClick={() => setShowCreate(true)}>Ersten Kunden anlegen</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => {
            const c = customer as any;
            const hasAddress = c.street || c.city || c.zip;
            const emails = [customer.email, c.email2, c.email3].filter(Boolean);
            const contacts = [customer.name, c.contact2, c.contact3].filter(Boolean);
            return (
              <div
                key={customer.id}
                className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary font-semibold text-sm">{customer.name.charAt(0).toUpperCase()}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Name + Firma */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{customer.name}</span>
                    {customer.company && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{customer.company}
                      </span>
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
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone.replace(/\s/g, "")}`}
                      className="text-xs text-muted-foreground hover:text-green-400 flex items-center gap-1 w-fit transition-colors"
                    >
                      <Phone className="h-3 w-3" />{customer.phone}
                    </a>
                  )}

                  {/* Adresse */}
                  {hasAddress && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {[c.street, [c.zip, c.city].filter(Boolean).join(" "), c.country !== "Deutschland" ? c.country : ""].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>

                {/* Badge + Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-xs">{TYPE_LABELS[customer.type] ?? customer.type}</Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditId(customer.id)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Kunde "${customer.name}" wirklich löschen?`)) {
                          deleteMutation.mutate({ id: customer.id });
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
      <CustomerDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        initial={EMPTY_FORM}
        onSave={handleCreate}
        title="Neuen Kunden anlegen"
        isPending={createMutation.isPending}
      />

      {/* Edit Dialog */}
      {editId !== null && (
        <CustomerDialog
          open={true}
          onClose={() => setEditId(null)}
          initial={editInitial}
          onSave={handleUpdate}
          title="Kunde bearbeiten"
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}

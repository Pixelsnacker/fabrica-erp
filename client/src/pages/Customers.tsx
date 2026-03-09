import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Users, Mail, Phone, Building2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = { b2b: "B2B", museum: "Museum", industry: "Industrie", private: "Privat", other: "Sonstige" };

export default function Customers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "b2b", email: "", phone: "", company: "", notes: "" });
  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();
  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); setShowCreate(false); setForm({ name: "", type: "b2b", email: "", phone: "", company: "", notes: "" }); toast.success("Kunde angelegt"); },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kunden</h1>
          <p className="text-muted-foreground text-sm mt-1">{customers.length} Kunden gesamt</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Neuer Kunde</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Kunden suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Lade Kunden...</div> : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Users className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Kunden gefunden</p>
          <Button onClick={() => setShowCreate(true)}>Ersten Kunden anlegen</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(customer => (
            <div key={customer.id} className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-sm">{customer.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{customer.name}</span>
                  {customer.company && <span className="text-sm text-muted-foreground">— {customer.company}</span>}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  {customer.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{customer.email}</span>}
                  {customer.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{customer.phone}</span>}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">{TYPE_LABELS[customer.type] ?? customer.type}</Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Neuen Kunden anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Typ</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Firma</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={() => createMutation.mutate({ name: form.name, type: form.type as any, email: form.email || undefined, phone: form.phone || undefined, company: form.company || undefined, notes: form.notes || undefined })} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Wird angelegt..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

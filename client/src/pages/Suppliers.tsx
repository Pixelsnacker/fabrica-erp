import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Truck, Star, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", capabilities: "", rating: 3, notes: "" });
  const utils = trpc.useUtils();
  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery();
  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); setShowCreate(false); setForm({ name: "", email: "", phone: "", capabilities: "", rating: 3, notes: "" }); toast.success("Lieferant angelegt"); },
    onError: () => toast.error("Fehler beim Anlegen"),
  });

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(s.capabilities) ? (s.capabilities as unknown[]).map(String).join(",") : String(s.capabilities ?? "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lieferanten</h1>
          <p className="text-muted-foreground text-sm mt-1">{suppliers.length} Lieferanten gesamt</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Neuer Lieferant</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Lieferant suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Lade Lieferanten...</div> : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Truck className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Lieferanten gefunden</p>
          <Button onClick={() => setShowCreate(true)}>Ersten Lieferanten anlegen</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(supplier => (
            <div key={supplier.id} className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-sm">{supplier.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{supplier.name}</span>
                  {!supplier.isActive && <Badge variant="destructive" className="text-xs">Inaktiv</Badge>}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  {supplier.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{supplier.email}</span>}
                  {supplier.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{supplier.phone}</span>}
                </div>
                {Boolean(supplier.capabilities) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(Array.isArray(supplier.capabilities) ? (supplier.capabilities as unknown[]).map(String) : String(supplier.capabilities ?? "").split(",")).map((cap: string) => cap.trim()).filter(Boolean).map((cap: string) => (
                      <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < (supplier.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Neuen Lieferanten anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Fähigkeiten (kommagetrennt)</Label>
              <Input placeholder="3D-Druck FDM, CNC, Lackierung" value={form.capabilities} onChange={e => setForm(f => ({ ...f, capabilities: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bewertung: {form.rating}/5</Label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, rating: n }))}>
                    <Star className={`h-6 w-6 ${n <= form.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={() => createMutation.mutate({ name: form.name, email: form.email || undefined, phone: form.phone || undefined, capabilities: form.capabilities ? form.capabilities.split(",").map((c: string) => c.trim()).filter(Boolean) : undefined, rating: form.rating, notes: form.notes || undefined })} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Wird angelegt..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

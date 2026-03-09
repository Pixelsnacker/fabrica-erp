import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, TrendingUp, Globe, Megaphone, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  website: "Website", google_ads: "Google Ads", referral: "Empfehlung",
  direct: "Direktkontakt", social: "Social Media", other: "Sonstige",
};
const TYPE_ICONS: Record<string, React.ReactNode> = {
  website: <Globe className="h-4 w-4" />,
  google_ads: <Megaphone className="h-4 w-4" />,
  referral: <Users className="h-4 w-4" />,
  direct: <Users className="h-4 w-4" />,
};

export default function LeadSources() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", type: "website", monthlyCost: "", notes: "" });
  const utils = trpc.useUtils();
  const { data: sources = [], isLoading } = trpc.leadSources.list.useQuery();
  const createMutation = trpc.leadSources.create.useMutation({
    onSuccess: () => { utils.leadSources.list.invalidate(); setShowCreate(false); setForm({ name: "", type: "website", monthlyCost: "", notes: "" }); toast.success("Lead-Quelle angelegt"); },
  });
  const deleteMutation = trpc.leadSources.delete.useMutation({
    onSuccess: () => { utils.leadSources.list.invalidate(); toast.success("Gelöscht"); },
  });

  const totalMonthlyCost = sources.reduce((sum, s) => sum + parseFloat(s.monthlyCost ?? "0"), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead-Quellen</h1>
          <p className="text-muted-foreground text-sm mt-1">Ihre Akquise-Kanäle und deren monatliche Kosten</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Neue Quelle</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Aktive Quellen</div>
          <div className="text-2xl font-bold text-primary">{sources.filter(s => s.isActive).length}</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Monatliche Kosten gesamt</div>
          <div className="text-2xl font-bold text-yellow-400">{totalMonthlyCost.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Lade Quellen...</div> : sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <TrendingUp className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Noch keine Lead-Quellen angelegt</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">Tragen Sie Ihre Akquise-Kanäle ein — Websites, Google Ads, Empfehlungen. Das System trackt, welche Quelle am meisten Umsatz bringt.</p>
          <Button onClick={() => setShowCreate(true)}>Erste Quelle anlegen</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map(source => (
            <div key={source.id} className="flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 transition-all group">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
                {TYPE_ICONS[source.type] ?? <TrendingUp className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{source.name}</span>
                  {!source.isActive && <Badge variant="destructive" className="text-xs">Inaktiv</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="secondary" className="text-xs">{TYPE_LABELS[source.type] ?? source.type}</Badge>
                  {source.notes && <span className="text-xs text-muted-foreground truncate max-w-xs">{source.notes}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-medium text-yellow-400">
                  {parseFloat(source.monthlyCost ?? "0") > 0 ? `${parseFloat(source.monthlyCost ?? "0").toFixed(2)} €/Monat` : "Kostenlos"}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMutation.mutate({ id: source.id })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Neue Lead-Quelle anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input placeholder="z.B. fabrica3d.de, Google Ads Kampagne A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Typ</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Monatliche Kosten (€)</Label><Input type="number" step="0.01" placeholder="0.00" value={form.monthlyCost} onChange={e => setForm(f => ({ ...f, monthlyCost: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={() => createMutation.mutate({ name: form.name, type: form.type as any, monthlyCost: form.monthlyCost || "0", notes: form.notes || undefined })} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Wird angelegt..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_LABELS: Record<string, string> = {
  material: "Material", process: "Verfahren", surface: "Oberfläche",
  reference: "Referenz", sample: "Muster", other: "Sonstige",
};

export default function ImageLibrary() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "material", tags: "", url: "" });
  const utils = trpc.useUtils();
  const { data: images = [], isLoading } = trpc.imageLibrary.list.useQuery({ category: undefined });
  const uploadMutation = trpc.imageLibrary.upload.useMutation({
    onSuccess: () => { utils.imageLibrary.list.invalidate(); setShowCreate(false); setForm({ title: "", description: "", category: "material", tags: "", url: "" }); toast.success("Bild gespeichert"); },
  });
  const createMutation = trpc.imageLibrary.upload.useMutation({
    onSuccess: () => { utils.imageLibrary.list.invalidate(); setShowCreate(false); setForm({ title: "", description: "", category: "material", tags: "", url: "" }); toast.success("Bild gespeichert"); },
  });
  const deleteMutation = trpc.imageLibrary.delete.useMutation({
    onSuccess: () => { utils.imageLibrary.list.invalidate(); toast.success("Bild gelöscht"); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bilddatenbank</h1>
          <p className="text-muted-foreground text-sm mt-1">Referenzbilder für Materialien, Oberflächen und Verfahren</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" />Bild hinzufügen</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Bilder suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Lade Bilder...</div> : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <ImageIcon className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Noch keine Bilder in der Datenbank</p>
          <p className="text-xs text-muted-foreground max-w-sm text-center">Fügen Sie Referenzbilder hinzu — der KI-Assistent kann diese für Kundenpräsentationen auswählen.</p>
          <Button onClick={() => setShowCreate(true)}>Erstes Bild hinzufügen</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(img => (
            <div key={img.id} className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-all">
              <div className="aspect-square bg-secondary flex items-center justify-center overflow-hidden">
                {img.fileUrl ? (
                  <img src={img.fileUrl} alt={img.title} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground opacity-30" />
                )}
              </div>
              <div className="p-2">
                <div className="font-medium text-xs truncate">{img.title}</div>
                <Badge variant="secondary" className="text-xs mt-1">{CATEGORY_LABELS[img.category] ?? img.category}</Badge>
                {img.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{img.description}</p>}
              </div>
              <button
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-destructive/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteMutation.mutate({ id: img.id })}
              >
                <Trash2 className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bild hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titel *</Label><Input placeholder="z.B. Harteloxal Naturgrau" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Bild-URL</Label><Input placeholder="https://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} /></div>
            {form.url && (
              <div className="rounded-lg overflow-hidden border border-border h-32">
                <img src={form.url} alt="Vorschau" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
              </div>
            )}
            <div className="space-y-1.5"><Label>Beschreibung</Label><Textarea placeholder="Wann wird dieses Bild eingesetzt? Welche Eigenschaften zeigt es?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <div className="space-y-1.5"><Label>Tags (kommagetrennt)</Label><Input placeholder="Aluminium, Außenbereich, matt" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            <Button onClick={() => uploadMutation.mutate({ title: form.title, category: form.category as any, filename: form.url || "image.jpg", fileData: form.url || "", description: form.description || undefined, tags: form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined })} disabled={!form.title || uploadMutation.isPending}>
              {createMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

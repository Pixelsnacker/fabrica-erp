import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

const TYPE_LABELS: Record<string, string> = {
  material_advice: "Materialberatung", process_advice: "Verfahrensberatung",
  technical_analysis: "Technische Analyse", offer_discussion: "Angebotsgespräch",
  general: "Allgemein", other: "Sonstige",
};

export default function Consultation() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [, setLocation] = useLocation();
  const { data: consultations = [], isLoading } = trpc.consultation.list.useQuery({});

  const filtered = consultations.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.content.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || c.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Beratungshistorie</h1>
        <p className="text-muted-foreground text-sm mt-1">Alle Beratungseinträge aus allen Projekten</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Beratung suchen..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Alle Typen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="text-muted-foreground text-sm">Lade Einträge...</div> : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Keine Beratungseinträge gefunden</p>
          <p className="text-xs text-muted-foreground">Beratungseinträge werden in den Projekt-Details angelegt</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="p-4 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-all"
              onClick={() => c.projectId && setLocation(`/projects/${c.projectId}`)}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.createdAt).toLocaleDateString("de-DE")}</div>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">{TYPE_LABELS[c.type] ?? c.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{c.content}</p>
              {c.outcome && (
                <div className="mt-2 text-xs text-green-400 border-t border-border pt-2">
                  Ergebnis: {c.outcome}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

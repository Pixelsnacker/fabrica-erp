import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const PRIORITY_CONFIG = {
  critical: { label: "Kritisch", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  high:     { label: "Hoch",     color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  normal:   { label: "Normal",   color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  low:      { label: "Niedrig",  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
} as const;

const STATUS_CONFIG = {
  open:        { label: "Offen",          icon: AlertTriangle, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  in_progress: { label: "In Bearbeitung", icon: Clock,         color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  resolved:    { label: "Gelöst",         icon: CheckCircle2,  color: "bg-green-500/20 text-green-400 border-green-500/30" },
  closed:      { label: "Geschlossen",    icon: XCircle,       color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;
type PriorityKey = keyof typeof PRIORITY_CONFIG;

export default function Complaints() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: complaints = [], isLoading, refetch } = trpc.complaints.listAll.useQuery();

  const updateComplaint = trpc.complaints.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Status aktualisiert"); },
    onError: () => toast.error("Fehler beim Aktualisieren"),
  });

  const filtered = complaints.filter(c => {
    const matchSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.projectTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    const matchPriority = filterPriority === "all" || c.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const openCount = complaints.filter(c => c.status === "open" || c.status === "in_progress").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reklamationen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {complaints.length} gesamt
            {openCount > 0 && (
              <span className="ml-2 text-red-400 font-medium">· {openCount} offen</span>
            )}
          </p>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Reklamation oder Projekt suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="in_progress">In Bearbeitung</SelectItem>
            <SelectItem value="resolved">Gelöst</SelectItem>
            <SelectItem value="closed">Geschlossen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            <SelectItem value="critical">Kritisch</SelectItem>
            <SelectItem value="high">Hoch</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Niedrig</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Lade Reklamationen...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <CheckCircle2 className="w-10 h-10 text-green-500/50" />
          <p className="text-sm">
            {complaints.length === 0 ? "Keine Reklamationen vorhanden." : "Keine Einträge für den gewählten Filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const status = STATUS_CONFIG[c.status as StatusKey] ?? STATUS_CONFIG.open;
            const priority = PRIORITY_CONFIG[c.priority as PriorityKey] ?? PRIORITY_CONFIG.normal;
            const StatusIcon = status.icon;
            const isExpanded = expandedId === c.id;

            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card overflow-hidden transition-all"
              >
                {/* Hauptzeile */}
                <div className="flex items-start gap-3 p-4">
                  {/* Prioritäts-Indikator */}
                  <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    c.priority === "critical" ? "bg-red-500" :
                    c.priority === "high" ? "bg-orange-400" :
                    c.priority === "normal" ? "bg-yellow-400" : "bg-blue-400"
                  }`} style={{ marginTop: "6px" }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground truncate">{c.title}</span>
                      <Badge variant="outline" className={`text-xs ${priority.color}`}>
                        {priority.label}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${status.color}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {c.projectTitle && (
                        <button
                          onClick={() => navigate(`/projects/${c.projectId}`)}
                          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {c.projectNumber ? `${c.projectNumber} · ` : ""}{c.projectTitle}
                        </button>
                      )}
                      <span>{new Date(c.createdAt ?? "").toLocaleDateString("de-DE")}</span>
                      {c.resolvedAt && (
                        <span className="text-green-400">
                          Gelöst: {new Date(c.resolvedAt).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Aktionen rechts */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status schnell ändern */}
                    <Select
                      value={c.status}
                      onValueChange={val => updateComplaint.mutate({ id: c.id, status: val as StatusKey })}
                    >
                      <SelectTrigger className="h-7 text-xs w-36 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Offen</SelectItem>
                        <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                        <SelectItem value="resolved">Gelöst</SelectItem>
                        <SelectItem value="closed">Geschlossen</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Erweiterte Details */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3 bg-muted/20">
                    {c.description && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Beschreibung</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{c.description}</p>
                      </div>
                    )}
                    {c.resolution && (
                      <div>
                        <p className="text-xs font-medium text-green-400 mb-1">Lösung</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{c.resolution}</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => navigate(`/projects/${c.projectId}`)}
                    >
                      <ExternalLink className="w-3 h-3 mr-1.5" />
                      Im Projekt öffnen
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Star,
  FileText, FileArchive, FileCheck, FileX, File,
  ExternalLink, Download, FolderOpen, Calendar,
} from "lucide-react";

// ─── Kategorie-Labels & Icons ─────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  supplier_offer:  { label: "Lieferantenangebot", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",   Icon: FileText },
  nda:             { label: "Geheimhaltung (NDA)", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", Icon: FileCheck },
  order:           { label: "Bestellung",          color: "bg-green-500/15 text-green-400 border-green-500/30",   Icon: FileArchive },
  delivery_note:   { label: "Lieferschein",        color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",     Icon: FileText },
  invoice:         { label: "Eingangsrechnung",    color: "bg-orange-500/15 text-orange-400 border-orange-500/30", Icon: FileText },
  contract:        { label: "Vertrag",             color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", Icon: FileCheck },
  drawing:         { label: "Zeichnung",           color: "bg-pink-500/15 text-pink-400 border-pink-500/30",     Icon: File },
  other:           { label: "Sonstiges",           color: "bg-muted text-muted-foreground border-border",        Icon: File },
};

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Dokument-Karte ───────────────────────────────────────────────────────────
function DocCard({ doc, onProjectClick }: {
  doc: any;
  onProjectClick: (projectId: number) => void;
}) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const Icon = meta.Icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:border-primary/40 transition-all group">
      <div className="mt-0.5 p-2 rounded-md bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium truncate hover:text-primary transition-colors flex items-center gap-1"
          >
            {doc.filename}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </a>
          <a
            href={doc.fileUrl}
            download={doc.filename}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Herunterladen"
          >
            <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${meta.color}`}>
            {meta.label}
          </Badge>
          <button
            onClick={() => onProjectClick(doc.projectId)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <FolderOpen className="h-3 w-3" />
            {doc.projectTitle}
          </button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(doc.createdAt)}
          </span>
          {doc.fileSize && (
            <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
          )}
        </div>
        {doc.notes && (
          <p className="mt-1 text-xs text-muted-foreground italic">{doc.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
export default function SupplierDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const { data: supplier, isLoading: loadingSupplier } = trpc.suppliers.byId.useQuery({ id });
  const { data: docs = [], isLoading: loadingDocs } = trpc.projectDocs.bySupplier.useQuery({ supplierId: id });

  // Dokumente nach Projekt gruppieren
  const grouped = (docs as any[]).reduce((acc: Record<string, any[]>, doc: any) => {
    const key = `${doc.projectId}__${doc.projectTitle}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const categoryCount = (docs as any[]).reduce((acc: Record<string, number>, doc: any) => {
    acc[doc.category] = (acc[doc.category] ?? 0) + 1;
    return acc;
  }, {});

  if (loadingSupplier) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Lieferant nicht gefunden.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/suppliers")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Zurück zur Liste
        </Button>
      </div>
    );
  }

  const s = supplier as any;
  const displayName = s.company ? `${s.company}` : s.name;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/suppliers")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />Lieferanten
        </Button>
      </div>

      {/* Lieferanten-Stammdaten */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold">{displayName}</h1>
                {s.company && s.name !== s.company && (
                  <span className="text-sm text-muted-foreground">({s.name})</span>
                )}
                {/* Bewertung */}
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= (s.rating ?? 3) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <Badge variant={s.active ? "default" : "secondary"} className="text-xs">
                  {s.active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </div>

              {/* Kontaktdaten */}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
                {s.email && (
                  <a href={`mailto:${s.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Mail className="h-3.5 w-3.5" />{s.email}
                  </a>
                )}
                {s.email2 && (
                  <a href={`mailto:${s.email2}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Mail className="h-3.5 w-3.5" />{s.email2}
                  </a>
                )}
                {s.phone && (
                  <a href={`tel:${s.phone.replace(/\s/g,"")}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                    <Phone className="h-3.5 w-3.5" />{s.phone}
                  </a>
                )}
                {(s.street || s.city) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {[s.street, s.zip, s.city, s.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>

              {/* Fähigkeiten */}
              {s.capabilities && s.capabilities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.capabilities.map((c: string) => (
                    <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
              )}

              {/* Notizen */}
              {s.notes && (
                <p className="mt-3 text-sm text-muted-foreground italic border-l-2 border-border pl-3">{s.notes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dokumente-Statistik */}
      {(docs as any[]).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(categoryCount).map(([cat, count]) => {
            const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;
            const Icon = meta.Icon;
            return (
              <div key={cat} className={`flex items-center gap-2 p-3 rounded-lg border ${meta.color}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs font-medium leading-tight">{meta.label}</p>
                  <p className="text-lg font-bold leading-tight">{count as number}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dokumente nach Projekt gruppiert */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Alle Dokumente
            {(docs as any[]).length > 0 && (
              <Badge variant="secondary" className="ml-1">{(docs as any[]).length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
            </div>
          ) : (docs as any[]).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <FileX className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Noch keine Dokumente für diesen Lieferanten hochgeladen.</p>
              <p className="text-xs mt-1">Dokumente können im Projekt-Detail unter dem Tab „Dokumente" hochgeladen werden.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([key, groupDocs]) => {
                const [projectIdStr, projectTitle] = key.split("__");
                const projectId = parseInt(projectIdStr);
                return (
                  <div key={key}>
                    <button
                      onClick={() => setLocation(`/projects/${projectId}`)}
                      className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors mb-2 group"
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      {projectTitle}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                    <div className="space-y-2 pl-2 border-l-2 border-border">
                      {(groupDocs as any[]).map((doc: any) => (
                        <DocCard
                          key={doc.id}
                          doc={doc}
                          onProjectClick={(pid) => setLocation(`/projects/${pid}`)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

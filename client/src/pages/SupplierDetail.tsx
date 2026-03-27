import React, { useRef, useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Star,
  FileText, FileArchive, FileCheck, FileX, File,
  ExternalLink, Download, FolderOpen, Calendar,
  Upload, Plus, Trash2, Pencil, RefreshCw, CloudOff, Cloud,
} from "lucide-react";

// ─── Kategorie-Labels & Icons ─────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  supplier_offer:  { label: "Lieferantenangebot", color: "bg-blue-500/15 text-blue-400 border-blue-500/30",   Icon: FileText },
  nda:             { label: "Geheimhaltung (NDA)", color: "bg-purple-500/15 text-purple-400 border-purple-500/30", Icon: FileCheck },
  contract:        { label: "Vertrag",             color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", Icon: FileCheck },
  order:           { label: "Bestellung",          color: "bg-green-500/15 text-green-400 border-green-500/30",   Icon: FileArchive },
  delivery_note:   { label: "Lieferschein",        color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",     Icon: FileText },
  invoice:         { label: "Eingangsrechnung",    color: "bg-orange-500/15 text-orange-400 border-orange-500/30", Icon: FileText },
  drawing:         { label: "Zeichnung",           color: "bg-pink-500/15 text-pink-400 border-pink-500/30",     Icon: File },
  cad_data:        { label: "CAD-Daten",           color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30", Icon: File },
  photo:           { label: "Foto",                color: "bg-teal-500/15 text-teal-400 border-teal-500/30",     Icon: File },
  protocol:        { label: "Protokoll",           color: "bg-rose-500/15 text-rose-400 border-rose-500/30",     Icon: FileText },
  other:           { label: "Sonstiges",           color: "bg-muted text-muted-foreground border-border",        Icon: File },
};

const CATEGORY_OPTIONS = [
  { value: "nda",           label: "Geheimhaltung (NDA)" },
  { value: "contract",      label: "Vertrag / Rahmenvertrag" },
  { value: "supplier_offer",label: "Lieferantenangebot" },
  { value: "invoice",       label: "Eingangsrechnung" },
  { value: "delivery_note", label: "Lieferschein" },
  { value: "drawing",       label: "Zeichnung" },
  { value: "cad_data",      label: "CAD-Daten" },
  { value: "photo",         label: "Foto" },
  { value: "protocol",      label: "Protokoll" },
  { value: "other",         label: "Sonstiges" },
];

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Projekt-Dokument-Karte (mit Projektlink) ─────────────────────────────────
function ProjectDocCard({ doc, onProjectClick }: {
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

// ─── Lieferanten-Dokument-Karte (direkt am Lieferanten) ──────────────────────
function SupplierDocCard({ doc, supplierId, onDelete, onEditNote, onSynced }: {
  doc: any;
  supplierId: number;
  onDelete: (id: number) => void;
  onEditNote: (doc: any) => void;
  onSynced: () => void;
}) {
  const meta = CATEGORY_META[doc.category] ?? CATEGORY_META.other;
  const Icon = meta.Icon;
  const isSynced = doc.driveSynced === 1 || doc.driveSynced === true;

  const syncMut = trpc.supplierDocs.syncToDrive.useMutation({
    onSuccess: (result) => {
      toast.success(
        <span className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-green-400" />
          In Drive gespeichert
          {result.driveUrl && (
            <a href={result.driveUrl} target="_blank" rel="noopener noreferrer"
               className="underline text-primary ml-1">Öffnen</a>
          )}
        </span>
      );
      onSynced();
    },
    onError: (e) => toast.error(`Drive-Sync fehlgeschlagen: ${e.message}`),
  });

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
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => onEditNote(doc)} title="Notiz bearbeiten">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
            </button>
            <a href={doc.fileUrl} download={doc.filename} title="Herunterladen">
              <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
            </a>
            {!isSynced && (
              <button
                onClick={() => syncMut.mutate({ id: doc.id })}
                disabled={syncMut.isPending}
                title="Mit Google Drive synchronisieren"
              >
                {syncMut.isPending
                  ? <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                  : <CloudOff className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-400" />}
              </button>
            )}
            <button onClick={() => onDelete(doc.id)} title="Löschen">
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${meta.color}`}>
            {meta.label}
          </Badge>
          {/* Drive-Status */}
          {isSynced ? (
            <a
              href={`https://drive.google.com/file/d/${doc.driveFileId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
              title="In Google Drive öffnen"
            >
              <Cloud className="h-3 w-3" />Drive
            </a>
          ) : (
            <button
              onClick={() => syncMut.mutate({ id: doc.id })}
              disabled={syncMut.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-400 transition-colors"
              title="Jetzt mit Drive synchronisieren"
            >
              {syncMut.isPending
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <CloudOff className="h-3 w-3" />}
              {syncMut.isPending ? "Sync..." : "Nicht in Drive"}
            </button>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(doc.createdAt)}
          </span>
          {doc.fileSize && (
            <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
          )}
          {doc.uploadedBy && (
            <span className="text-xs text-muted-foreground">von {doc.uploadedBy}</span>
          )}
          {/* Ablaufdatum-Badge */}
          {doc.expiresAt && (() => {
            const now = Date.now();
            const diff = doc.expiresAt - now;
            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
            const isExpired = diff < 0;
            const isSoon = !isExpired && daysLeft <= 30;
            return (
              <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border ${
                isExpired
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : isSoon
                  ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                <Calendar className="h-3 w-3" />
                {isExpired
                  ? `Abgelaufen (${formatDate(doc.expiresAt)})`
                  : isSoon
                  ? `Läuft ab in ${daysLeft}d`
                  : `Gültig bis ${formatDate(doc.expiresAt)}`
                }
              </span>
            );
          })()}
        </div>
        {doc.notes && (
          <p className="mt-1 text-xs text-muted-foreground italic border-l-2 border-border pl-2">{doc.notes}</p>
        )}
      </div>
    </div>
  );
}

// ─── Upload-Dialog ────────────────────────────────────────────────────────────
function UploadDialog({ supplierId, open, onClose }: {
  supplierId: number;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<string>("other");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState(""); // ISO date string YYYY-MM-DD
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMut = trpc.supplierDocs.upload.useMutation({
    onSuccess: () => {
      utils.supplierDocs.list.invalidate({ supplierId });
      toast.success("Dokument hochgeladen");
      setSelectedFile(null);
      setNotes("");
      setCategory("other");
      setExpiresAt("");
      onClose();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handleUpload = async () => {
    if (!selectedFile) { toast.error("Bitte eine Datei auswählen"); return; }
    if (selectedFile.size > 20 * 1024 * 1024) { toast.error("Datei zu groß (max. 20 MB)"); return; }
    setUploading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      await uploadMut.mutateAsync({
        supplierId,
        category: category as any,
        filename: selectedFile.name,
        fileBase64: base64,
        mimeType: selectedFile.type || "application/octet-stream",
        notes: notes.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : undefined,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Datei</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {selectedFile ? (
                <div className="space-y-1">
                  <File className="h-8 w-8 mx-auto text-primary" />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Klicken oder Datei hierher ziehen</p>
                  <p className="text-xs text-muted-foreground">PDF, Word, Excel, Bilder — max. 20 MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip,.txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Ablaufdatum – nur bei NDA und Vertrag sinnvoll, aber für alle verfügbar */}
          <div className="space-y-1.5">
            <Label>Ablaufdatum (optional)</Label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">Für NDAs und Verträge — wird als Warnung auf dem Dashboard angezeigt</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notiz (optional)</Label>
            <Textarea
              placeholder="z.B. Unterzeichnet von ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>Abbrechen</Button>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
            {uploading ? "Wird hochgeladen..." : "Hochladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notiz-Bearbeiten-Dialog ──────────────────────────────────────────────────
function EditNoteDialog({ doc, supplierId, open, onClose }: {
  doc: any | null;
  supplierId: number;
  open: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState(doc?.notes ?? "");
  const [expiresAt, setExpiresAt] = useState(
    doc?.expiresAt ? new Date(doc.expiresAt).toISOString().split('T')[0] : ""
  );

  // Sync wenn doc sich ändert (beim Öffnen)
  useEffect(() => {
    if (doc) {
      setNotes(doc.notes ?? "");
      setExpiresAt(doc.expiresAt ? new Date(doc.expiresAt).toISOString().split('T')[0] : "");
    }
  }, [doc?.id]);

  const updateMut = trpc.supplierDocs.updateNote.useMutation({
    onSuccess: () => {
      utils.supplierDocs.list.invalidate({ supplierId });
      toast.success("Gespeichert");
      onClose();
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Dokument bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Ablaufdatum (optional)</Label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {expiresAt && (
              <button
                type="button"
                onClick={() => setExpiresAt("")}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Ablaufdatum entfernen
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Textarea
              placeholder="Notiz zum Dokument..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            onClick={() => doc && updateMut.mutate({
              id: doc.id,
              notes,
              expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
            })}
            disabled={updateMut.isPending}
          >
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
export default function SupplierDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"info" | "docs" | "project-docs">("info");
  const [showUpload, setShowUpload] = useState(false);
  const [editNoteDoc, setEditNoteDoc] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: supplier, isLoading: loadingSupplier } = trpc.suppliers.byId.useQuery({ id });
  const { data: projectDocs = [], isLoading: loadingProjectDocs } = trpc.projectDocs.bySupplier.useQuery({ supplierId: id });
  const { data: supplierDocs = [], isLoading: loadingSupplierDocs } = trpc.supplierDocs.list.useQuery({ supplierId: id });

  const deleteMut = trpc.supplierDocs.delete.useMutation({
    onSuccess: () => {
      utils.supplierDocs.list.invalidate({ supplierId: id });
      toast.success("Dokument gelöscht");
      setDeleteId(null);
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  // Projekt-Dokumente nach Projekt gruppieren
  const grouped = (projectDocs as any[]).reduce((acc: Record<string, any[]>, doc: any) => {
    const key = `${doc.projectId}__${doc.projectTitle}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  // Kategorie-Statistik für Lieferanten-Dokumente
  const categoryCount = (supplierDocs as any[]).reduce((acc: Record<string, number>, doc: any) => {
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
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`h-3.5 w-3.5 ${n <= (s.rating ?? 3) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <Badge variant={s.active ? "default" : "secondary"} className="text-xs">
                  {s.active ? "Aktiv" : "Inaktiv"}
                </Badge>
              </div>

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

              {s.capabilities && s.capabilities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.capabilities.map((c: string) => (
                    <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                  ))}
                </div>
              )}

              {s.notes && (
                <p className="mt-3 text-sm text-muted-foreground italic border-l-2 border-border pl-3">{s.notes}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab-Navigation */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("info")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "info"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Übersicht
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "docs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Dokumente
          {(supplierDocs as any[]).length > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1.5">
              {(supplierDocs as any[]).length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("project-docs")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === "project-docs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Projekt-Dokumente
          {(projectDocs as any[]).length > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1.5">
              {(projectDocs as any[]).length}
            </Badge>
          )}
        </button>
      </div>

      {/* Tab: Übersicht */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Dokumente (direkt)</p>
                <p className="text-2xl font-bold mt-1">{(supplierDocs as any[]).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Projekt-Dokumente</p>
                <p className="text-2xl font-bold mt-1">{(projectDocs as any[]).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">Bewertung</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`h-5 w-5 ${n <= (s.rating ?? 3) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            Wechsle zum Tab <strong>Dokumente</strong>, um NDAs, Verträge und andere Unterlagen direkt an diesem Lieferanten zu hinterlegen.
          </p>
        </div>
      )}

      {/* Tab: Direkte Lieferanten-Dokumente */}
      {activeTab === "docs" && (
        <div className="space-y-4">
          {/* Kategorie-Statistik */}
          {Object.keys(categoryCount).length > 0 && (
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

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Dokumente
                  {(supplierDocs as any[]).length > 0 && (
                    <Badge variant="secondary" className="ml-1">{(supplierDocs as any[]).length}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />Hochladen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSupplierDocs ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
                </div>
              ) : (supplierDocs as any[]).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileX className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Noch keine Dokumente hinterlegt</p>
                  <p className="text-xs mt-1 mb-4">NDAs, Rahmenverträge und andere Unterlagen direkt hier hochladen.</p>
                  <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5">
                    <Upload className="h-4 w-4" />Erstes Dokument hochladen
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(supplierDocs as any[]).map((doc: any) => (
                    <SupplierDocCard
                      key={doc.id}
                      doc={doc}
                      supplierId={id}
                      onDelete={(docId) => setDeleteId(docId)}
                      onEditNote={(d) => setEditNoteDoc(d)}
                      onSynced={() => utils.supplierDocs.list.invalidate({ supplierId: id })}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Projekt-Dokumente */}
      {activeTab === "project-docs" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projekt-Dokumente
              {(projectDocs as any[]).length > 0 && (
                <Badge variant="secondary" className="ml-1">{(projectDocs as any[]).length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProjectDocs ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}
              </div>
            ) : (projectDocs as any[]).length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileX className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Noch keine Projekt-Dokumente für diesen Lieferanten.</p>
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
                          <ProjectDocCard
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
      )}

      {/* Upload-Dialog */}
      <UploadDialog
        supplierId={id}
        open={showUpload}
        onClose={() => setShowUpload(false)}
      />

      {/* Notiz-Bearbeiten-Dialog */}
      <EditNoteDialog
        doc={editNoteDoc}
        supplierId={id}
        open={editNoteDoc !== null}
        onClose={() => setEditNoteDoc(null)}
      />

      {/* Löschen-Bestätigung */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Dokument wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMut.mutate({ id: deleteId })}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

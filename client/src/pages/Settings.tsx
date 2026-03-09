import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Download, Trash2, MessageCircle, Phone, UserCheck, Mail, MoreHorizontal, Zap, Database, Shield } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const SOURCE_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  telefon: Phone,
  persoenlich: UserCheck,
  email: Mail,
  sonstiges: MoreHorizontal,
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telefon: "Telefon",
  persoenlich: "Persönlich",
  email: "E-Mail",
  sonstiges: "Sonstiges",
};

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "bg-green-500/10 text-green-400 border-green-500/20",
  telefon: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  persoenlich: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  email: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  sonstiges: "bg-muted text-muted-foreground border-border",
};

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const { data: quickNotesList, isLoading } = trpc.quickNotes.list.useQuery();
  const utils = trpc.useUtils();
  const deleteNote = trpc.quickNotes.delete.useMutation({
    onSuccess: () => {
      toast.success("Notiz gelöscht");
      utils.quickNotes.list.invalidate();
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/trpc/export.full", {
        credentials: "include",
      });
      const json = await response.json();
      const data = json?.result?.data ?? json;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fabrica-erp-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export erfolgreich heruntergeladen");
    } catch {
      toast.error("Fehler beim Export");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Einstellungen</h1>
          <p className="text-muted-foreground mt-1">Datensicherung und Schnellnotizen verwalten</p>
        </div>

        {/* Datensicherung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Datensicherung
            </CardTitle>
            <CardDescription>
              Exportieren Sie alle Ihre Daten als JSON-Datei zur lokalen Sicherung.
              Empfehlung: einmal pro Woche herunterladen und in Google Drive speichern.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Database className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">Vollständiger Daten-Export</p>
                  <p className="text-sm text-muted-foreground">
                    Projekte, Kunden, Lieferanten, Beratungshistorie, Materialien, Wissensdatenbank
                  </p>
                </div>
              </div>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exportiere..." : "Jetzt exportieren"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Die exportierte JSON-Datei enthält alle Ihre Daten und kann bei Bedarf auf einem anderen System eingespielt werden.
              Ihr Code ist zusätzlich über den GitHub-Export in den Manus-Einstellungen sicherbar.
            </p>
          </CardContent>
        </Card>

        {/* Schnellnotizen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Schnellnotizen
            </CardTitle>
            <CardDescription>
              Alle gespeicherten Schnellnotizen aus WhatsApp, Telefon und persönlichen Gesprächen.
              Verwenden Sie den gelben "Schnellnotiz"-Button oben rechts, um neue Notizen zu erfassen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Lade Notizen...</div>
            ) : !quickNotesList || quickNotesList.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground">Noch keine Schnellnotizen vorhanden.</p>
                <p className="text-sm text-muted-foreground">
                  Klicken Sie auf den gelben "Schnellnotiz"-Button oben rechts, um eine Notiz zu erfassen.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {quickNotesList.map((note: any) => {
                  const SourceIcon = SOURCE_ICONS[note.source] ?? MoreHorizontal;
                  return (
                    <div
                      key={note.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors group"
                    >
                      <SourceIcon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed">{note.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${SOURCE_COLORS[note.source]}`}>
                            {SOURCE_LABELS[note.source]}
                          </span>
                          {note.projectId && (
                            <span className="text-xs text-muted-foreground">Projekt #{note.projectId}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(note.createdAt).toLocaleString("de-DE", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit"
                            })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteNote.mutate({ id: note.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

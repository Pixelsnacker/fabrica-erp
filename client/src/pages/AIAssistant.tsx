import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Send, Copy, Mail, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

const QUICK_PROMPTS = [
  "Welches Material empfiehlst du für ein Außenmodell in einer Gedenkstätte?",
  "Vergleiche Harteloxal vs. VeroMetal für Aluminium-Bauteile",
  "Welche Oberflächen eignen sich für Museumsmodelle mit Berührungsschutz?",
  "Erstelle einen Beratungstext für FDM vs. SLA Druck",
  "Welche Lieferanten haben CNC-Fähigkeiten in meiner Datenbank?",
];

export default function AIAssistant() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ text: string; sessionId?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: sessions = [] } = trpc.ai.sessions.useQuery({ projectId: undefined });

  const generateMutation = trpc.ai.generate.useMutation({
    onSuccess: (data: { text: string; sessionId?: number }) => {
      setResult({ text: data.text, sessionId: data.sessionId });
      setIsLoading(false);
    },
    onError: () => {
      toast.error("Fehler beim Generieren");
      setIsLoading(false);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setResult(null);
    generateMutation.mutate({ prompt, includeSignature: false });
  };

  const handleCopy = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      toast.success("Text kopiert");
    }
  };

  const handleCopyWithSignature = () => {
    if (result?.text) {
      const signature = `\n\nMit freundlichen Grüßen / Best Regards\n\nDaniel Rincón\nFabrica GmbH\nHüttenstraße 205, 50170 Kerpen-Sindorf\nTel.: +49(0)2273-9529429 | Mobil: +49(0)170/8342238\nd.rincon@fabrica3d.eu | www.fabrica3d.de`;
      navigator.clipboard.writeText(result.text + signature);
      toast.success("Text mit Signatur kopiert");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" /> KI-Assistent
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Nutzt Ihre Wissensdatenbank, Materialien und Beratungshistorie für präzise Empfehlungen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Prompts */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Schnellauswahl:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => setPrompt(p)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/10 transition-all text-muted-foreground hover:text-foreground">
                  {p.length > 50 ? p.slice(0, 50) + "..." : p}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Textarea
              placeholder="Beschreiben Sie Ihre Anfrage... z.B. 'Kunde fragt nach Oberflächenbehandlung für Aluminium-Modell, Außenbereich, Museum, Bronze-Optik gewünscht'"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleGenerate(); }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Strg+Enter zum Senden</span>
              <Button onClick={handleGenerate} disabled={!prompt.trim() || isLoading} className="gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isLoading ? "Generiert..." : "Beratung generieren"}
              </Button>
            </div>
          </div>

          {/* Result */}
          {isLoading && (
            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">KI analysiert Ihre Wissensdatenbank...</span>
              </CardContent>
            </Card>
          )}

          {result && !isLoading && (
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">KI-Beratungstext</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 text-xs">
                      <Copy className="h-3.5 w-3.5" /> Kopieren
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopyWithSignature} className="gap-2 text-xs">
                      <Mail className="h-3.5 w-3.5" /> Mit Signatur
                    </Button>
                  </div>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{result.text}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Session History */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Letzte Beratungen</h3>
          {sessions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">Noch keine Beratungen</div>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 10).map(session => (
                <div key={session.id}
                  className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-all"
                  onClick={() => setResult({ text: (session as any).result ?? "" })}>
                  <div className="text-xs font-medium line-clamp-2">{(session as any).prompt}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date((session as any).createdAt).toLocaleDateString("de-DE")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

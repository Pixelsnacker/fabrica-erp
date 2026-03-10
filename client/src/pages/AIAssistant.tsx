import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bot, Send, Copy, Mail, Loader2, Sparkles, Database, Clock, ChevronRight, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── Schnellbefehle nach Kategorie ───────────────────────────────────────────
const QUICK_PROMPTS_TECH = [
  "Welches Material empfiehlst du für ein Außenmodell in einer Gedenkstätte?",
  "Vergleiche Harteloxal vs. VeroMetal für Aluminium-Bauteile",
  "Welche Oberflächen eignen sich für Museumsmodelle mit Berührungsschutz?",
  "Erstelle einen Beratungstext für FDM vs. SLA Druck",
];

const QUICK_PROMPTS_ERP = [
  "Zeige mir alle offenen Rechnungen und den Gesamtbetrag",
  "Welche Projekte sind aktuell aktiv und was ist der Status?",
  "Was steht diese Woche im Kalender an?",
  "Erstelle eine Zusammenfassung meiner letzten 5 Kunden",
  "Welche Rechnungen sind überfällig?",
  "Wie ist mein aktueller Umsatz diesen Monat?",
];

export default function AIAssistant() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [includeErpContext, setIncludeErpContext] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [activeTab, setActiveTab] = useState<'tech' | 'erp'>('tech');

  const { data: sessions = [] } = trpc.ai.sessions.useQuery({ projectId: undefined });

  const generateMutation = trpc.ai.generate.useMutation({
    onSuccess: (data: { text: string }) => {
      setResult({ text: data.text });
      setIsLoading(false);
    },
    onError: (e) => {
      toast.error(`Fehler: ${e.message}`);
      setIsLoading(false);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setResult(null);
    generateMutation.mutate({ prompt, includeSignature, includeErpContext });
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

  const quickPrompts = activeTab === 'erp' ? QUICK_PROMPTS_ERP : QUICK_PROMPTS_TECH;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> KI-Assistent
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Nutzt Wissensdatenbank, Materialien und ERP-Daten für präzise Antworten
          </p>
        </div>
        {/* ERP-Kontext Toggle */}
        <div className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5">
          <Database className={`h-4 w-4 ${includeErpContext ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <Label htmlFor="erp-toggle" className="text-sm font-medium cursor-pointer">ERP-Kontext</Label>
            <p className="text-xs text-muted-foreground">Kunden, Projekte, Rechnungen, Termine</p>
          </div>
          <Switch
            id="erp-toggle"
            checked={includeErpContext}
            onCheckedChange={(v) => {
              setIncludeErpContext(v);
              if (v) setActiveTab('erp');
              else setActiveTab('tech');
            }}
          />
        </div>
      </div>

      {/* ERP-Kontext Hinweis */}
      {includeErpContext && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-sm">
          <LayoutDashboard className="h-4 w-4 text-primary shrink-0" />
          <span className="text-primary font-medium">ERP-Kontext aktiv</span>
          <span className="text-muted-foreground">— Die KI kennt deine aktuellen Kunden, Projekte, Rechnungen und Kalendertermine.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat */}
        <div className="lg:col-span-2 space-y-4">

          {/* Schnellbefehle Tabs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => { setActiveTab('tech'); }}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${activeTab === 'tech' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
              >
                Technische Beratung
              </button>
              <button
                onClick={() => { setActiveTab('erp'); setIncludeErpContext(true); }}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${activeTab === 'erp' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
              >
                ERP-Abfragen
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map(p => (
                <button
                  key={p}
                  onClick={() => { setPrompt(p); if (activeTab === 'erp') setIncludeErpContext(true); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-primary/10 transition-all text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  {p.length > 55 ? p.slice(0, 55) + "..." : p}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Textarea
              placeholder={includeErpContext
                ? "Frage zu deinen ERP-Daten... z.B. 'Welche Rechnungen sind überfällig?' oder 'Was steht diese Woche an?'"
                : "Beschreibe deine Anfrage... z.B. 'Kunde fragt nach Oberflächenbehandlung für Aluminium-Modell, Außenbereich, Museum'"
              }
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleGenerate(); }}
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground">Strg+Enter zum Senden</span>
                <div className="flex items-center gap-2">
                  <Switch id="sig-toggle" checked={includeSignature} onCheckedChange={setIncludeSignature} />
                  <Label htmlFor="sig-toggle" className="text-xs cursor-pointer">Mit Signatur</Label>
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={!prompt.trim() || isLoading} className="gap-2">
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysiert...</>
                  : <><Sparkles className="h-4 w-4" /> {includeErpContext ? 'ERP-Abfrage starten' : 'Beratung generieren'}</>
                }
              </Button>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <Card className="bg-card border-border">
              <CardContent className="p-6 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">
                  {includeErpContext ? 'KI liest ERP-Daten und analysiert...' : 'KI analysiert Wissensdatenbank...'}
                </span>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {result && !isLoading && (
            <Card className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">KI-Antwort</span>
                    {includeErpContext && (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        <Database className="w-3 h-3 mr-1" /> ERP-Kontext
                      </Badge>
                    )}
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
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" /> Letzte Abfragen
          </h3>
          {sessions.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
              Noch keine Abfragen
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 12).map((session: any) => (
                <div
                  key={session.id}
                  className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-all"
                  onClick={() => setResult({ text: session.result ?? session.generatedText ?? "" })}
                >
                  <div className="text-xs font-medium line-clamp-2">{session.prompt}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(session.createdAt).toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, Send, Copy, Loader2, Sparkles, Database, Trash2, Check,
  ChevronDown, ChevronUp, FileText, ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  copied?: boolean;
};

const QUICK_PROMPTS = [
  { label: "3D-Druck Materialvergleich", prompt: "Vergleiche PLA, PETG und ASA für Außenanwendungen in einer Tabelle" },
  { label: "Angebots-E-Mail", prompt: "Formuliere eine professionelle Angebots-E-Mail für einen Neukunden im Bereich 3D-Druck" },
  { label: "Offene Projekte", prompt: "Zeige mir alle offenen Projekte und deren aktuellen Status" },
  { label: "Preiskalkulation", prompt: "Erkläre mir wie ich eine Preiskalkulation für einen 3D-Druck-Auftrag aufbaue (Material, Zeit, Overhead, Marge)" },
  { label: "NDA-Vorlage", prompt: "Erstelle eine kurze Geheimhaltungsvereinbarung (NDA) für einen Lieferanten auf Deutsch" },
  { label: "Reklamation beantworten", prompt: "Formuliere eine professionelle Antwort auf eine Kundenreklamation wegen Lieferverzug" },
  { label: "Überfällige Rechnungen", prompt: "Welche Rechnungen sind aktuell offen oder überfällig?" },
  { label: "Lieferanten vergleichen", prompt: "Zeige mir alle Lieferanten und ihre Fähigkeiten in einer Übersicht" },
];

function ChatBubble({ msg, onCopy }: { msg: ChatMessage; onCopy: (id: string, text: string) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
        isUser ? "bg-primary/20 text-primary" : "bg-emerald-500/20 text-emerald-400"
      )}>
        {isUser ? <span className="text-xs font-bold">D</span> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn("flex-1 min-w-0 max-w-[85%]", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isUser
            ? "bg-primary/15 text-foreground rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          )}
        </div>
        {!isUser && (
          <button
            onClick={() => onCopy(msg.id, msg.content)}
            className={cn(
              "mt-1.5 ml-1 flex items-center gap-1 text-xs transition-colors",
              msg.copied ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {msg.copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {msg.copied ? "Kopiert!" : "Kopieren"}
          </button>
        )}
      </div>
    </div>
  );
}

type DocChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  documentCreated?: { type: string; id: number | null; recipient: string; totalGross: string };
};

const DOC_QUICK_PROMPTS = [
  { label: "Angebot erstellen", prompt: "Ich moechte ein Angebot erstellen." },
  { label: "Rechnung erstellen", prompt: "Ich moechte eine Rechnung erstellen." },
  { label: "Angebot fuer Kunden", prompt: "Erstelle ein Angebot fuer einen Kunden." },
];

function DocChatBubble({ msg }: { msg: DocChatMessage }) {
  const [, navigate] = useLocation();
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
        isUser ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-400"
      )}>
        {isUser ? <span className="text-xs font-bold">D</span> : <FileText className="w-4 h-4" />}
      </div>
      <div className={cn("flex-1 min-w-0 max-w-[85%]", isUser ? "items-end" : "items-start")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isUser ? "bg-primary/15 text-foreground rounded-tr-sm" : "bg-card border border-border rounded-tl-sm"
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          )}
        </div>
        {msg.documentCreated && (
          <div className="mt-2 ml-1 flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-300">
                {msg.documentCreated.type === "offer" ? "Angebot" : "Rechnung"} erstellt
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {msg.documentCreated.recipient} &bull; {msg.documentCreated.totalGross} &euro;
              </p>
            </div>
            <button
              onClick={() => navigate("/invoices")}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Oeffnen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const [activeTab, setActiveTab] = useState<"chat" | "document">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [includeErpContext, setIncludeErpContext] = useState(false);
  const [showPrompts, setShowPrompts] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Dokument-Chat State
  const [docMessages, setDocMessages] = useState<DocChatMessage[]>([]);
  const [docInput, setDocInput] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const docBottomRef = useRef<HTMLDivElement>(null);

  const createDocMutation = trpc.ai.createDocument.useMutation({
    onSuccess: (data) => {
      const assistantMsg: DocChatMessage = {
        id: `doc-ai-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        documentCreated: data.documentCreated ?? undefined,
      };
      setDocMessages(prev => [...prev, assistantMsg]);
      setDocLoading(false);
      setTimeout(() => docBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (e) => {
      toast.error(`Fehler: ${e.message}`);
      setDocLoading(false);
    },
  });

  const handleDocSend = (text?: string) => {
    const content = (text ?? docInput).trim();
    if (!content || docLoading) return;
    const userMsg: DocChatMessage = { id: `doc-user-${Date.now()}`, role: "user", content };
    const newMessages = [...docMessages, userMsg];
    setDocMessages(newMessages);
    setDocInput("");
    setDocLoading(true);
    setTimeout(() => docBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    createDocMutation.mutate({
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
    });
  };

  const handleDocKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleDocSend(); }
  };

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (e) => {
      toast.error(`Fehler: ${e.message}`);
      setIsLoading(false);
    },
  });

  const handleSend = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setShowPrompts(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    chatMutation.mutate({
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      includeErpContext,
    });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: true } : m));
      setTimeout(() => setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: false } : m)), 2000);
      toast.success("In Zwischenablage kopiert");
    });
  };

  const handleClear = () => { setMessages([]); setShowPrompts(true); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
      {/* Header mit Tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-muted/50 p-0.5 gap-0.5">
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === "chat"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              KI-Chat
            </button>
            <button
              onClick={() => setActiveTab("document")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === "document"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              Dokument erstellen
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === "chat" && (
            <>
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <Label htmlFor="erp-toggle" className="text-xs text-muted-foreground cursor-pointer">ERP-Daten</Label>
                <Switch id="erp-toggle" checked={includeErpContext} onCheckedChange={setIncludeErpContext} className="scale-75" />
              </div>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-foreground gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-xs">Leeren</span>
                </Button>
              )}
            </>
          )}
          {activeTab === "document" && docMessages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setDocMessages([])} className="text-muted-foreground hover:text-foreground gap-1.5">
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-xs">Leeren</span>
            </Button>
          )}
        </div>
      </div>

      {/* Dokument-Chat Tab */}
      {activeTab === "document" && (
        <>
          <ScrollArea className="flex-1 px-4 py-4">
            {docMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold mb-1">Angebot oder Rechnung erstellen</h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Beschreibe was du erstellen moechtest. Die KI sucht den Kunden, uebernimmt die Adresse und legt das Dokument als Entwurf an.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {DOC_QUICK_PROMPTS.map((qp) => (
                    <button key={qp.label} onClick={() => handleDocSend(qp.prompt)}
                      className="px-3 py-1.5 rounded-full text-xs border border-border hover:border-blue-400/50 hover:text-blue-400 transition-colors bg-card">
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {docMessages.map((msg) => (
              <DocChatBubble key={msg.id} msg={msg} />
            ))}
            {docLoading && (
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-1">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span className="text-xs text-muted-foreground">Verarbeite...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={docBottomRef} />
          </ScrollArea>
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex gap-2 items-end">
              <Textarea
                value={docInput}
                onChange={e => setDocInput(e.target.value)}
                onKeyDown={handleDocKeyDown}
                placeholder="z.B. Erstelle ein Angebot fuer Lwowski ueber 5x Bronzeplakette a 20 EUR..."
                className="resize-none min-h-[44px] max-h-[140px] text-sm"
                rows={1}
                disabled={docLoading}
              />
              <Button onClick={() => handleDocSend()} disabled={!docInput.trim() || docLoading}
                size="icon" className="shrink-0 h-11 w-11 bg-blue-600 hover:bg-blue-500">
                {docLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Das Dokument wird als Entwurf angelegt und kann in Angebote &amp; Rechnungen bearbeitet werden.</p>
          </div>
        </>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Bot className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold mb-1">Wie kann ich helfen?</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Stelle mir Fragen, lass mich recherchieren, Texte formulieren oder deine ERP-Daten auswerten.
                {includeErpContext && <span className="text-emerald-400"> ERP-Kontext ist aktiv.</span>}
              </p>
            </div>
            <div className="w-full max-w-2xl">
              <button onClick={() => setShowPrompts(!showPrompts)} className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors">
                {showPrompts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Vorschläge
              </button>
              {showPrompts && (
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((qp) => (
                    <button key={qp.label} onClick={() => handleSend(qp.prompt)}
                      className="px-3 py-1.5 rounded-full text-xs border border-border hover:border-primary/50 hover:text-primary transition-colors bg-card">
                      {qp.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} onCopy={handleCopy} />
        ))}

        {isLoading && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span className="text-xs text-muted-foreground">Denkt nach…</span>
              </div>
            </div>
          </div>
        )}

        {messages.length > 0 && !isLoading && (
          <div className="mt-2 mb-2">
            <button onClick={() => setShowPrompts(!showPrompts)} className="flex items-center gap-1 text-xs text-muted-foreground mb-2 hover:text-foreground transition-colors">
              {showPrompts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Weitere Vorschläge
            </button>
            {showPrompts && (
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.slice(0, 4).map((qp) => (
                  <button key={qp.label} onClick={() => handleSend(qp.prompt)}
                    className="px-2.5 py-1 rounded-full text-xs border border-border hover:border-primary/50 hover:text-primary transition-colors bg-card">
                    {qp.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>}

      {/* Eingabe (nur im Chat-Tab) */}
      {activeTab === "chat" && <div className="px-4 py-3 border-t border-border shrink-0">
        {includeErpContext && (
          <div className="flex items-center gap-1.5 mb-2">
            <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/30 gap-1">
              <Database className="w-3 h-3" />
              ERP-Kontext aktiv — KI kennt deine Projekte, Kunden & Rechnungen
            </Badge>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage stellen… (Enter = Senden, Shift+Enter = neue Zeile)"
            className="resize-none min-h-[44px] max-h-[140px] text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading}
            size="icon" className="shrink-0 h-11 w-11 bg-emerald-600 hover:bg-emerald-500">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Enter = Senden · Shift+Enter = Neue Zeile · Copy-Button bei jeder Antwort</p>
      </div>}
    </div>
  );
}

/**
 * ProjectPortal.tsx — Öffentliches Kundenportal (helles Design, ohne Login)
 * Route: /projekt-portal/:id
 * Authentifizierung: Passwort-Eingabe, Session im sessionStorage
 */
import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MessageCircle, Send, Paperclip, X, Loader2, Lock, Eye, EyeOff,
  CloudUpload, AlertCircle, CheckCircle2, LogOut, Building2,
} from "lucide-react";

// ─── Session-Hilfsfunktionen ──────────────────────────────────────────────────
const SESSION_KEY = (projectId: string) => `portal_session_${projectId}`;

function saveSession(projectId: string, password: string, projectTitle: string, senderName: string) {
  sessionStorage.setItem(SESSION_KEY(projectId), JSON.stringify({ password, projectTitle, senderName }));
}

function loadSession(projectId: string): { password: string; projectTitle: string; senderName: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(projectId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession(projectId: string) {
  sessionStorage.removeItem(SESSION_KEY(projectId));
}

function fmtSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Personenfarben (helles Design, WCAG AA) ──────────────────────────────────
const PORTAL_PERSON_COLORS = [
  { bg: '#1e40af', text: '#ffffff' }, // Blau (ERP-Team)
  { bg: '#166534', text: '#ffffff' }, // Grün
  { bg: '#7c2d12', text: '#ffffff' }, // Braun
  { bg: '#6b21a8', text: '#ffffff' }, // Lila
  { bg: '#0e7490', text: '#ffffff' }, // Cyan
];

// Kunden-Farbe: dunkel-grau (eigene Nachrichten = "Du")
const CUSTOMER_COLOR = { bg: '#1e293b', text: '#ffffff' };

function getPortalPersonColor(name: string, colorMap: Map<string, number>) {
  if (!colorMap.has(name)) colorMap.set(name, colorMap.size % PORTAL_PERSON_COLORS.length);
  return PORTAL_PERSON_COLORS[colorMap.get(name)!];
}

// ─── Login-Formular ───────────────────────────────────────────────────────────
function PortalLogin({ projectId, onLogin }: {
  projectId: number;
  onLogin: (password: string, projectTitle: string, senderName: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [senderName, setSenderName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const authMut = trpc.projectChat.portalAuth.useMutation({
    onSuccess: (data) => {
      if (senderName.trim() && password) {
        onLogin(password, data.projectTitle, senderName.trim());
      }
    },
    onError: (e) => {
      if (e.message === 'PORTAL_CLOSED') {
        setError('Dieses Portal wurde geschlossen (Projekt abgeschlossen).');
      } else {
        setError('Falsches Passwort. Bitte versuche es erneut.');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) { setError('Bitte gib deinen Namen ein.'); return; }
    if (!password) { setError('Bitte gib das Passwort ein.'); return; }
    setError('');
    authMut.mutate({ projectId, password });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-900 mb-4">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Fabrica GmbH</h1>
          <p className="text-slate-500 mt-1">Kundenportal</p>
        </div>

        {/* Login-Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="h-4 w-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800">Anmelden</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-700">Dein Name</Label>
              <Input
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                placeholder="z.B. Max Mustermann"
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-700">Passwort</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Passwort eingeben..."
                  className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 pr-9"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              disabled={authMut.isPending}
            >
              {authMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Anmelden
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Das Passwort erhalten Sie von Ihrem Ansprechpartner bei Fabrica GmbH.
        </p>
      </div>
    </div>
  );
}

// ─── Chat-Ansicht ─────────────────────────────────────────────────────────────
function PortalChat({ projectId, password, senderName, onLogout }: {
  projectId: number;
  password: string;
  senderName: string;
  onLogout: () => void;
}) {
  const [newMessage, setNewMessage] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const colorMapRef = useRef<Map<string, number>>(new Map());

  // Projektname live aus DB laden
  const { data: projectInfo } = trpc.projectChat.getProjectInfo.useQuery(
    { projectId, password },
    { refetchOnWindowFocus: true }
  );
  const liveProjectTitle = projectInfo?.projectTitle ?? '…';
  const isChatClosed = projectInfo?.chatClosed === true;

  const { data: messages = [], isLoading, refetch } = trpc.projectChat.portalGetMessages.useQuery(
    { projectId, password },
    { refetchInterval: 8000 }
  );

  const sendMsg = trpc.projectChat.portalSendMessage.useMutation({
    onSuccess: () => {
      refetch();
      setNewMessage('');
      setChatFile(null);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Personenfarben-Map zurücksetzen wenn Nachrichten sich ändern
  useEffect(() => {
    colorMapRef.current = new Map();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() && !chatFile) return;
    if (isChatClosed) return;
    let fileBase64: string | undefined;
    let filename: string | undefined;
    let mimeType: string | undefined;
    let fileSize: number | undefined;
    if (chatFile) {
      const buf = await chatFile.arrayBuffer();
      fileBase64 = btoa(Array.from(new Uint8Array(buf)).map(b => String.fromCharCode(b)).join(''));
      filename = chatFile.name;
      mimeType = chatFile.type || 'application/octet-stream';
      fileSize = chatFile.size;
    }
    sendMsg.mutate({
      projectId,
      password,
      content: newMessage.trim() || (chatFile ? `[Datei: ${chatFile.name}]` : ''),
      senderName,
      fileBase64,
      filename,
      mimeType,
      fileSize,
    });
  };

  // Suche: Nachrichten filtern
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.senderName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const highlight = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <mark className="bg-yellow-300 text-slate-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header mit Live-Projektname */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">Fabrica GmbH · Kundenportal</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{liveProjectTitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            {senderName}
          </div>
          <button
            onClick={onLogout}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Chat geschlossen — Hinweis */}
      {isChatClosed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-700 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Der Chat für dieses Projekt wurde beendet. Der Verlauf ist weiterhin lesbar.</span>
        </div>
      )}

      {/* Suchleiste */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 max-w-2xl mx-auto w-full">
        {showSearch ? (
          <>
            <Input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Nachrichten durchsuchen..."
              className="h-7 text-xs flex-1 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="text-slate-400 hover:text-slate-600 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 ml-auto"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Suchen
          </button>
        )}
      </div>

      {/* Nachrichten */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Lade Nachrichten...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <MessageCircle className="h-12 w-12 text-slate-300" />
            <p className="text-slate-500 font-medium">
              {searchQuery ? 'Keine Treffer für diese Suche' : 'Noch keine Nachrichten'}
            </p>
            {!searchQuery && <p className="text-sm text-slate-400">Schreibe eine Nachricht an das Fabrica-Team</p>}
          </div>
        ) : (
          filteredMessages.map(msg => {
            // "Du"-Logik: eigene Nachrichten des eingeloggten Kunden
            const isOwnMessage = msg.senderType === 'customer' && msg.senderName === senderName;
            const isCustomer = msg.senderType === 'customer';

            // Farbe: eigene Nachrichten = CUSTOMER_COLOR, ERP-Mitarbeiter = Personenfarbe
            let color: { bg: string; text: string };
            if (isOwnMessage) {
              color = CUSTOMER_COLOR;
            } else if (isCustomer) {
              // Anderer Kunde (falls mehrere) — Personenfarbe
              color = getPortalPersonColor(msg.senderName, colorMapRef.current);
            } else {
              // ERP-Mitarbeiter — Personenfarbe
              color = getPortalPersonColor(msg.senderName, colorMapRef.current);
            }

            const displayName = isOwnMessage ? 'Du' : msg.senderName;

            return (
              <div key={msg.id} className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                {!isOwnMessage && (
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {msg.senderName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className="max-w-[80%] rounded-2xl px-4 py-2.5"
                  style={{
                    backgroundColor: color.bg,
                    color: color.text,
                    borderRadius: isOwnMessage ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                  }}
                >
                  <p className="text-xs mb-1 opacity-70">
                    {displayName} · {new Date(msg.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{highlight(msg.content, searchQuery)}</p>
                  {msg.attachmentUrl && (
                    <a
                      href={msg.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 flex items-center gap-1.5 text-xs hover:underline opacity-80"
                    >
                      <Paperclip className="h-3 w-3" />
                      {msg.attachmentName ?? 'Anhang'}
                      {msg.attachmentSize ? ` (${fmtSize(msg.attachmentSize)})` : ''}
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Eingabebereich */}
      {!isChatClosed ? (
        <div className="bg-white border-t border-slate-200 px-4 py-3 sticky bottom-0">
          <div className="max-w-2xl mx-auto space-y-2">
            {chatFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                <span className="flex-1 truncate">{chatFile.name}</span>
                <button onClick={() => setChatFile(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Nachricht schreiben..."
                className="min-h-[44px] max-h-28 text-sm resize-none flex-1 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400 rounded-xl"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => chatFileRef.current?.click()}
                  className="h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <CloudUpload className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={sendMsg.isPending || (!newMessage.trim() && !chatFile)}
                  className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <input ref={chatFileRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && setChatFile(e.target.files[0])} />
            <p className="text-xs text-slate-400 text-center">Enter = Senden · Shift+Enter = Zeilenumbruch</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border-t border-slate-200 px-4 py-4 sticky bottom-0 text-center">
          <p className="text-sm text-slate-500">Der Chat für dieses Projekt wurde beendet.</p>
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function ProjectPortal() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id ?? '0', 10);

  const [session, setSession] = useState<{
    password: string;
    projectTitle: string;
    senderName: string;
  } | null>(() => loadSession(String(projectId)));

  if (!projectId || isNaN(projectId)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600">Ungültige Portal-URL</p>
        </div>
      </div>
    );
  }

  const handleLogin = (password: string, projectTitle: string, senderName: string) => {
    saveSession(String(projectId), password, projectTitle, senderName);
    setSession({ password, projectTitle, senderName });
  };

  const handleLogout = () => {
    clearSession(String(projectId));
    setSession(null);
  };

  if (!session) {
    return <PortalLogin projectId={projectId} onLogin={handleLogin} />;
  }

  return (
    <PortalChat
      projectId={projectId}
      password={session.password}
      senderName={session.senderName}
      onLogout={handleLogout}
    />
  );
}

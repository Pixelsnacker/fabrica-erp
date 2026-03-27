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
import TodoPanel from "@/components/TodoPanel";

// ─── Datenschutz-Hilfsfunktionen ─────────────────────────────────────────────
const PRIVACY_KEY = (projectId: string) => `portal_privacy_accepted_${projectId}`;

function loadPrivacyAccepted(projectId: string): boolean {
  try {
    return sessionStorage.getItem(PRIVACY_KEY(projectId)) === 'true';
  } catch {
    return false;
  }
}

function savePrivacyAccepted(projectId: string) {
  try {
    sessionStorage.setItem(PRIVACY_KEY(projectId), 'true');
  } catch { /* ignore */ }
}

// ─── Datenschutz-Modal ───────────────────────────────────────────────────────
function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-base font-semibold text-slate-900">Datenschutzhinweis</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div>
            <p className="font-semibold text-slate-900 mb-1">Verantwortlicher</p>
            <p>Fabrica GmbH<br />Hüttenstraße 205, 50170 Kerpen-Sindorf<br />kontakt@fabrica3d.eu</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Was dieses Portal ist</p>
            <p>Dieses Kundenportal dient der direkten Projektkommunikation zwischen Fabrica GmbH und Ihnen als Kunde. Es werden ausschließlich Daten verarbeitet, die für die Projektabwicklung notwendig sind.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-2">Welche Daten gespeichert werden</p>
            <ul className="space-y-1 list-disc list-inside text-slate-600">
              <li>Ihr Name und Ihre E-Mail-Adresse, die im Rahmen des Projekts hinterlegt wurden</li>
              <li>Nachrichten die Sie im Chat senden, inklusive Datum und Uhrzeit</li>
              <li>Dateien und Bilder die Sie im Chat hochladen</li>
              <li>Aufgaben (Todos) die Ihnen zugewiesen werden oder die Sie erstellen</li>
              <li>Ein technischer Session-Token der Ihren Login-Status speichert</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Warum diese Daten gespeichert werden</p>
            <p>Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. b DSGVO zur Durchführung eines Vertrags sowie auf Basis von Art. 6 Abs. 1 lit. f DSGVO für das berechtigte Interesse an einer geordneten Projektkommunikation.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Cookies und lokale Speicherung</p>
            <p>Dieses Portal verwendet ausschließlich einen technisch notwendigen Session-Cookie, der Ihren Login-Status für die Dauer Ihrer Sitzung speichert. Es werden keine Tracking-Cookies, Analyse-Tools oder Werbecookies eingesetzt. Für technisch notwendige Cookies ist nach deutschem und europäischem Recht keine gesonderte Einwilligung erforderlich.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Wie lange Daten gespeichert werden</p>
            <p>Ihre Projektdaten inklusive Chatverlauf werden für die Dauer des Projekts sowie für den gesetzlich vorgeschriebenen Aufbewahrungszeitraum von zehn Jahren gespeichert. Nach Ablauf dieser Frist werden die Daten gelöscht.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Wer die Daten sieht</p>
            <p>Ihre Nachrichten und Dateien sind ausschließlich für die am Projekt beteiligten Personen bei Fabrica GmbH sowie für Sie als Kunde sichtbar. Eine Weitergabe an Dritte findet nicht statt, außer es besteht eine gesetzliche Verpflichtung dazu.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Ihre Rechte</p>
            <p>Sie haben jederzeit das Recht auf Auskunft über Ihre gespeicherten Daten, Berichtigung unrichtiger Daten, Löschung soweit keine gesetzliche Aufbewahrungspflicht entgegensteht, sowie Einschränkung der Verarbeitung. Für alle Anfragen wenden Sie sich bitte an: <span className="font-medium">kontakt@fabrica3d.eu</span></p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 mb-1">Beschwerderecht</p>
            <p>Sie haben das Recht, sich bei der zuständigen Datenschutzaufsichtsbehörde zu beschweren. In Nordrhein-Westfalen ist dies die Landesbeauftragte für Datenschutz und Informationsfreiheit NRW, Postfach 20 04 44, 40102 Düsseldorf.</p>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Datenschutz-Banner ───────────────────────────────────────────────────────
function PrivacyBanner({ projectId, onAccept }: { projectId: number; onAccept: () => void }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <div className="bg-slate-800 text-white px-4 py-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="flex-1 min-w-0">
          <span className="font-semibold">Datenschutzhinweis:</span>{' '}
          Dieses Portal speichert Ihre Projektkommunikation gemäß DSGVO.
          Durch die Nutzung stimmen Sie der Verarbeitung Ihrer Daten zu.{' '}
          <button
            onClick={() => setShowModal(true)}
            className="underline hover:text-slate-300 transition-colors"
          >
            Vollständigen Datenschutzhinweis lesen
          </button>
        </span>
        <button
          onClick={() => { savePrivacyAccepted(String(projectId)); onAccept(); }}
          className="shrink-0 px-4 py-1.5 rounded-lg bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
        >
          Verstanden &amp; Akzeptieren
        </button>
      </div>
      {showModal && <PrivacyModal onClose={() => setShowModal(false)} />}
    </>
  );
}

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
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031764330/YMZow7uQxpBVyBGbmbpvvd/FabricaLogoneu_096a1b04.png"
            alt="Fabrica 3D Digital Production"
            className="h-14 mx-auto mb-4 object-contain"
          />
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
  const [privacyAccepted, setPrivacyAccepted] = useState(() => loadPrivacyAccepted(String(projectId)));
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
  const liveCustomerName = projectInfo?.customerName;

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
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031764330/YMZow7uQxpBVyBGbmbpvvd/FabricaLogoneu_096a1b04.png"
          alt="Fabrica 3D"
          className="h-[35px] object-contain shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">
            Kundenportal{liveCustomerName ? <span className="ml-1.5 font-medium text-slate-700">· {liveCustomerName}</span> : null}
          </p>
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

      {/* Datenschutz-Banner */}
      {!privacyAccepted && (
        <PrivacyBanner projectId={projectId} onAccept={() => setPrivacyAccepted(true)} />
      )}

      {/* Chat geschlossen — Hinweis */}
      {isChatClosed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-amber-700 text-sm">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Der Chat für dieses Projekt wurde beendet. Der Verlauf ist weiterhin lesbar.</span>
        </div>
      )}

      {/* Suchleiste */}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center gap-2 max-w-4xl mx-auto w-full">
        {showSearch ? (
          <>
            <Input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Nachrichten durchsuchen..."
              className="h-[34px] text-sm flex-1 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
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
            className="flex items-center gap-1.5 text-sm ml-auto"
            style={{ color: '#DC143C' }}
          >
            <MessageCircle className="h-4 w-4" style={{ color: '#DC143C' }} />
            Suchen
          </button>
        )}
      </div>

      {/* Haupt-Bereich: Chat + Todos nebeneinander */}
      <div className="flex flex-1 overflow-hidden max-w-4xl mx-auto w-full">

      {/* Chat (links, 60%) */}
      <div className="flex flex-col" style={{ flex: '0 0 60%', minWidth: 0 }}>
      {/* Nachrichten */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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
      </div> {/* Ende Chat-Spalte */}

      {/* Todo-Panel (rechts, 40%) */}
      <div className="flex flex-col border-l border-slate-200 bg-white" style={{ flex: '0 0 40%', minWidth: 0 }}>
        <div className="px-3 py-2 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-slate-700">Aufgaben</span>
          <span className="text-xs text-slate-400 ml-auto">für dieses Projekt</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <TodoPanel
            mode="portal"
            projectId={projectId}
            password={password}
            senderName={senderName}
          />
        </div>
      </div>

      </div> {/* Ende Haupt-Bereich */}
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

import { useState, useRef, useCallback, useEffect } from "react";
import { CadViewer, CadFileThumbnail } from "@/components/CadViewer";
import { EntitySearch } from "@/components/EntitySearch";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Plus, Trash2, Package, Truck, FileCode2, MessageSquare,
  ExternalLink, Bell, StickyNote, Clock, Paperclip, CheckCircle2, Circle,
  AlertCircle, Upload, FileText, Image, X, Edit2, Save, AlertTriangle,
  ShieldAlert, Receipt, BookOpen, Loader2, Printer, ChevronDown, ChevronUp,
  Download, FolderOpen, Shield, ClipboardList, FolderSync, Wifi, WifiOff, Archive, RotateCcw,
  MessageCircle, Send, Lock, Mail, RefreshCw, Eye, EyeOff, Copy, CloudUpload, Key,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// ─── Datei-Kategorien (gleich wie in Customers.tsx) ─────────────────────────
const FILE_CATEGORIES_PD: Record<string, { label: string; color: string }> = {
  cad_data:       { label: 'CAD-Daten',          color: 'text-blue-400' },
  drawing:        { label: 'Zeichnungen',         color: 'text-purple-400' },
  photo:          { label: 'Fotos',               color: 'text-green-400' },
  nda:            { label: 'NDA / Verträge',      color: 'text-red-400' },
  protocol:       { label: 'Protokolle',          color: 'text-yellow-400' },
  supplier_quote: { label: 'Lieferantenangebote', color: 'text-orange-400' },
  contract:       { label: 'Verträge',            color: 'text-pink-400' },
  invoice:        { label: 'Rechnungen',          color: 'text-cyan-400' },
  other:          { label: 'Sonstiges',           color: 'text-muted-foreground' },
};

function fmtSize(bytes?: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Kundenportal-Chat-Tab ────────────────────────────────────────────────────
function ProjectChatTab({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const [newMessage, setNewMessage] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [portalUrl, setPortalUrl] = useState('');
  const [chatFile, setChatFile] = useState<File | null>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: msgsLoading } = trpc.projectChat.getMessages.useQuery(
    { projectId },
    { refetchInterval: 10000 }
  );
  const { data: portalConfig } = trpc.projectChat.getPortalConfig.useQuery({ projectId });

  const sendMsg = trpc.projectChat.sendMessage.useMutation({
    onSuccess: () => {
      utils.projectChat.getMessages.invalidate({ projectId });
      setNewMessage('');
      setChatFile(null);
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const setupPortal = trpc.projectChat.setupPortal.useMutation({
    onSuccess: () => {
      utils.projectChat.getPortalConfig.invalidate({ projectId });
      setShowSetupDialog(false);
      setSetupPassword('');
      toast.success('Portal-Passwort gesetzt');
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const sendInvitation = trpc.projectChat.sendInvitation.useMutation({
    onSuccess: () => {
      utils.projectChat.getPortalConfig.invalidate({ projectId });
      toast.success('Einladungs-E-Mail gesendet');
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToBottom(); }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() && !chatFile) return;
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
      content: newMessage.trim() || (chatFile ? `[Datei: ${chatFile.name}]` : ''),
      fileBase64,
      filename,
      mimeType,
      fileSize,
    });
  };

  const copyPortalUrl = () => {
    const url = `${window.location.origin}/projekt-portal/${projectId}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link kopiert'));
  };

  const isActive = portalConfig?.isActive === 1;
  const hasPortal = !!portalConfig;
  const currentPortalUrl = `${window.location.origin}/projekt-portal/${projectId}`;

  return (
    <div className="space-y-4">
      {/* Portal-Status-Header */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isActive ? 'bg-emerald-500/20' : 'bg-muted'}`}>
          {isActive ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {!hasPortal ? 'Kundenportal nicht eingerichtet' : isActive ? 'Kundenportal aktiv' : 'Kundenportal deaktiviert (Projekt abgeschlossen)'}
          </p>
          {hasPortal && (
            <p className="text-xs text-muted-foreground truncate">{currentPortalUrl}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasPortal && (
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={copyPortalUrl}>
              <Copy className="h-3 w-3" />Link
            </Button>
          )}
          {hasPortal && isActive && (
            <Button
              variant="outline" size="sm" className="h-7 gap-1 text-xs"
              onClick={() => sendInvitation.mutate({ projectId, origin: window.location.origin })}
              disabled={sendInvitation.isPending}
            >
              {sendInvitation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
              Einladen
            </Button>
          )}
          <Button
            variant={hasPortal ? 'outline' : 'default'} size="sm" className="h-7 gap-1 text-xs"
            onClick={() => setShowSetupDialog(true)}
          >
            <Key className="h-3 w-3" />{hasPortal ? 'Passwort ändern' : 'Portal einrichten'}
          </Button>
        </div>
      </div>

      {/* Letzter Einladungsversand */}
      {portalConfig?.invitationSentAt && (
        <p className="text-xs text-muted-foreground px-1">
          Letzte Einladung: {new Date(portalConfig.invitationSentAt).toLocaleString('de-DE')}
        </p>
      )}

      {/* Chat-Bereich */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Nachrichten-Liste */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 bg-background/50">
          {msgsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />Lade Nachrichten...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">Noch keine Nachrichten</p>
              <p className="text-xs text-muted-foreground">Nachrichten erscheinen hier, sobald du oder der Kunde schreibt</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.senderType === 'erp' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                  msg.senderType === 'erp'
                    ? 'bg-emerald-600/20 border border-emerald-500/30 text-right'
                    : 'bg-card border border-border'
                }`}>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {msg.senderName} · {new Date(msg.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.attachmentUrl && (
                    <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
                       className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                      <Paperclip className="h-3 w-3" />{msg.attachmentName ?? 'Anhang'}
                      {msg.attachmentSize ? ` (${fmtSize(msg.attachmentSize)})` : ''}
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Eingabebereich */}
        <div className="border-t border-border p-3 bg-card">
          {chatFile && (
            <div className="flex items-center gap-2 mb-2 p-2 rounded bg-muted/50 text-xs">
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="flex-1 truncate">{chatFile.name}</span>
              <button onClick={() => setChatFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Nachricht an Kunden... (@Name für E-Mail-Benachrichtigung)"
              className="min-h-[60px] max-h-32 text-sm resize-none flex-1"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <div className="flex flex-col gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => chatFileRef.current?.click()}>
                <CloudUpload className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleSend} disabled={sendMsg.isPending || (!newMessage.trim() && !chatFile)}>
                {sendMsg.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <input ref={chatFileRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && setChatFile(e.target.files[0])} />
          <p className="text-xs text-muted-foreground mt-1.5">Enter = Senden · Shift+Enter = Zeilenumbruch · @Name für E-Mail-Benachrichtigung</p>
        </div>
      </div>

      {/* Portal-Setup-Dialog */}
      {showSetupDialog && (
        <Dialog open={true} onOpenChange={o => { if (!o) { setShowSetupDialog(false); setSetupPassword(''); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-4 w-4 text-emerald-400" />
                {hasPortal ? 'Portal-Passwort ändern' : 'Kundenportal einrichten'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Das Passwort wird dem Kunden separat mitgeteilt. Der Kunde greift über diesen Link auf das Portal zu:
              </p>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs font-mono break-all">
                {currentPortalUrl}
                <button onClick={copyPortalUrl} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                <Label>Passwort (min. 6 Zeichen)</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={setupPassword}
                    onChange={e => setSetupPassword(e.target.value)}
                    placeholder="Sicheres Passwort eingeben..."
                    className="pr-9"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowSetupDialog(false); setSetupPassword(''); }}>Abbrechen</Button>
              <Button
                onClick={() => setupPortal.mutate({ projectId, password: setupPassword })}
                disabled={setupPortal.isPending || setupPassword.length < 6}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {setupPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {hasPortal ? 'Passwort ändern' : 'Portal aktivieren'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Akte-Tab im Projekt-Detail ──────────────────────────────────────────────
function ProjectAkteTab({ customerId, projectId, customerName }: {
  customerId: number;
  projectId: number;
  customerName: string;
}) {
  const utils = trpc.useUtils();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [uploadCategory, setUploadCategory] = useState<string>('other');
  const [uploadNotes, setUploadNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadCurrentName, setUploadCurrentName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading } = trpc.customerFiles.listByProject.useQuery(
    { customerId, projectId },
    { refetchOnWindowFocus: true }
  );

  const uploadMut = trpc.customerFiles.upload.useMutation({
    onError: (e) => toast.error(`Upload fehlgeschlagen: ${e.message}`),
  });

  const deleteMut = trpc.customerFiles.delete.useMutation({
    onSuccess: () => {
      utils.customerFiles.listByProject.invalidate({ customerId, projectId });
      toast.success('Datei gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });

  const handleFiles = async (fileList: FileList | File[]) => {
    const MAX_SIZE = 50 * 1024 * 1024;
    const arr = Array.from(fileList);
    const valid = arr.filter(f => {
      if (f.size > MAX_SIZE) { toast.error(`"${f.name}" ist zu groß (max. 50 MB)`); return false; }
      return true;
    });
    if (!valid.length) return;
    setUploading(true);
    setUploadTotal(valid.length);
    setUploadCurrent(0);
    let success = 0;
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setUploadCurrent(i + 1);
      setUploadCurrentName(file.name);
      try {
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        const base64 = btoa(Array.from(uint8).map(b => String.fromCharCode(b)).join(''));
        await uploadMut.mutateAsync({
          customerId,
          customerName,
          projectId,
          category: uploadCategory as any,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileBase64: base64,
          fileSize: file.size,
          notes: uploadNotes || undefined,
        });
        success++;
      } catch (_) {}
    }
    utils.customerFiles.listByProject.invalidate({ customerId, projectId });
    if (success > 0) {
      setUploadNotes('');
      toast.success(valid.length === 1 ? 'Datei hochgeladen' : `${success} von ${valid.length} Dateien hochgeladen`);
    }
    setUploading(false);
    setUploadCurrent(0);
    setUploadTotal(0);
    setUploadCurrentName('');
  };

  const filteredFiles = selectedCategory === 'all' ? files : files.filter(f => f.category === selectedCategory);
  const categoryCounts = files.reduce((acc, f) => { acc[f.category] = (acc[f.category] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <FolderOpen className="h-4 w-4 text-blue-400" />
        <span className="text-sm font-medium text-blue-400">Kundenakte: {customerName}</span>
        <span className="text-xs text-muted-foreground ml-auto">Gespeichert in Google Drive · Fabrica ERP/Kunden/{customerName}/</span>
      </div>

      {/* Upload */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Kategorie</Label>
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FILE_CATEGORIES_PD).map(([v, { label }]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Notiz (optional)</Label>
            <Input value={uploadNotes} onChange={e => setUploadNotes(e.target.value)} placeholder="z.B. Rev. A, Endversion..." className="h-8 text-sm" />
          </div>
        </div>
        <div
          className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <p className="text-sm font-medium">{uploadTotal > 1 ? `${uploadCurrent} / ${uploadTotal} Dateien` : 'Wird hochgeladen...'}</p>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{uploadCurrentName}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">Dateien ablegen oder klicken</p>
              <p className="text-xs text-muted-foreground">Alle Formate, max. 50 MB · Mehrfachauswahl möglich</p>
            </div>
          )}
        </div>
      </div>

      {/* Kategorie-Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory('all')} className="h-7 text-xs">Alle ({files.length})</Button>
        {Object.entries(categoryCounts).map(([cat, count]) => {
          const cfg = FILE_CATEGORIES_PD[cat];
          if (!cfg) return null;
          return (
            <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(cat)} className="h-7 text-xs">
              <span className={`h-2 w-2 rounded-full bg-current ${cfg.color} mr-1`} />
              {cfg.label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Dateiliste */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" />Lade Dateien...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <FolderOpen className="h-10 w-10 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Noch keine Dateien für dieses Projekt in der Kundenakte</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map(file => {
            const cfg = FILE_CATEGORIES_PD[file.category] ?? FILE_CATEGORIES_PD.other;
            return (
              <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-all group">
                <div className={`h-7 w-7 rounded flex items-center justify-center bg-card border border-border shrink-0`}>
                  <FileText className={`h-3.5 w-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{fmtSize(file.fileSize)}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{new Date(file.createdAt).toLocaleDateString('de-DE')}</span>
                    {file.notes && <><span className="text-xs text-muted-foreground">·</span><span className="text-xs text-muted-foreground italic">{file.notes}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300" onClick={() => window.open(file.driveFileUrl, '_blank')} title="In Google Drive öffnen"><ExternalLink className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-400 hover:text-green-300" onClick={() => window.open(`https://drive.google.com/uc?export=download&id=${file.driveFileId}`, '_blank')} title="Herunterladen"><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm(`"${file.filename}" wirklich löschen?`)) deleteMut.mutate({ id: file.id }); }} title="Löschen"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Anfrage", calculation: "Kalkulation", offer: "Angebot",
  order: "Auftrag", production: "Produktion", shipping: "Versand",
  completed: "Abgeschlossen", cancelled: "Storniert",
};
const STATUS_ORDER = ["inquiry","calculation","offer","order","production","shipping","completed","cancelled"];
const TECHNIQUE_LABELS: Record<string, string> = {
  "3d_print": "3D-Druck", cnc: "CNC", painting: "Lackierung",
  cad_work: "CAD-Bearbeitung", model_making: "Modellbau", assembly: "Montage", other: "Sonstige",
};
const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  niedrig: { label: "Niedrig", color: "text-blue-400" },
  normal: { label: "Normal", color: "text-muted-foreground" },
  hoch: { label: "Hoch", color: "text-red-400" },
};

const COMPLAINT_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: "Offen", color: "text-red-400" },
  in_progress: { label: "In Bearbeitung", color: "text-yellow-400" },
  resolved: { label: "Gelöst", color: "text-green-400" },
  closed: { label: "Geschlossen", color: "text-muted-foreground" },
};
const COMPLAINT_PRIORITY: Record<string, { label: string; color: string }> = {
  low: { label: "Niedrig", color: "text-blue-400" },
  normal: { label: "Normal", color: "text-muted-foreground" },
  high: { label: "Hoch", color: "text-orange-400" },
  critical: { label: "Kritisch", color: "text-red-500" },
};

// ── Tracking-URL Helfer ─────────────────────────────────────────────────────────
function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const c = carrier.toLowerCase();
  const t = encodeURIComponent(trackingNumber);
  if (c.includes('dhl')) return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${t}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${t}&loc=de_DE`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${t}&locale=de_DE`;
  if (c.includes('dpd')) return `https://tracking.dpd.de/status/de_DE/parcel/${t}`;
  if (c.includes('hermes') || c.includes('myhermes')) return `https://www.myhermes.de/empfangen/sendungsverfolgung/#${t}`;
  // Fallback: Google-Suche nach der Trackingnummer
  return `https://www.google.com/search?q=${t}+tracking`;
}

// ── Inline-Edit Feld ──────────────────────────────────────────────────────────
function InlineEdit({ value, onSave, type = "text", step, min, className }: {
  value: string;
  onSave: (v: string) => void;
  type?: string;
  step?: string;
  min?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:underline hover:decoration-dotted hover:text-primary transition-colors ${className}`}
        onClick={() => { setDraft(value); setEditing(true); }}
        title="Klicken zum Bearbeiten"
      >
        {value || <span className="text-muted-foreground italic text-xs">—</span>}
      </span>
    );
  }
  return (
    <input
      autoFocus
      type={type}
      step={step}
      min={min}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className={`bg-secondary border border-primary rounded px-1.5 py-0.5 text-sm focus:outline-none w-full ${className}`}
    />
  );
}

// ── InlineSelect ──────────────────────────────────────────────────────────────
function InlineSelect({ value, options, onSave }: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const label = options.find(o => o.value === value)?.label ?? value;

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:underline hover:decoration-dotted hover:text-primary transition-colors text-xs"
        onClick={() => setEditing(true)}
        title="Klicken zum Bearbeiten"
      >
        {label}
      </span>
    );
  }
  return (
    <Select value={value} onValueChange={v => { onSave(v); setEditing(false); }}>
      <SelectTrigger className="h-7 text-xs w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ─── Drive-Ordner-Button ────────────────────────────────────────────────────
function DriveFolderButton({ projectId }: { projectId: number }) {
  const { data, isLoading } = trpc.projects.getDriveFolderUrl.useQuery(
    { id: projectId },
    { retry: false, staleTime: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Drive</span>
      </Button>
    );
  }

  if (!data?.url) return null;

  return (
    <Button variant="outline" size="sm" asChild className="gap-2 text-green-400 border-green-400/30 hover:bg-green-400/10 hover:text-green-300">
      <a href={data.url} target="_blank" rel="noopener noreferrer">
        <FolderOpen className="h-4 w-4" />
        <span className="hidden sm:inline">In Drive öffnen</span>
      </a>
    </Button>
  );
}

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: project, isLoading } = trpc.projects.byId.useQuery({ id });
  const { data: items = [] } = trpc.projectItems.list.useQuery({ projectId: id });
  const { data: shipments = [] } = trpc.shipments.byProject.useQuery({ projectId: id });
  const { data: cadFiles = [] } = trpc.cadFiles.byProject.useQuery({ projectId: id });
  const { data: projectDocs = [] } = trpc.projectDocs.list.useQuery({ projectId: id });
  const { data: allSuppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: allCustomers = [] } = trpc.customers.list.useQuery();
  const [docSupplierFilter, setDocSupplierFilter] = useState<string>("all");
  const { data: consultations = [] } = trpc.consultation.list.useQuery({ projectId: id });
  const { data: projectNotes = [] } = trpc.notes.list.useQuery({ projectId: id });

  const { data: complaints = [] } = trpc.complaints.list.useQuery({ projectId: id });

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [showAddConsultation, setShowAddConsultation] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showNoteDetail, setShowNoteDetail] = useState<number | null>(null);
  const [showEditNote, setShowEditNote] = useState<number | null>(null);
  const [showAddComplaint, setShowAddComplaint] = useState(false);
  const [showEditComplaint, setShowEditComplaint] = useState<number | null>(null);
  const [showOfferUpload, setShowOfferUpload] = useState<number | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState({ title: '', projectNumber: '', type: 'other', notes: '' });
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [ocForm, setOcForm] = useState({ to: '', cc: '', subject: '', body: '' });

  // Datenblatt-Generator State
  const [dsForm, setDsForm] = useState({
    topic: '',
    audience: 'customer' as 'customer' | 'internal' | 'supplier',
    language: 'de' as 'de' | 'en',
    detail: 'standard' as 'brief' | 'standard' | 'detailed',
    customerName: '',
    projectName: '',
    selectedEntryIds: [] as number[],
  });
  const [generatedDatasheet, setGeneratedDatasheet] = useState('');
  const [showDsEntrySelector, setShowDsEntrySelector] = useState(false);
  const { data: companySettings } = trpc.companySettings.get.useQuery();
  const { data: projectEntities = [] } = trpc.customers.listForProjects.useQuery();
  const [showAssignCustomer, setShowAssignCustomer] = useState(false);
  const [assignCompositeId, setAssignCompositeId] = useState<string>(''); // 'c:123' oder 's:456'
  const assignCustomerMut = trpc.projects.update.useMutation({
    onSuccess: () => { utils.projects.byId.invalidate({ id }); toast.success('Zugewiesen'); setShowAssignCustomer(false); },
    onError: () => toast.error('Fehler beim Zuweisen'),
  });
  const { data: knowledgeEntries = [] } = trpc.knowledge.list.useQuery({});
  const generateDsMut = trpc.knowledge.generateDatasheet.useMutation({
    onSuccess: (data) => {
      setGeneratedDatasheet(data.text);
      toast.success(`Datenblatt generiert — ${data.usedEntries.length} Wissenseinträge verwendet`);
    },
    onError: () => toast.error('Fehler bei der Datenblatt-Generierung'),
  });

  const [itemForm, setItemForm] = useState({ name: "", quantity: 1, material: "", technique: "3d_print", productionType: "external", unitEk: "0.00", unitVk: "0.00" });
  const [shipmentForm, setShipmentForm] = useState({ carrier: "", trackingNumber: "", notes: "" });
  const [consultForm, setConsultForm] = useState({ title: "", content: "", type: "general", outcome: "" });
  const [noteForm, setNoteForm] = useState({ title: "", content: "", priority: "normal" });
  const [complaintForm, setComplaintForm] = useState({ title: "", description: "", status: "open", priority: "normal" });

  // Print-Funktion für Auftragsbestätigung (wie Angebote)
  function printOrderConfirmation() {
    if (!project || !companySettings) return;
    const cs = companySettings as any;
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
    const nl2br = (s: string) => (s ?? '').replace(/\n/g, '<br>');
    const logoHtml = cs.logoUrl ? `<img src="${cs.logoUrl}" style="max-height:70px;max-width:200px;object-fit:contain;" />` : `<strong style="font-size:20px">${cs.name ?? 'Fabrica GmbH'}</strong>`;
    const buildFooter = () => {
      const cols = [cs.footerCol1, cs.footerCol2, cs.footerCol3, cs.footerCol4].filter(Boolean);
      if (!cols.length) return '';
      return `<div class="page-footer" style="position:fixed;bottom:0;left:1cm;right:1cm;border-top:1px solid #ccc;padding-top:6px;display:grid;grid-template-columns:repeat(${cols.length},1fr);gap:8px;font-size:9px;color:#666;">${cols.map((c: string) => `<div>${nl2br(c)}</div>`).join('')}</div>`;
    };
    const allItems = items as any[];
    const taxRate = cs.kleinunternehmer ? 0 : 0.19;
    const netAmount = allItems.reduce((s, i) => s + parseFloat(i.totalVk ?? 0), 0);
    const taxAmount = netAmount * taxRate;
    const grossAmount = netAmount + taxAmount;
    const today = new Date().toLocaleDateString('de-DE');
    const projNum = (project as any).projectNumber ?? `#${project.id}`;
    const customer = (project as any).customer;
    const custAddr = customer ? [
      customer.company || customer.name,
      customer.street,
      customer.zip && customer.city ? `${customer.zip} ${customer.city}` : (customer.city ?? ''),
      customer.country && customer.country !== 'Deutschland' ? customer.country : '',
    ].filter(Boolean).join('<br>') : '';
    const rowsHtml = allItems.map((item, idx) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${idx + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${item.name ?? ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${item.quantity ?? 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">Stk.</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${fmt(parseFloat(item.unitVk ?? 0))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right"><strong>${fmt(parseFloat(item.totalVk ?? 0))}</strong></td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; padding: 1cm; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
      .sender-block { margin-top: 12px; }
      .sender-block strong { font-size: 10pt; }
      .sender-block p { font-size: 9pt; color: #444; line-height: 1.5; }
      .meta-block { text-align: right; font-size: 9pt; color: #444; line-height: 1.8; }
      .address-line { font-size: 8pt; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
      .recipient { font-size: 10pt; line-height: 1.7; margin-bottom: 24px; }
      h1 { font-size: 18pt; font-weight: bold; margin-bottom: 6px; border-bottom: 2px solid #222; padding-bottom: 6px; }
      .project-ref { font-size: 9pt; color: #555; margin-bottom: 16px; }
      .intro { font-size: 10pt; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      thead tr { background: #f5f5f5; }
      th { padding: 7px 8px; text-align: left; font-size: 9pt; border-bottom: 2px solid #ccc; }
      .totals { margin-left: auto; width: 260px; margin-top: 8px; }
      .totals table { border-top: 2px solid #222; }
      .totals td { padding: 4px 8px; font-size: 10pt; }
      .totals td:last-child { text-align: right; }
      @media print { button { display: none } .page-footer { position: fixed; bottom: 0; } }
    </style></head><body>
    <div class="header">
      <div>${logoHtml}<div class="sender-block"><strong>${cs.name ?? ''}</strong><p>${nl2br([cs.street, cs.zip && cs.city ? cs.zip + ' ' + cs.city : cs.city, cs.phone, cs.email].filter(Boolean).join('\n'))}</p></div></div>
      <div class="meta-block"><strong>Datum:</strong> ${today}<br><strong>Projekt-Nr.:</strong> ${projNum}<br>${cs.vatId ? `<strong>USt.-ID:</strong> ${cs.vatId}<br>` : ''}${cs.taxNumber ? `<strong>Steuer-Nr.:</strong> ${cs.taxNumber}` : ''}</div>
    </div>
    ${custAddr ? `<div class="address-line">${cs.name} \u00b7 ${cs.street} \u00b7 ${cs.zip} ${cs.city}</div><div class="recipient">${custAddr}</div>` : ''}
    <h1>Auftragsbest\u00e4tigung</h1>
    <p class="project-ref"><strong>Projekt:</strong> ${project.title}</p>
    <p class="intro">Sehr geehrte Damen und Herren,</p>
    <p class="intro">wir best\u00e4tigen hiermit Ihren Auftrag mit folgendem Leistungsumfang:</p>
    <table><thead><tr><th>#</th><th>Bezeichnung</th><th style="text-align:center">Menge</th><th style="text-align:center">Einh.</th><th style="text-align:right">Einzelpreis</th><th style="text-align:right">Gesamt</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <div class="totals"><table>${taxRate > 0 ? `<tr><td>Nettobetrag:</td><td>${fmt(netAmount)}</td></tr><tr><td>MwSt. 19%:</td><td>${fmt(taxAmount)}</td></tr>` : ''}<tr><td><strong>Gesamtbetrag:</strong></td><td><strong>${fmt(grossAmount)}</strong></td></tr></table></div>
    ${buildFooter()}
    <div style="margin-bottom:3cm"></div>
    <script>window.onload=()=>window.print();</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  const sendOrderConfirmation = trpc.projects.sendOrderConfirmation.useMutation({
    onSuccess: () => { setShowOrderConfirmation(false); toast.success('Auftragsbestätigung erfolgreich gesendet'); },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });
  const changeStatus = trpc.projects.changeStatus.useMutation({
    onSuccess: () => { utils.projects.byId.invalidate({ id }); toast.success("Status aktualisiert"); },
    onError: (e) => toast.error(`Fehler beim Statusändern: ${e.message}`),
  });
  const addItem = trpc.projectItems.create.useMutation({
    onSuccess: () => { utils.projectItems.list.invalidate({ projectId: id }); utils.projects.byId.invalidate({ id }); setShowAddItem(false); toast.success("Position hinzugefügt"); },
  });
  const updateItem = trpc.projectItems.update.useMutation({
    onSuccess: () => { utils.projectItems.list.invalidate({ projectId: id }); utils.projects.byId.invalidate({ id }); },
    onError: () => toast.error("Fehler beim Speichern"),
  });
  const deleteItem = trpc.projectItems.delete.useMutation({
    onSuccess: () => { utils.projectItems.list.invalidate({ projectId: id }); utils.projects.byId.invalidate({ id }); toast.success("Position gelöscht"); },
  });
  const addShipment = trpc.shipments.create.useMutation({
    onSuccess: () => { utils.shipments.byProject.invalidate({ projectId: id }); setShowAddShipment(false); toast.success("Versand hinzugefügt"); },
  });
  const addConsultation = trpc.consultation.create.useMutation({
    onSuccess: () => { utils.consultation.list.invalidate({ projectId: id }); setShowAddConsultation(false); toast.success("Beratungseintrag gespeichert"); },
  });
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => { utils.notes.list.invalidate({ projectId: id }); setShowAddNote(false); setNoteForm({ title: "", content: "", priority: "normal" }); toast.success("Notiz gespeichert"); },
    onError: () => toast.error("Fehler beim Speichern"),
  });
  const toggleNoteStatus = trpc.notes.update.useMutation({
    onSuccess: () => utils.notes.list.invalidate({ projectId: id }),
  });
  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => { utils.notes.list.invalidate({ projectId: id }); toast.success("Notiz gelöscht"); },
  });

  const createComplaint = trpc.complaints.create.useMutation({
    onSuccess: () => { utils.complaints.list.invalidate({ projectId: id }); setShowAddComplaint(false); setComplaintForm({ title: "", description: "", status: "open", priority: "normal" }); toast.success("Reklamation angelegt"); },
    onError: () => toast.error("Fehler beim Anlegen"),
  });
  const updateComplaint = trpc.complaints.update.useMutation({
    onSuccess: () => { utils.complaints.list.invalidate({ projectId: id }); setShowEditComplaint(null); toast.success("Reklamation gespeichert"); },
    onError: () => toast.error("Fehler beim Speichern"),
  });
  const deleteComplaint = trpc.complaints.delete.useMutation({
    onSuccess: () => { utils.complaints.list.invalidate({ projectId: id }); toast.success("Reklamation gelöscht"); },
  });
  const deleteDocMut = trpc.projectDocs.delete.useMutation({
    onSuccess: () => { utils.projectDocs.list.invalidate({ projectId: id }); toast.success("Dokument gelöscht"); },
    onError: () => toast.error("Fehler beim Löschen"),
  });
  const deleteProjectMut = trpc.projects.delete.useMutation({
    onSuccess: () => { utils.projects.list.invalidate(); toast.success("Projekt gelöscht"); setLocation("/projects"); },
    onError: () => toast.error("Fehler beim Löschen des Projekts"),
  });
  const updateProjectMut = trpc.projects.update.useMutation({
    onSuccess: () => { utils.projects.byId.invalidate({ id }); utils.projects.list.invalidate(); toast.success("Projekt gespeichert"); setShowEditProject(false); },
    onError: () => toast.error("Fehler beim Speichern"),
  });

  const totalNotesCount = projectNotes.length;

  if (isLoading) return <div className="p-6 text-muted-foreground">Lade Projekt...</div>;
  if (!project) return <div className="p-6 text-muted-foreground">Projekt nicht gefunden</div>;

  const totalEk = parseFloat(project.totalEk ?? "0");
  const totalVk = parseFloat(project.totalVk ?? "0");
  const margin = totalVk - totalEk;
  const marginPct = parseFloat(project.marginPercent ?? "0");

  const editComplaintData = complaints.find((c: any) => c.id === showEditComplaint);

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold truncate">{project.title}</h1>
            {project.projectNumber && <span className="text-muted-foreground text-sm">#{project.projectNumber}</span>}
            <Badge className={`status-${project.status}`}>{STATUS_LABELS[project.status]}</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-yellow-400 hover:text-yellow-300"
              title="Projekt bearbeiten (Titel, Nummer, Typ, Notizen)"
              onClick={() => {
                setEditProjectForm({
                  title: project.title ?? '',
                  projectNumber: project.projectNumber ?? '',
                  type: project.type ?? 'other',
                  notes: project.notes ?? '',
                });
                setShowEditProject(true);
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {/* Abschließen / Wieder öffnen Button */}
            {project.status === 'completed' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs text-amber-400 border-amber-400/40 hover:bg-amber-400/10 hover:border-amber-400/70"
                title="Projekt wieder öffnen (Status zurücksetzen)"
                disabled={changeStatus.isPending}
                onClick={() => changeStatus.mutate({ id, status: 'shipping' as any })}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Wieder öffnen</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs text-emerald-400 border-emerald-400/40 hover:bg-emerald-400/10 hover:border-emerald-400/70"
                title="Projekt als abgeschlossen markieren"
                onClick={() => setShowCompleteConfirm(true)}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Abschließen</span>
              </Button>
            )}
          </div>
          {project.notes && <p className="text-sm text-muted-foreground mt-1">{project.notes}</p>}
          {/* Kunden-Badge / Zuweisungs-Button */}
          <div className="mt-1.5">
            {(project as any).customer ? (
              <button
                onClick={() => {
                  const c = (project as any).customer;
                  const isSupplier = c?._isSupplier;
                  const cid = isSupplier
                    ? `s:${(project as any).supplierId ?? ''}`
                    : `c:${project.customerId ?? ''}`;
                  setAssignCompositeId(cid);
                  setShowAssignCustomer(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 hover:border-blue-400/60 rounded-full px-2.5 py-0.5 transition-colors"
                title="Zuordnung ändern"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {(project as any).customer?.company || (project as any).customer?.name}
                {(project as any).customer?._isSupplier && <span className="ml-1 text-amber-400">(Lieferant)</span>}
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {/* Deutlicher Hinweis-Banner */}
                <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 rounded-lg px-3 py-1.5">
                  <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-300">Kein Kunde zugewiesen</span>
                  <span className="text-xs text-amber-400/70">— Google Drive Sync inaktiv</span>
                </div>
                <button
                  onClick={() => { setAssignCompositeId(''); setShowAssignCustomer(true); }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 hover:border-amber-500/70 rounded-lg px-3 py-1.5 transition-all"
                  title="Kunden oder Lieferant zuweisen"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Jetzt zuweisen
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DriveFolderButton projectId={id} />
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
            onClick={() => {
              const params = new URLSearchParams({
                projectId: String(id),
                projectTitle: project.title ?? '',
                customerId: String(project.customerId ?? ''),
              });
              setLocation(`/invoices/new?${params.toString()}`);
            }}
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Angebot</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
            title="Auftragsbestätigung (PDF/E-Mail)"
            onClick={() => {
              const customer = (project as any).customer;
              setOcForm({
                to: customer?.email ?? '',
                cc: '',
                subject: `Auftragsbestätigung \u2013 ${project.title} (${project.projectNumber ?? project.id})`,
                body: `Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihren Auftrag. Wir bestätigen hiermit den Eingang und die Annahme Ihres Auftrags.\n\nWir werden Ihren Auftrag mit größter Sorgfalt bearbeiten und Sie über den Fortschritt informieren.\n\nBei Fragen stehen wir Ihnen jederzeit zur Verfügung.\n\nMit freundlichen Grüßen\nDaniel Rincón\nFabrica GmbH`,
              });
              setShowOrderConfirmation(true);
            }}
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">AB</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10"
            title="Projekt als ZIP-Backup herunterladen (Notizen als .txt + alle Dokumente als echte Dateien)"
            onClick={() => {
              window.location.href = `/api/export/project/${id}`;
            }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Backup</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            title="Projekt löschen"
            disabled={deleteProjectMut.isPending}
            onClick={() => {
              if (confirm(`Projekt "${project.title}" wirklich löschen?\n\nAlle Positionen, Notizen, Dokumente und Reklamationen werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`)) {
                deleteProjectMut.mutate({ id });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Löschen</span>
          </Button>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_ORDER.filter(s => s !== 'completed' && s !== 'cancelled').map(s => (
          <button key={s} onClick={() => changeStatus.mutate({ id, status: s as any })}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${project.status === s ? `status-${s} scale-105` : "border-border text-muted-foreground hover:border-primary/50"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="bg-card border-border"><CardContent className="p-3 md:p-4">
          <div className="text-xs text-muted-foreground mb-1">EK</div>
          <div className="text-lg md:text-xl font-bold text-yellow-400">{totalEk.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 md:p-4">
          <div className="text-xs text-muted-foreground mb-1">VK</div>
          <div className="text-lg md:text-xl font-bold text-primary">{totalVk.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 md:p-4">
          <div className="text-xs text-muted-foreground mb-1">Marge</div>
          <div className="text-lg md:text-xl font-bold text-green-400">{margin.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € <span className="text-xs">({marginPct.toFixed(1)}%)</span></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList className="bg-secondary flex-wrap h-auto gap-0.5 p-1">
          <TabsTrigger value="items" className="gap-1.5 text-xs md:text-sm"><Package className="h-3.5 w-3.5" /><span className="hidden sm:inline">Positionen</span> ({items.length})</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs md:text-sm"><StickyNote className="h-3.5 w-3.5" /><span className="hidden sm:inline">Notizen</span> ({totalNotesCount})</TabsTrigger>
          <TabsTrigger value="complaints" className="gap-1.5 text-xs md:text-sm">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reklamationen</span>
            {(complaints as any[]).length > 0 && (
              <span className={`ml-0.5 ${(complaints as any[]).some((c: any) => c.status === "open") ? "text-red-400" : ""}`}>({(complaints as any[]).length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="shipment" className="gap-1.5 text-xs md:text-sm"><Truck className="h-3.5 w-3.5" /><span className="hidden sm:inline">Versand</span> ({shipments.length})</TabsTrigger>
          <TabsTrigger value="cad" className="gap-1.5 text-xs md:text-sm"><FileCode2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">CAD</span> ({cadFiles.length})</TabsTrigger>
          <TabsTrigger value="consultation" className="gap-1.5 text-xs md:text-sm"><MessageSquare className="h-3.5 w-3.5" /><span className="hidden sm:inline">Beratung</span> ({consultations.length})</TabsTrigger>
          <TabsTrigger value="datasheet" className="gap-1.5 text-xs md:text-sm"><BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Datenblatt</span></TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5 text-xs md:text-sm"><Paperclip className="h-3.5 w-3.5" /><span className="hidden sm:inline">Dokumente</span>{projectDocs.length > 0 && <span className="ml-0.5">({projectDocs.length})</span>}</TabsTrigger>
          {project.customerId && (
            <TabsTrigger value="akte" className="gap-1.5 text-xs md:text-sm text-blue-400 data-[state=active]:text-blue-300"><FolderOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Akte</span></TabsTrigger>
          )}
          <TabsTrigger value="chat" className="gap-1.5 text-xs md:text-sm text-emerald-400 data-[state=active]:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" /><span className="hidden sm:inline">Kundenportal</span></TabsTrigger>
        </TabsList>

        {/* ── Positionen (editierbar) ── */}
        <TabsContent value="items" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Klick auf einen Wert zum Bearbeiten · Enter oder Klick außen zum Speichern</p>
            <Button size="sm" onClick={() => setShowAddItem(true)} className="gap-2"><Plus className="h-4 w-4" />Position hinzufügen</Button>
          </div>
          {items.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch keine Positionen</div> : (
            <div className="space-y-2">
              {items.map(item => {
                const it = item as any;
                const saveField = (field: string, value: string | number) => updateItem.mutate({ id: item.id, [field]: value } as any);
                return (
                  <div key={item.id} className="p-3 md:p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-all">
                    {/* Zeile 1: Name + Badges */}
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <InlineEdit
                          value={item.name}
                          onSave={v => saveField("name", v)}
                          className="font-medium text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Angebot-Upload Button */}
                        <Button
                          variant="ghost" size="sm"
                          className={`h-7 w-7 p-0 ${it.supplierOfferUrl ? "text-green-400 hover:text-green-300" : "text-muted-foreground hover:text-primary"}`}
                          title={it.supplierOfferUrl ? `Angebot: ${it.supplierOfferName}` : "Lieferanten-Angebot hochladen"}
                          onClick={() => setShowOfferUpload(item.id)}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => deleteItem.mutate({ id: item.id })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Zeile 2: Menge, Material, Technik, Produktion */}
                    <div className="flex items-center gap-3 flex-wrap text-xs mb-2">
                      <span className="text-muted-foreground">Menge:</span>
                      <InlineEdit value={String(item.quantity)} onSave={v => saveField("quantity", parseInt(v) || 1)} type="number" min="1" className="w-12" />
                      <span className="text-muted-foreground">Material:</span>
                      <InlineEdit value={item.material ?? ""} onSave={v => saveField("material", v)} className="min-w-[80px]" />
                      <InlineSelect
                        value={item.technique ?? "other"}
                        options={Object.entries(TECHNIQUE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                        onSave={v => saveField("technique", v)}
                      />
                      <InlineSelect
                        value={item.productionType ?? "external"}
                        options={[{ value: "external", label: "Extern" }, { value: "in_house", label: "In-House" }]}
                        onSave={v => saveField("productionType", v)}
                      />
                    </div>

                    {/* Zeile 3: EK / VK / Marge */}
                    <div className="flex items-center gap-4 flex-wrap text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">EK/Stk:</span>
                        <InlineEdit
                          value={parseFloat(item.unitEk ?? "0").toFixed(2)}
                          onSave={v => saveField("unitEk", v)}
                          type="number" step="0.01"
                          className="w-20 text-yellow-400"
                        />
                        <span className="text-muted-foreground">€</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">VK/Stk:</span>
                        <InlineEdit
                          value={parseFloat(item.unitVk ?? "0").toFixed(2)}
                          onSave={v => saveField("unitVk", v)}
                          type="number" step="0.01"
                          className="w-20 text-primary"
                        />
                        <span className="text-muted-foreground">€</span>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-muted-foreground">EK ges: <span className="text-yellow-400">{parseFloat(item.totalEk ?? "0").toFixed(2)} €</span></div>
                        <div className="text-muted-foreground">VK ges: <span className="text-foreground">{parseFloat(item.totalVk ?? "0").toFixed(2)} €</span></div>
                        <div className="text-green-400">{parseFloat(item.marginPercent ?? "0").toFixed(1)}%</div>
                      </div>
                    </div>

                    {/* Notizen inline */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="mr-1">Notiz:</span>
                      <InlineEdit value={item.notes ?? ""} onSave={v => saveField("notes", v)} />
                    </div>

                    {/* Lieferanten-Angebot Link */}
                    {it.supplierOfferUrl && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        <a href={it.supplierOfferUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline truncate max-w-[200px]">
                          {it.supplierOfferName ?? "Lieferanten-Angebot"}
                        </a>
                        <button
                          onClick={() => updateItem.mutate({ id: item.id, supplierOfferUrl: null, supplierOfferKey: null, supplierOfferName: null } as any)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Angebot entfernen"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Notizen & Erinnerungen ── */}
        <TabsContent value="notes" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{projectNotes.length} Notiz{projectNotes.length !== 1 ? "en" : ""}</p>
            <Button size="sm" onClick={() => setShowAddNote(true)} className="gap-2">
              <Plus className="h-4 w-4" />Notiz hinzufügen
            </Button>
          </div>

          {projectNotes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" /> Notizen
              </h3>
              {projectNotes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onToggle={() => toggleNoteStatus.mutate({ id: note.id, status: note.status === "offen" ? "erledigt" : "offen" })}
                  onDelete={() => deleteNote.mutate({ id: note.id })}
                  onOpen={() => setShowNoteDetail(note.id)}
                  onEdit={() => setShowEditNote(note.id)}
                  onUpload={() => setShowNoteDetail(note.id)}
                />
              ))}
            </div>
          )}



          {totalNotesCount === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <StickyNote className="h-10 w-10 opacity-20" />
              <p className="text-sm">Noch keine Notizen für dieses Projekt</p>
              <Button size="sm" onClick={() => setShowAddNote(true)}>Erste Notiz anlegen</Button>
            </div>
          )}
        </TabsContent>

        {/* ── Reklamationen ── */}
        <TabsContent value="complaints" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{(complaints as any[]).length} Reklamation{(complaints as any[]).length !== 1 ? "en" : ""}</p>
            <Button size="sm" onClick={() => setShowAddComplaint(true)} className="gap-2">
              <Plus className="h-4 w-4" />Reklamation anlegen
            </Button>
          </div>

          {(complaints as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <ShieldAlert className="h-10 w-10 opacity-20" />
              <p className="text-sm">Keine Reklamationen für dieses Projekt</p>
              <Button size="sm" variant="outline" onClick={() => setShowAddComplaint(true)}>Reklamation anlegen</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {(complaints as any[]).map((c: any) => {
                const statusCfg = COMPLAINT_STATUS[c.status] ?? COMPLAINT_STATUS.open;
                const prioCfg = COMPLAINT_PRIORITY[c.priority] ?? COMPLAINT_PRIORITY.normal;
                return (
                  <div key={c.id} className="p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-all group">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className={`h-4 w-4 mt-0.5 shrink-0 ${statusCfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{c.title}</span>
                          <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                          <Badge variant="outline" className={`text-xs ${prioCfg.color}`}>{prioCfg.label}</Badge>
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap mb-1">{c.description}</p>}
                        {c.resolution && (
                          <div className="text-xs text-green-400 border-t border-border pt-1 mt-1">
                            <span className="font-medium">Lösung: </span>{c.resolution}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
                          {c.resolvedAt && <span>· Gelöst: {new Date(c.resolvedAt).toLocaleDateString("de-DE")}</span>}
                          {c.attachments?.length > 0 && <span>· {c.attachments.length} Anhang{c.attachments.length !== 1 ? "hänge" : ""}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowEditComplaint(c.id)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm(`Reklamation "${c.title}" wirklich löschen?`)) deleteComplaint.mutate({ id: c.id }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Anhänge */}
                    {c.attachments?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.attachments.map((a: any) => (
                          <a key={a.id} href={a.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded bg-secondary border border-border">
                            <FileText className="h-3 w-3" />{a.filename}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Versand ── */}
        <TabsContent value="shipment" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddShipment(true)} className="gap-2"><Plus className="h-4 w-4" />Versand hinzufügen</Button>
          </div>
          {shipments.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch kein Versand erfasst</div> : (
            <div className="space-y-2">
              {shipments.map(s => (
                <div key={s.id} className="p-4 rounded-lg bg-card border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">{s.carrier ?? "Unbekannter Carrier"}</span>
                      {s.trackingNumber && (
                        <a
                          href={getTrackingUrl(s.carrier ?? '', s.trackingNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary mt-1 font-mono hover:underline flex items-center gap-1 group"
                          title="Sendungsverfolgung öffnen"
                        >
                          {s.trackingNumber}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {s.shippedAt && <div>Versandt: {new Date(s.shippedAt).toLocaleDateString("de-DE")}</div>}
                      {s.estimatedDelivery && <div>Erwartet: {new Date(s.estimatedDelivery).toLocaleDateString("de-DE")}</div>}
                    </div>
                  </div>
                  {s.notes && <div className="text-xs text-muted-foreground mt-2">{s.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CAD ── */}
        <TabsContent value="cad" className="mt-4">
          <CadTabContent projectId={id} cadFiles={cadFiles} onRefresh={() => utils.cadFiles.byProject.invalidate({ projectId: id })} />
        </TabsContent>

        {/* ── Beratung ── */}
        <TabsContent value="consultation" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddConsultation(true)} className="gap-2"><Plus className="h-4 w-4" />Beratungseintrag</Button>
          </div>
          {consultations.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm">Noch keine Beratungseinträge</div> : (
            <div className="space-y-3">
              {consultations.map(c => (
                <div key={c.id} className="p-4 rounded-lg bg-card border border-border">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.createdAt).toLocaleDateString("de-DE")}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{c.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{c.content}</p>
                  {c.outcome && <div className="mt-2 text-xs text-green-400 border-t border-border pt-2">Ergebnis: {c.outcome}</div>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Datenblatt-Generator ── */}
        <TabsContent value="datasheet" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Links: Konfiguration */}
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-sm mb-1">KI-Datenblatt aus Wissensdatenbank</h3>
                <p className="text-xs text-muted-foreground">Generieren Sie ein professionelles technisches Datenblatt für dieses Projekt. Die KI nutzt Ihre Wissensdatenbank als Grundlage.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Thema / Titel *</Label>
                <Input
                  placeholder={project?.title ?? 'z.B. FDM-Druck in PETG'}
                  value={dsForm.topic}
                  onChange={e => setDsForm(f => ({ ...f, topic: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Zielgruppe</Label>
                  <Select value={dsForm.audience} onValueChange={v => setDsForm(f => ({ ...f, audience: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Kunde (B2B)</SelectItem>
                      <SelectItem value="internal">Intern</SelectItem>
                      <SelectItem value="supplier">Lieferant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sprache</Label>
                  <Select value={dsForm.language} onValueChange={v => setDsForm(f => ({ ...f, language: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Detailtiefe</Label>
                <Select value={dsForm.detail} onValueChange={v => setDsForm(f => ({ ...f, detail: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brief">Kurz (max. 300 Wörter)</SelectItem>
                    <SelectItem value="standard">Standard (400–700 Wörter)</SelectItem>
                    <SelectItem value="detailed">Detailliert (700–1200 Wörter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(knowledgeEntries as any[]).length > 0 && (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowDsEntrySelector(s => !s)}
                  >
                    {showDsEntrySelector ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Wissenseinträge auswählen
                    {dsForm.selectedEntryIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{dsForm.selectedEntryIds.length} ausgewählt</Badge>
                    )}
                  </button>
                  {showDsEntrySelector && (
                    <div className="border border-border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                      <p className="text-xs text-muted-foreground">Leer lassen = KI wählt automatisch passende Einträge</p>
                      {(knowledgeEntries as any[]).map((e: any) => (
                        <div key={e.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`proj-ds-entry-${e.id}`}
                            checked={dsForm.selectedEntryIds.includes(e.id)}
                            onCheckedChange={() => setDsForm(f => ({
                              ...f,
                              selectedEntryIds: f.selectedEntryIds.includes(e.id)
                                ? f.selectedEntryIds.filter(x => x !== e.id)
                                : [...f.selectedEntryIds, e.id],
                            }))}
                          />
                          <label htmlFor={`proj-ds-entry-${e.id}`} className="text-sm cursor-pointer">{e.title}</label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(knowledgeEntries as any[]).length === 0 && (
                <p className="text-xs text-amber-400 bg-amber-400/10 rounded p-2">
                  Noch keine Wissenseinträge vorhanden. Das Datenblatt wird auf Basis allgemeinen 3D-Druck-Fachwissens erstellt.
                </p>
              )}
              <Button
                onClick={() => {
                  const topic = dsForm.topic.trim() || (project?.title ?? '');
                  if (!topic) { toast.error('Bitte ein Thema eingeben'); return; }
                  setGeneratedDatasheet('');
                  generateDsMut.mutate({
                    ...dsForm,
                    topic,
                    projectName: project?.title ?? '',
                  });
                }}
                disabled={generateDsMut.isPending}
                className="w-full gap-2"
              >
                {generateDsMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generiere Datenblatt...</>
                ) : (
                  <><BookOpen className="h-4 w-4" />Datenblatt generieren</>
                )}
              </Button>
            </div>

            {/* Rechts: Vorschau */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vorschau</Label>
                {generatedDatasheet && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const w = window.open('', '_blank');
                    if (!w) return;
                    w.document.write(`<html><head><title>Datenblatt – ${dsForm.topic || project?.title}</title>
                    <style>body{font-family:Arial,sans-serif;font-size:12pt;line-height:1.6;margin:2cm;color:#000;}
                    h1{font-size:18pt;border-bottom:2px solid #333;padding-bottom:6px;}
                    h2{font-size:14pt;color:#333;margin-top:20px;}h3{font-size:12pt;}
                    table{width:100%;border-collapse:collapse;margin:10px 0;}
                    td,th{border:1px solid #ccc;padding:6px 10px;text-align:left;}
                    th{background:#f0f0f0;font-weight:bold;}li{margin-bottom:4px;}
                    @media print{body{margin:1.5cm;}}</style></head><body>
                    <div id='c'></div>
                    <script>document.getElementById('c').innerHTML=${JSON.stringify(
                      generatedDatasheet
                        .replace(/^# (.+)$/gm,'<h1>$1</h1>')
                        .replace(/^## (.+)$/gm,'<h2>$1</h2>')
                        .replace(/^### (.+)$/gm,'<h3>$1</h3>')
                        .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
                        .replace(/^- (.+)$/gm,'<li>$1</li>')
                        .replace(/\n\n/g,'</p><p>')
                    )};window.print();</script></body></html>`);
                    w.document.close();
                  }} className="gap-1.5">
                    <Printer className="h-3.5 w-3.5" /> Als PDF drucken
                  </Button>
                )}
              </div>
              <div className="border border-border rounded-lg p-4 min-h-64 max-h-[50vh] overflow-y-auto bg-muted/20 text-sm">
                {generateDsMut.isPending ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">KI erstellt Datenblatt aus Ihrer Wissensdatenbank...</p>
                    <p className="text-xs">Dies kann 10–20 Sekunden dauern</p>
                  </div>
                ) : generatedDatasheet ? (
                  <div className="whitespace-pre-wrap text-xs leading-relaxed">{generatedDatasheet}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                    <BookOpen className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Hier erscheint das generierte Datenblatt</p>
                    <p className="text-xs text-center max-w-xs">Thema eingeben und auf "Datenblatt generieren" klicken</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Dokumente ── */}
        <TabsContent value="docs" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <p className="text-sm text-muted-foreground hidden sm:block">Projektdokumente</p>
              <Select value={docSupplierFilter} onValueChange={setDocSupplierFilter}>
                <SelectTrigger className="h-8 text-xs w-auto min-w-[160px]">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {(allCustomers as any[]).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">Kunden</div>
                      {(allCustomers as any[]).map((c: any) => (
                        <SelectItem key={`c:${c.id}`} value={`c:${c.id}`}>
                          {c.company || c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {(allSuppliers as any[]).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-semibold">Lieferanten</div>
                      {(allSuppliers as any[]).map((s: any) => (
                        <SelectItem key={`s:${s.id}`} value={`s:${s.id}`}>
                          {s.company || s.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => setShowDocUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" />Dokument hochladen
            </Button>
          </div>
          {(projectDocs as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 border-2 border-dashed border-border rounded-lg">
              <Paperclip className="h-10 w-10 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-sm">Noch keine Dokumente hochgeladen</p>
              <Button variant="outline" size="sm" onClick={() => setShowDocUpload(true)} className="gap-2">
                <Upload className="h-4 w-4" />Erstes Dokument hochladen
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {(projectDocs as any[])
                .filter((doc: any) => {
                  if (docSupplierFilter === "all") return true;
                  if (docSupplierFilter.startsWith('c:')) return String(doc.customerId) === docSupplierFilter.slice(2);
                  if (docSupplierFilter.startsWith('s:')) return String(doc.supplierId) === docSupplierFilter.slice(2);
                  return String(doc.supplierId) === docSupplierFilter;
                })
                .map((doc: any) => {
                  const sup = (allSuppliers as any[]).find((s: any) => s.id === doc.supplierId);
                  const cust = (allCustomers as any[]).find((c: any) => c.id === doc.customerId);
                  const entityName = cust ? (cust.company || cust.name) : sup ? (sup.company || sup.name) : undefined;
                  return (
                    <ProjectDocCard
                      key={doc.id}
                      doc={doc}
                      supplierName={entityName}
                      onNoteUpdated={() => utils.projectDocs.list.invalidate({ projectId: id })}
                      onDelete={() => { if (confirm(`Dokument "${doc.filename}" wirklich löschen?`)) deleteDocMut.mutate({ id: doc.id }); }}
                    />
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* ── Kundenakte (Google Drive) ── */}
        {project.customerId && (
          <TabsContent value="akte" className="mt-4">
            <ProjectAkteTab
              customerId={project.customerId}
              projectId={id}
              customerName={(project as any).customer?.company || (project as any).customer?.name || 'Kunde'}
            />
          </TabsContent>
        )}

        {/* ── Kundenportal & Chat ── */}
        <TabsContent value="chat" className="mt-4">
          <ProjectChatTab projectId={id} />
        </TabsContent>
      </Tabs>

      {/* Projekt-Bearbeiten-Dialog */}
      {showEditProject && (
        <Dialog open={true} onOpenChange={o => { if (!o) setShowEditProject(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit2 className="h-4 w-4 text-yellow-400" />Projekt bearbeiten</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Projekttitel *</Label>
                <Input
                  value={editProjectForm.title}
                  onChange={e => setEditProjectForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="z.B. Gehäuse Müller GmbH"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Projektnummer</Label>
                  <Input
                    value={editProjectForm.projectNumber}
                    onChange={e => setEditProjectForm(f => ({ ...f, projectNumber: e.target.value }))}
                    placeholder="z.B. 2024-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Typ</Label>
                  <Select value={editProjectForm.type} onValueChange={v => setEditProjectForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serial_part">Serienteil</SelectItem>
                      <SelectItem value="spare_part">Ersatzteil</SelectItem>
                      <SelectItem value="museum">Museum</SelectItem>
                      <SelectItem value="consulting">Beratung</SelectItem>
                      <SelectItem value="cad_work">CAD-Arbeit</SelectItem>
                      <SelectItem value="other">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notizen</Label>
                <Textarea
                  value={editProjectForm.notes}
                  onChange={e => setEditProjectForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Interne Anmerkungen..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditProject(false)}>Abbrechen</Button>
              <Button
                onClick={() => updateProjectMut.mutate({
                  id,
                  title: editProjectForm.title,
                  projectNumber: editProjectForm.projectNumber || undefined,
                  type: editProjectForm.type as any,
                  notes: editProjectForm.notes,
                })}
                disabled={!editProjectForm.title || updateProjectMut.isPending}
              >
                {updateProjectMut.isPending ? 'Speichert...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Abschließen-Bestätigungs-Dialog */}
      <AlertDialog open={showCompleteConfirm} onOpenChange={setShowCompleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt abschließen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Projekt wird als abgeschlossen markiert. Es bleibt vollständig bearbeitbar und kann jederzeit wieder geöffnet werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setShowCompleteConfirm(false);
                changeStatus.mutate({ id, status: 'completed' as any });
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Abschließen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dokument-Upload-Dialog */}
      {showDocUpload && (
        <ProjectDocUploadDialog
          projectId={id}
          onClose={() => setShowDocUpload(false)}
          onSuccess={() => { utils.projectDocs.list.invalidate({ projectId: id }); setShowDocUpload(false); }}
        />
      )}

      {/* ── Dialogs ── */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Position hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Bezeichnung *</Label><Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Menge</Label><Input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} /></div>
              <div className="space-y-1.5"><Label>Material</Label><Input value={itemForm.material} onChange={e => setItemForm(f => ({ ...f, material: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Technik</Label>
                <Select value={itemForm.technique} onValueChange={v => setItemForm(f => ({ ...f, technique: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TECHNIQUE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Produktion</Label>
                <Select value={itemForm.productionType} onValueChange={v => setItemForm(f => ({ ...f, productionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="external">Extern</SelectItem><SelectItem value="in_house">In-House</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>EK (Einzel) €</Label><Input type="number" step="0.01" value={itemForm.unitEk} onChange={e => setItemForm(f => ({ ...f, unitEk: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>VK (Einzel) €</Label><Input type="number" step="0.01" value={itemForm.unitVk} onChange={e => setItemForm(f => ({ ...f, unitVk: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Abbrechen</Button>
            <Button onClick={() => addItem.mutate({ projectId: id, name: itemForm.name, quantity: itemForm.quantity, material: itemForm.material || undefined, technique: itemForm.technique as any, productionType: itemForm.productionType as any, unitEk: itemForm.unitEk, unitVk: itemForm.unitVk })} disabled={!itemForm.name || addItem.isPending}>
              {addItem.isPending ? "Speichert..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddShipment} onOpenChange={setShowAddShipment}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Versand erfassen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Carrier</Label><Input placeholder="DHL, UPS, DPD..." value={shipmentForm.carrier} onChange={e => setShipmentForm(f => ({ ...f, carrier: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Trackingnummer</Label><Input placeholder="1Z999AA10123456784" value={shipmentForm.trackingNumber} onChange={e => setShipmentForm(f => ({ ...f, trackingNumber: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notizen</Label><Textarea value={shipmentForm.notes} onChange={e => setShipmentForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddShipment(false)}>Abbrechen</Button>
            <Button onClick={() => addShipment.mutate({ projectId: id, carrier: shipmentForm.carrier || undefined, trackingNumber: shipmentForm.trackingNumber || undefined, notes: shipmentForm.notes || undefined })} disabled={addShipment.isPending}>
              {addShipment.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddConsultation} onOpenChange={setShowAddConsultation}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Beratungseintrag hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titel *</Label><Input value={consultForm.title} onChange={e => setConsultForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Typ</Label>
              <Select value={consultForm.type} onValueChange={v => setConsultForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="material_advice">Materialberatung</SelectItem>
                  <SelectItem value="process_advice">Verfahrensberatung</SelectItem>
                  <SelectItem value="technical_analysis">Technische Analyse</SelectItem>
                  <SelectItem value="offer_discussion">Angebotsgespräch</SelectItem>
                  <SelectItem value="general">Allgemein</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Inhalt *</Label><Textarea value={consultForm.content} onChange={e => setConsultForm(f => ({ ...f, content: e.target.value }))} rows={4} /></div>
            <div className="space-y-1.5"><Label>Ergebnis</Label><Input value={consultForm.outcome} onChange={e => setConsultForm(f => ({ ...f, outcome: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddConsultation(false)}>Abbrechen</Button>
            <Button onClick={() => addConsultation.mutate({ projectId: id, title: consultForm.title, content: consultForm.content, type: consultForm.type as any, outcome: consultForm.outcome || undefined })} disabled={!consultForm.title || !consultForm.content || addConsultation.isPending}>
              {addConsultation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Neue Notiz Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4" />Notiz hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titel *</Label><Input placeholder="Kurze Beschreibung..." value={noteForm.title} onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Inhalt</Label><Textarea placeholder="Details..." value={noteForm.content} onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))} rows={4} /></div>
            <div className="space-y-1.5"><Label>Priorität</Label>
              <Select value={noteForm.priority} onValueChange={v => setNoteForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)}>Abbrechen</Button>
            <Button onClick={() => createNote.mutate({ title: noteForm.title, content: noteForm.content || undefined, projectId: id, priority: noteForm.priority as any })} disabled={!noteForm.title || createNote.isPending}>
              {createNote.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reklamation anlegen */}
      <Dialog open={showAddComplaint} onOpenChange={setShowAddComplaint}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Reklamation anlegen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titel *</Label><Input placeholder="Kurze Beschreibung des Problems..." value={complaintForm.title} onChange={e => setComplaintForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Beschreibung</Label><Textarea placeholder="Detaillierte Beschreibung, Fehlerbild, Kundenmeldung..." value={complaintForm.description} onChange={e => setComplaintForm(f => ({ ...f, description: e.target.value }))} rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={complaintForm.status} onValueChange={v => setComplaintForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Offen</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="resolved">Gelöst</SelectItem>
                    <SelectItem value="closed">Geschlossen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Priorität</Label>
                <Select value={complaintForm.priority} onValueChange={v => setComplaintForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddComplaint(false)}>Abbrechen</Button>
            <Button onClick={() => createComplaint.mutate({ projectId: id, title: complaintForm.title, description: complaintForm.description || undefined, status: complaintForm.status as any, priority: complaintForm.priority as any })} disabled={!complaintForm.title || createComplaint.isPending}>
              {createComplaint.isPending ? "Speichert..." : "Anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reklamation bearbeiten */}
      {showEditComplaint !== null && editComplaintData && (
        <ComplaintEditDialog
          complaint={editComplaintData}
          projectId={id}
          onClose={() => setShowEditComplaint(null)}
          onSave={(data) => updateComplaint.mutate({ id: showEditComplaint, ...data })}
          isPending={updateComplaint.isPending}
        />
      )}

      {/* Notiz-Detail Dialog */}
      {showNoteDetail && (
        <NoteDetailDialog noteId={showNoteDetail} onClose={() => setShowNoteDetail(null)} onRefresh={() => utils.notes.list.invalidate({ projectId: id })} />
      )}

      {/* Notiz bearbeiten Dialog */}
      {showEditNote !== null && (() => {
        const editNote = projectNotes.find((n: any) => n.id === showEditNote);
        if (!editNote) return null;
        return (
          <NoteEditInlineDialog
            note={editNote}
            onClose={() => setShowEditNote(null)}
            onSave={(data) => {
              toggleNoteStatus.mutate({ id: editNote.id, ...data } as any);
              utils.notes.list.invalidate({ projectId: id });
              setShowEditNote(null);
            }}
          />
        );
      })()}

      {/* Lieferanten-Angebot Upload */}
      {showOfferUpload !== null && (
        <SupplierOfferDialog
          projectItemId={showOfferUpload}
          onClose={() => setShowOfferUpload(null)}
          onSuccess={() => { utils.projectItems.list.invalidate({ projectId: id }); setShowOfferUpload(null); }}
        />
      )}

      {/* Auftragsbestätigung Dialog */}
      <Dialog open={showOrderConfirmation} onOpenChange={setShowOrderConfirmation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" />
              Auftragsbestätigung
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Primär: PDF-Download */}
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-sm font-medium mb-1">PDF herunterladen</p>
              <p className="text-xs text-muted-foreground mb-3">Öffnet die Auftragsbestätigung als druckbares PDF im Browser.</p>
              <Button
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white w-full"
                onClick={() => { printOrderConfirmation(); setShowOrderConfirmation(false); }}
                disabled={!companySettings}
              >
                <Printer className="h-4 w-4" />
                PDF öffnen / Drucken
              </Button>
            </div>
            {/* Sekundär: E-Mail senden */}
            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 list-none">
                <ChevronDown className="h-4 w-4 group-open:rotate-180 transition-transform" />
                Per E-Mail senden (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">An (E-Mail) *</Label>
                  <Input value={ocForm.to} onChange={e => setOcForm(f => ({ ...f, to: e.target.value }))} placeholder="kunde@beispiel.de" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CC (optional)</Label>
                  <Input value={ocForm.cc} onChange={e => setOcForm(f => ({ ...f, cc: e.target.value }))} placeholder="cc@beispiel.de" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Betreff</Label>
                  <Input value={ocForm.subject} onChange={e => setOcForm(f => ({ ...f, subject: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nachricht</Label>
                  <Textarea value={ocForm.body} onChange={e => setOcForm(f => ({ ...f, body: e.target.value }))} rows={5} className="mt-1 text-sm" />
                </div>
                <p className="text-xs text-muted-foreground">Die E-Mail enthält automatisch eine Positionsübersicht + PDF-Anhang.</p>
                <Button
                  className="gap-2 w-full"
                  variant="outline"
                  disabled={!ocForm.to || sendOrderConfirmation.isPending}
                  onClick={() => sendOrderConfirmation.mutate({ projectId: id, to: ocForm.to, cc: ocForm.cc || undefined, subject: ocForm.subject, body: ocForm.body })}
                >
                  {sendOrderConfirmation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  E-Mail senden
                </Button>
              </div>
            </details>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderConfirmation(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Kunden-Zuweisungs-Dialog ── */}
      <Dialog open={showAssignCustomer} onOpenChange={setShowAssignCustomer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kunden zuweisen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Wähle den Kunden für dieses Projekt. Die Kundenakte wird automatisch mit allen Projekt-Dateien befüllt.</p>
            <EntitySearch
              options={(projectEntities as any[]).map((e: any) => ({ id: e.compositeId, label: e.label, sublabel: e.group }))}
              value={assignCompositeId || undefined}
              onChange={v => setAssignCompositeId(v ? String(v) : '')}
              placeholder="Kunde oder Lieferant suchen..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignCustomer(false)}>Abbrechen</Button>
            <Button
              onClick={() => {
                const isSupplier = assignCompositeId.startsWith('s:');
                const rawId = assignCompositeId ? parseInt(assignCompositeId.replace(/^[cs]:/, '')) : null;
                assignCustomerMut.mutate({
                  id,
                  customerId: isSupplier ? null : rawId,
                  supplierId: isSupplier ? rawId : null,
                });
              }}
              disabled={assignCustomerMut.isPending}
            >
              {assignCustomerMut.isPending ? 'Speichere...' : 'Zuweisen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── NoteCard ──────────────────────────────────────────────────────────────────
function NoteCard({ note, onToggle, onDelete, onOpen, onEdit, onUpload }: {
  note: { id: number; title: string; content?: string | null; status: string; priority: string; createdAt: Date | string };
  onToggle: () => void; onDelete: () => void; onOpen: () => void; onEdit: () => void; onUpload?: () => void;
}) {
  const prio = PRIORITY_CONFIG[note.priority] ?? PRIORITY_CONFIG.normal;
  const isDone = note.status === "erledigt";
  return (
    <div className={`p-3 rounded-lg border transition-all ${isDone ? "bg-secondary/30 border-border opacity-70" : "bg-card border-border hover:border-primary/40"}`}>
      <div className="flex items-start gap-2">
        <button onClick={onToggle} className="mt-0.5 shrink-0">
          {isDone ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />}
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-sm ${isDone ? "line-through text-muted-foreground" : ""}`}>{note.title}</span>
            {note.priority !== "normal" && <span className={`text-xs ${prio.color}`}>● {prio.label}</span>}
          </div>
          {note.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{note.content}</p>}
          <span className="text-xs text-muted-foreground mt-1 block">{new Date(note.createdAt).toLocaleDateString("de-DE")}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" title="Bearbeiten" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary" title="Anhänge" onClick={(e) => { e.stopPropagation(); onUpload ? onUpload() : onOpen(); }}>
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 w-7 p-0" title="Löschen" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── NoteEditInlineDialog─────────────────────────────────────────────────────────────
function NoteEditInlineDialog({ note, onClose, onSave }: {
  note: { id: number; title: string; content?: string | null; priority: string };
  onClose: () => void;
  onSave: (data: { title: string; content?: string; priority: string }) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content ?? "");
  const [priority, setPriority] = useState(note.priority);
  const utils = trpc.useUtils();
  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => { toast.success("Notiz gespeichert"); onClose(); },
    onError: () => toast.error("Fehler beim Speichern"),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit2 className="h-4 w-4" />Notiz bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Titel *</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Inhalt</Label><Textarea value={content} onChange={e => setContent(e.target.value)} rows={4} /></div>
          <div className="space-y-1.5"><Label>Priorität</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="niedrig">Niedrig</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="hoch">Hoch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => updateNote.mutate({ id: note.id, title, content: content || undefined, priority: priority as any })} disabled={!title || updateNote.isPending}>
            {updateNote.isPending ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── SupplierOfferDialog ──────────────────────────────────────────────────────────────────
function SupplierOfferDialog({ projectItemId, onClose, onSuccess }: { projectItemId: number; onClose: () => void; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const upload = trpc.supplierOffer.upload.useMutation({
    onSuccess: () => { setIsUploading(false); setProgress(0); toast.success("Angebot hochgeladen"); onSuccess(); },
    onError: (e) => { setIsUploading(false); setProgress(0); toast.error("Upload fehlgeschlagen: " + e.message); },
  });

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max. 10 MB"); return; }
    const allowed = ["image/jpeg","image/png","image/webp","application/pdf"];
    if (!allowed.includes(file.type)) { toast.error("Nur JPG, PNG, WebP oder PDF"); return; }
    setIsUploading(true); setProgress(30);
    const reader = new FileReader();
    reader.onload = (e) => {
      setProgress(70);
      const base64 = (e.target?.result as string).split(",")[1];
      upload.mutate({ projectItemId, filename: file.name, fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Paperclip className="h-4 w-4" />Lieferanten-Angebot hochladen</DialogTitle></DialogHeader>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"} ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          {isUploading ? (
            <div className="space-y-2">
              <Upload className="h-6 w-6 mx-auto text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground">Wird hochgeladen...</p>
              <Progress value={progress} className="h-1.5" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center gap-2"><FileText className="h-5 w-5 text-muted-foreground" /><Image className="h-5 w-5 text-muted-foreground" /></div>
              <p className="text-sm text-muted-foreground">PDF oder Bild hier ablegen oder <span className="text-primary">klicken</span></p>
              <p className="text-xs text-muted-foreground/60">JPG, PNG, WebP, PDF · max. 10 MB</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ComplaintEditDialog ───────────────────────────────────────────────────────
function ComplaintEditDialog({ complaint, projectId, onClose, onSave, isPending }: {
  complaint: any; projectId: number; onClose: () => void;
  onSave: (data: any) => void; isPending: boolean;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    title: complaint.title ?? "",
    description: complaint.description ?? "",
    status: complaint.status ?? "open",
    priority: complaint.priority ?? "normal",
    resolution: complaint.resolution ?? "",
  });
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAttachment = trpc.complaints.addAttachment.useMutation({
    onSuccess: () => { utils.complaints.list.invalidate({ projectId }); setIsUploading(false); toast.success("Anhang hochgeladen"); },
    onError: (e) => { setIsUploading(false); toast.error("Upload fehlgeschlagen: " + e.message); },
  });
  const deleteAttachment = trpc.complaints.deleteAttachment.useMutation({
    onSuccess: () => utils.complaints.list.invalidate({ projectId }),
  });

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max. 10 MB"); return; }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      addAttachment.mutate({ complaintId: complaint.id, filename: file.name, fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Reklamation bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Titel *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Beschreibung</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Offen</SelectItem>
                  <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                  <SelectItem value="resolved">Gelöst</SelectItem>
                  <SelectItem value="closed">Geschlossen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Priorität</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="critical">Kritisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Lösung / Maßnahme</Label><Textarea value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} rows={2} placeholder="Wie wurde das Problem gelöst?" /></div>

          {/* Anhänge */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Anhänge (Fotos, Dokumente)</Label>
            {complaint.attachments?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {complaint.attachments.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-1 px-2 py-1 rounded bg-secondary border border-border text-xs group">
                    <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                      <FileText className="h-3 w-3" />{a.filename}
                    </a>
                    <button onClick={() => deleteAttachment.mutate({ id: a.id })} className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"} ${isUploading ? "pointer-events-none opacity-60" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              {isUploading
                ? <p className="text-xs text-muted-foreground">Wird hochgeladen...</p>
                : <p className="text-xs text-muted-foreground">Foto oder Dokument hier ablegen oder <span className="text-primary">klicken</span></p>
              }
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave(form)} disabled={!form.title || isPending}>
            {isPending ? "Speichert..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── NoteDetailDialog ──────────────────────────────────────────────────────────
function NoteDetailDialog({ noteId, onClose, onRefresh }: { noteId: number; onClose: () => void; onRefresh: () => void }) {
  const { data: note, isLoading } = trpc.notes.getById.useQuery({ id: noteId });
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addReminder = trpc.notes.addReminder.useMutation({
    onSuccess: () => { utils.notes.getById.invalidate({ id: noteId }); toast.success("Erinnerung gesetzt"); },
  });
  const deleteReminder = trpc.notes.deleteReminder.useMutation({
    onSuccess: () => utils.notes.getById.invalidate({ id: noteId }),
  });
  const uploadAttachment = trpc.notes.uploadAttachment.useMutation({
    onSuccess: () => { utils.notes.getById.invalidate({ id: noteId }); onRefresh(); setIsUploading(false); setUploadProgress(0); toast.success("Datei hochgeladen"); },
    onError: (err) => { setIsUploading(false); setUploadProgress(0); toast.error("Upload fehlgeschlagen: " + err.message); },
  });
  const deleteAttachment = trpc.notes.deleteAttachment.useMutation({
    onSuccess: () => { utils.notes.getById.invalidate({ id: noteId }); onRefresh(); toast.success("Anhang gelöscht"); },
  });

  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderLabel, setReminderLabel] = useState("");

  const handleAddReminder = () => {
    if (!reminderDate) return;
    const dt = new Date(`${reminderDate}T${reminderTime}:00`);
    addReminder.mutate({ noteId, remindAt: dt.toISOString(), label: reminderLabel || undefined });
    setReminderDate(""); setReminderLabel("");
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error(`Datei zu groß: ${(file.size / 1024 / 1024).toFixed(1)} MB (max. 10 MB)`); return; }
    const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
    if (!allowed.includes(file.type)) { toast.error("Nur Bilder und PDFs erlaubt"); return; }
    setIsUploading(true); setUploadProgress(20);
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadProgress(60);
      const base64 = (e.target?.result as string).split(",")[1];
      setUploadProgress(80);
      uploadAttachment.mutate({ noteId, filename: file.name, fileData: base64, mimeType: file.type, fileSize: file.size });
    };
    reader.readAsDataURL(file);
  };

  if (isLoading || !note) return null;
  const now = new Date();
  const images = note.attachments?.filter((a: any) => a.fileType === "image") ?? [];
  const pdfs = note.attachments?.filter((a: any) => a.fileType !== "image") ?? [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4" />{note.title}</DialogTitle></DialogHeader>
        {note.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>}

        {/* Anhänge */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" /> Anhänge {note.attachments?.length ? `(${note.attachments.length})` : ""}
          </h4>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((att: any) => (
                <div key={att.id} className="relative group rounded-md overflow-hidden border border-border aspect-square bg-secondary">
                  <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"><img src={att.fileUrl} alt={att.filename} className="w-full h-full object-cover" /></a>
                  <button onClick={() => deleteAttachment.mutate({ id: att.id })} className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive">
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {pdfs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pdfs.map((att: any) => (
                <div key={att.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-secondary border border-border group">
                  <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:text-primary transition-colors">
                    <FileText className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <span className="max-w-[140px] truncate">{att.filename}</span>
                  </a>
                  <button onClick={() => deleteAttachment.mutate({ id: att.id })} className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/30"} ${isUploading ? "pointer-events-none opacity-60" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
            {isUploading ? (
              <div className="space-y-2"><Upload className="h-5 w-5 mx-auto text-primary animate-pulse" /><p className="text-xs text-muted-foreground">Wird hochgeladen...</p><Progress value={uploadProgress} className="h-1.5" /></div>
            ) : (
              <p className="text-xs text-muted-foreground">Bild oder PDF hier ablegen oder <span className="text-primary">klicken</span></p>
            )}
          </div>
        </div>

        {/* Erinnerungen */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Erinnerungen</h4>
          {note.reminders && note.reminders.length > 0 ? (
            <div className="space-y-1.5">
              {note.reminders.map((r: any) => {
                const remindDate = new Date(r.remindAt);
                const isPast = remindDate < now;
                const isSent = r.isSent;
                return (
                  <div key={r.id} className={`flex items-center gap-2 p-2 rounded-md border text-xs ${isSent ? "bg-secondary/30 border-border opacity-60" : isPast ? "bg-red-950/30 border-red-900/50" : "bg-secondary/50 border-border"}`}>
                    {isSent ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" /> : isPast ? <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" /> : <Clock className="h-3.5 w-3.5 text-primary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{remindDate.toLocaleDateString("de-DE")} {remindDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                      {r.label && <span className="text-muted-foreground ml-1.5">— {r.label}</span>}
                      {isSent && <span className="text-green-400 ml-1.5">✓ Gesendet</span>}
                      {isPast && !isSent && <span className="text-red-400 ml-1.5">Überfällig</span>}
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteReminder.mutate({ id: r.id })}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-xs text-muted-foreground">Noch keine Erinnerungen</p>}
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium">Neue Erinnerung</p>
            <div className="flex gap-2">
              <Input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} className="text-xs h-8 flex-1" />
              <Input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className="text-xs h-8 w-24" />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Bezeichnung (optional)" value={reminderLabel} onChange={e => setReminderLabel(e.target.value)} className="text-xs h-8 flex-1" />
              <Button size="sm" onClick={handleAddReminder} disabled={!reminderDate || addReminder.isPending} className="h-8 gap-1 text-xs">
                <Bell className="h-3 w-3" /> Setzen
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Schließen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dokument-Kategorie Labels ────────────────────────────────────────────────
const DOC_CATEGORY_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  supplier_offer:  { label: "Lieferantenangebot",        color: "text-blue-400",          icon: "💼" },
  nda:             { label: "Geheimhaltung (NDA)",        color: "text-purple-400",        icon: "🔒" },
  order:           { label: "Bestellung",                 color: "text-green-400",         icon: "📦" },
  delivery_note:   { label: "Lieferschein",               color: "text-cyan-400",          icon: "🚚" },
  invoice:         { label: "Eingangsrechnung",           color: "text-yellow-400",        icon: "🧾" },
  contract:        { label: "Vertrag",                    color: "text-orange-400",        icon: "📝" },
  drawing:         { label: "Zeichnung / Techn. Unterl.", color: "text-pink-400",          icon: "📐" },
  cad_data:        { label: "CAD Daten",                  color: "text-emerald-400",       icon: "🖥️" },
  photo:           { label: "Foto / Bild",                color: "text-green-400",         icon: "📷" },
  protocol:        { label: "Protokoll",                  color: "text-indigo-400",        icon: "📋" },
  rendering:       { label: "3D Rendering",               color: "text-violet-400",        icon: "🎨" },
  other:           { label: "Sonstiges",                  color: "text-muted-foreground",  icon: "📎" },
};

// ─── Dokument-Karte ───────────────────────────────────────────────────────────
// Hilfsfunktion: Dateiformat-Typ ermitteln
function getFilePreviewType(filename: string, mimeType?: string): 'pdf' | 'image' | 'stl' | 'cad_other' | 'none' {
  const name = filename.toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/.test(name) || mime.startsWith('image/')) return 'image';
  if (name.endsWith('.stl')) return 'stl';
  if (/\.(stp|step|obj|3mf|iges|igs)$/.test(name)) return 'cad_other';
  return 'none';
}

function ProjectDocCard({ doc, onDelete, supplierName, onNoteUpdated }: {
  doc: any;
  onDelete: () => void;
  supplierName?: string;
  onNoteUpdated: () => void;
}) {
  const cat = DOC_CATEGORY_LABELS[doc.category] ?? DOC_CATEGORY_LABELS.other;
  const sizeKb = doc.fileSize ? Math.round(doc.fileSize / 1024) : null;
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(doc.notes ?? "");
  const [editingCategory, setEditingCategory] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewType = getFilePreviewType(doc.filename, doc.mimeType);

  const updateNote = trpc.projectDocs.updateNote.useMutation({
    onSuccess: () => { setEditingNote(false); onNoteUpdated(); },
    onError: (e: any) => { import("sonner").then((m: any) => m.toast.error("Fehler: " + e.message)); },
  });

  const updateCategory = trpc.projectDocs.updateCategory.useMutation({
    onSuccess: () => { setEditingCategory(false); onNoteUpdated(); toast.success("Dokumenttyp geändert"); },
    onError: (e: any) => toast.error("Fehler: " + e.message),
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const syncDocMut = trpc.projectDocs.syncToDrive.useMutation({
    onSuccess: () => { setIsSyncing(false); onNoteUpdated(); toast.success("Dokument zu Google Drive synchronisiert"); },
    onError: (e: any) => { setIsSyncing(false); toast.error("Drive-Sync fehlgeschlagen: " + e.message); },
  });

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-all group">
      {/* Icon */}
      <div className="text-2xl w-8 text-center shrink-0 mt-0.5">{cat.icon}</div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:text-primary transition-colors truncate max-w-[280px]"
            title={doc.filename}
          >
            {doc.filename}
          </a>
          {/* Drive-Sync-Status-Icon */}
          {doc.driveSynced === 1 && doc.driveFileId && (
            <a
              href={`https://drive.google.com/file/d/${doc.driveFileId}/view`}
              target="_blank"
              rel="noopener noreferrer"
              title="In Google Drive gespeichert – klicken zum Öffnen"
              className="shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </a>
          )}
          {/* Dokumenttyp – klickbar zum Ändern */}
          {editingCategory ? (
            <Select
              value={doc.category}
              onValueChange={(val) => updateCategory.mutate({ id: doc.id, category: val as any })}
            >
              <SelectTrigger className="h-6 text-xs w-auto min-w-[160px] border-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_CATEGORY_LABELS).map(([v, c]) => (
                  <SelectItem key={v} value={v}>
                    <span className="flex items-center gap-1.5">{c.icon} {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              className={`text-xs ${cat.color} hover:underline hover:decoration-dotted cursor-pointer transition-colors`}
              onClick={() => setEditingCategory(true)}
              title="Typ ändern"
            >
              {cat.label}
            </button>
          )}
          {editingCategory && (
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setEditingCategory(false)} title="Abbrechen">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {sizeKb !== null && (
            <span className="text-xs text-muted-foreground">{sizeKb < 1024 ? `${sizeKb} KB` : `${(sizeKb / 1024).toFixed(1)} MB`}</span>
          )}
          {doc.uploadedBy && (
            <span className="text-xs text-muted-foreground">von {doc.uploadedBy}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(doc.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </span>
        </div>
        {supplierName && (
          <div className="flex items-center gap-1 mt-0.5">
            {doc.customerId
              ? <span className="text-xs text-green-400 font-medium">👤 {supplierName}</span>
              : <span className="text-xs text-blue-400 font-medium">🏗️ {supplierName}</span>
            }
          </div>
        )}

        {/* Notiz – Anzeige oder Inline-Edit */}
        {editingNote ? (
          <div className="mt-2 space-y-1.5">
            <Textarea
              value={noteValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteValue(e.target.value)}
              rows={2}
              autoFocus
              placeholder="Notiz eingeben..."
              className="text-xs min-h-[56px] resize-none"
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-6 text-xs px-2 gap-1"
                onClick={() => updateNote.mutate({ id: doc.id, notes: noteValue })}
                disabled={updateNote.isPending}
              >
                {updateNote.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Speichern
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => { setNoteValue(doc.notes ?? ""); setEditingNote(false); }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1 mt-1 group/note">
            {doc.notes
              ? <p className="text-xs text-muted-foreground italic flex-1">{doc.notes}</p>
              : <p className="text-xs text-muted-foreground/40 italic flex-1 hidden group-hover/note:block">Notiz hinzufügen...</p>
            }
            <Button
              variant="ghost" size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover/note:opacity-100 transition-opacity shrink-0 mt-0.5"
              onClick={() => setEditingNote(true)}
              title="Notiz bearbeiten"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Aktionen */}
      <div className="flex flex-col items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Drive Re-Sync-Button (nur wenn noch nicht synced) */}
        {!doc.driveSynced && (
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400"
            title="Zu Google Drive hochladen"
            disabled={isSyncing}
            onClick={() => { setIsSyncing(true); syncDocMut.mutate({ id: doc.id }); }}
          >
            {isSyncing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 opacity-50">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="currentColor"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="currentColor"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="currentColor"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="currentColor"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="currentColor"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="currentColor"/>
                </svg>
            }
          </Button>
        )}
        {/* Vorschau-Button für PDF, Bilder und CAD */}
        {previewType !== 'none' && (
          <Button
            variant="ghost" size="sm"
            className={`h-7 w-7 p-0 ${
              previewType === 'stl' || previewType === 'cad_other'
                ? 'text-emerald-400 hover:text-emerald-300'
                : 'text-blue-400 hover:text-blue-300'
            }`}
            onClick={() => setShowPreview(true)}
            title={
              previewType === 'pdf' ? 'PDF-Vorschau' :
              previewType === 'image' ? 'Bild-Vorschau' :
              previewType === 'stl' ? '3D-Vorschau (STL)' :
              '3D-Datei-Info'
            }
          >
            {(previewType === 'stl' || previewType === 'cad_other')
              ? <FileCode2 className="h-3.5 w-3.5" />
              : <FileText className="h-3.5 w-3.5" />}
          </Button>
        )}
        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Öffnen / Herunterladen">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Vorschau-Dialog */}
      {showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className={`w-full flex flex-col p-0 gap-0 ${
            previewType === 'stl' ? 'max-w-4xl h-[85vh]' :
            previewType === 'cad_other' ? 'max-w-lg' :
            'max-w-4xl h-[85vh]'
          }`}>
            <DialogHeader className="px-4 py-3 border-b border-border flex-row items-center justify-between shrink-0">
              <DialogTitle className="text-sm font-medium truncate max-w-[500px] flex items-center gap-2">
                {previewType === 'pdf' && <FileText className="h-4 w-4 text-red-400" />}
                {previewType === 'image' && <Image className="h-4 w-4 text-blue-400" />}
                {(previewType === 'stl' || previewType === 'cad_other') && <FileCode2 className="h-4 w-4 text-emerald-400" />}
                {doc.filename}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <a href={doc.fileUrl} download={doc.filename} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                    <Download className="h-3 w-3" />
                    Herunterladen
                  </Button>
                </a>
                {previewType !== 'cad_other' && (
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                      <ExternalLink className="h-3 w-3" />
                      Vollbild
                    </Button>
                  </a>
                )}
              </div>
            </DialogHeader>
            <div className={`${
              previewType === 'cad_other' ? 'p-6' : 'flex-1 overflow-hidden bg-muted/30'
            }`}>
              {previewType === 'pdf' && (
                <iframe
                  src={`${doc.fileUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                  className="w-full h-full border-0"
                  title={doc.filename}
                />
              )}
              {previewType === 'image' && (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={doc.fileUrl}
                    alt={doc.filename}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              )}
              {previewType === 'stl' && (
                <CadViewer url={doc.fileUrl} filename={doc.filename} fileSize={doc.fileSize} />
              )}
              {previewType === 'cad_other' && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <FileCode2 className="h-16 w-16 text-emerald-400/60" />
                  <div>
                    <p className="font-medium">{doc.filename}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {doc.filename.split('.').pop()?.toUpperCase()} · {doc.fileSize ? (doc.fileSize < 1024*1024 ? `${Math.round(doc.fileSize/1024)} KB` : `${(doc.fileSize/1024/1024).toFixed(1)} MB`) : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-3 max-w-xs">
                      {/\.(stp|step)$/i.test(doc.filename)
                        ? 'STEP-Dateien können mit FreeCAD, CATIA, SolidWorks oder Fusion 360 geöffnet werden.'
                        : /\.obj$/i.test(doc.filename)
                        ? 'OBJ-Dateien können mit Blender, MeshLab oder Fusion 360 geöffnet werden.'
                        : /\.3mf$/i.test(doc.filename)
                        ? '3MF-Dateien können mit PrusaSlicer, Bambu Studio oder Cura geöffnet werden.'
                        : /\.(iges|igs)$/i.test(doc.filename)
                        ? 'IGES-Dateien können mit FreeCAD, CATIA oder SolidWorks geöffnet werden.'
                        : 'Diese CAD-Datei kann nicht direkt im Browser angezeigt werden.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Dokument-Upload-Dialog ───────────────────────────────────────────────────
function ProjectDocUploadDialog({
  projectId, onClose, onSuccess,
}: { projectId: number; onClose: () => void; onSuccess: () => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadCurrentName, setUploadCurrentName] = useState('');
  const [category, setCategory] = useState<string>("supplier_offer");
  const [notes, setNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [customerId, setCustomerId] = useState<string>("none");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: supplierList = [] } = trpc.suppliers.list.useQuery();
  const { data: customerList = [] } = trpc.customers.list.useQuery();

  const upload = trpc.projectDocs.upload.useMutation({ onError: (e) => toast.error("Upload fehlgeschlagen: " + e.message) });

  const handleFiles = (files: File[]) => {
    const valid = files.filter(f => {
      if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name}: Max. 25 MB`); return false; }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...valid]);
  };

  const uploadSingleDoc = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        try {
          await upload.mutateAsync({
            projectId,
            supplierId: supplierId && supplierId !== "none" ? parseInt(supplierId) : null,
            customerId: customerId && customerId !== "none" ? parseInt(customerId) : null,
            category: category as any,
            filename: file.name,
            fileBase64: base64,
            mimeType: file.type || "application/octet-stream",
            notes: notes || undefined,
          });
          resolve();
        } catch { reject(); }
      };
      reader.onerror = () => reject();
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;
    setIsUploading(true);
    setUploadTotal(selectedFiles.length);
    setUploadCurrent(0);
    setProgress(0);
    let success = 0;
    for (let i = 0; i < selectedFiles.length; i++) {
      setUploadCurrent(i + 1);
      setUploadCurrentName(selectedFiles[i].name);
      setProgress(Math.round((i / selectedFiles.length) * 100));
      try { await uploadSingleDoc(selectedFiles[i]); success++; } catch { /* already toasted */ }
    }
    setProgress(100);
    setIsUploading(false);
    if (success > 0) {
      toast.success(selectedFiles.length === 1 ? "Dokument hochgeladen" : `${success} von ${selectedFiles.length} Dokumente hochgeladen`);
      onSuccess();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />Dokument hochladen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Kategorie */}
          <div className="space-y-1.5">
            <Label>Dokumenttyp *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DOC_CATEGORY_LABELS).map(([v, c]) => (
                  <SelectItem key={v} value={v}>
                    <span className="flex items-center gap-2">{c.icon} {c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload-Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip,.rar"
              className="hidden"
              onChange={(e) => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />
            <div className="flex justify-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Dateien hier ablegen oder <span className="text-primary">klicken</span></p>
            <p className="text-xs text-muted-foreground/60 mt-1">PDF, Word, Excel, Bilder, ZIP · max. 25 MB · Mehrfachauswahl möglich</p>
          </div>

          {/* Ausgewählte Dateien */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {selectedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 border border-border rounded px-3 py-1.5 bg-muted/20">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 text-xs truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{Math.round(f.size / 1024)} KB</span>
                  {!isUploading && (
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Fortschritt */}
          {isUploading && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{uploadTotal > 1 ? `${uploadCurrent} / ${uploadTotal}` : ''} {uploadCurrentName}</p>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {/* Zuordnung: Kunde oder Lieferant */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kunde (optional)</Label>
              <EntitySearch
                options={(customerList as any[]).map((c: any) => ({
                  id: c.id,
                  label: c.company || c.name,
                  sublabel: c.company ? c.name : (c.email || undefined)
                }))}
                value={customerId && customerId !== 'none' ? parseInt(customerId) : undefined}
                onChange={v => { setCustomerId(v ? String(v) : 'none'); if (v) setSupplierId('none'); }}
                placeholder="Kunde suchen..."
                emptyLabel="Kein Kunde"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lieferant {category === 'supplier_offer' ? '*' : '(optional)'}</Label>
              <EntitySearch
                options={(supplierList as any[]).map((s: any) => ({
                  id: s.id,
                  label: s.company || s.name,
                  sublabel: s.company ? s.name : (s.email || undefined)
                }))}
                value={supplierId && supplierId !== 'none' ? parseInt(supplierId) : undefined}
                onChange={v => { setSupplierId(v ? String(v) : 'none'); if (v) setCustomerId('none'); }}
                placeholder="Lieferant suchen..."
                emptyLabel="Kein Lieferant"
              />
            </div>
          </div>

          {/* Notizen */}
          <div className="space-y-1.5">
            <Label>Notiz (optional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="z.B. Angebot von Lieferant XY, gültig bis 31.03.2026..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFiles.length || isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Wird hochgeladen...</>
            ) : (
              <><Upload className="h-4 w-4" />Hochladen</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CAD-Tab Komponente ─────────────────────────────────────────────────────────
function CadTabContent({ projectId, cadFiles, onRefresh }: {
  projectId: number;
  cadFiles: Array<{ id: number; filename: string; fileUrl: string; fileSize?: number | null; version: number; versionNote?: string | null; uploadedBy?: string | null; createdAt: string; mimeType?: string | null; driveSynced?: number | null; driveFileId?: string | null }>;
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadCurrentName, setUploadCurrentName] = useState('');
  const [viewerFile, setViewerFile] = useState<{ url: string; filename: string; fileSize?: number | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMut = trpc.cadFiles.upload.useMutation({ onError: () => toast.error("Upload fehlgeschlagen") });
  const deleteMut = trpc.cadFiles.delete.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Datei gelöscht"); },
    onError: () => toast.error("Fehler beim Löschen"),
  });
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const syncMut = trpc.cadFiles.syncToDrive.useMutation({
    onSuccess: (_data, vars) => {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(vars.id); return s; });
      onRefresh();
      toast.success("Datei zu Google Drive synchronisiert");
    },
    onError: (_err, vars) => {
      setSyncingIds(prev => { const s = new Set(prev); s.delete(vars.id); return s; });
      toast.error("Drive-Sync fehlgeschlagen");
    },
  });

  const ALLOWED_EXT = ["stl", "stp", "step", "obj", "3mf", "iges", "igs"];
  const MAX_SIZE = 100 * 1024 * 1024; // 100 MB

  const uploadSingleFile = useCallback((file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXT.includes(ext)) {
        toast.error(`${file.name}: Nicht unterstütztes Format`);
        resolve(); return;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: Datei zu groß (max. 100 MB)`);
        resolve(); return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          await uploadMut.mutateAsync({ projectId, filename: file.name, fileData: base64, mimeType: file.type || "application/octet-stream", version: 1 });
          resolve();
        } catch { reject(); }
      };
      reader.onerror = () => reject();
      reader.readAsDataURL(file);
    });
  }, [projectId, uploadMut]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setUploadTotal(files.length);
    setUploadCurrent(0);
    setUploadProgress(0);
    let success = 0;
    for (let i = 0; i < files.length; i++) {
      setUploadCurrent(i + 1);
      setUploadCurrentName(files[i].name);
      setUploadProgress(Math.round(((i) / files.length) * 100));
      try { await uploadSingleFile(files[i]); success++; } catch { /* already toasted */ }
    }
    setUploadProgress(100);
    onRefresh();
    if (success > 0) toast.success(files.length === 1 ? "CAD-Datei hochgeladen" : `${success} von ${files.length} Dateien hochgeladen`);
    setUploading(false);
    setUploadProgress(0);
    setUploadCurrent(0);
    setUploadTotal(0);
    setUploadCurrentName('');
    e.target.value = "";
  }, [uploadSingleFile, onRefresh]);

  const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
  const getExt = (fn: string) => fn.split(".").pop()?.toLowerCase() ?? "";

  return (
    <div className="space-y-4">
      {/* Upload-Bereich */}
      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files);
          if (dropped.length) handleFileChange({ target: { files: e.dataTransfer.files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>);
        }}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden" accept=".stl,.stp,.step,.obj,.3mf,.iges,.igs" onChange={handleFileChange} />
        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="text-sm font-medium">{uploadTotal > 1 ? `${uploadCurrent} / ${uploadTotal} Dateien` : 'Wird hochgeladen...'}</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs mx-auto">{uploadCurrentName}</p>
            <div className="w-full max-w-xs mx-auto bg-secondary rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">CAD-Dateien hochladen</p>
            <p className="text-xs text-muted-foreground">STL, STP, STEP, OBJ, 3MF, IGES · max. 100 MB</p>
            <p className="text-xs text-muted-foreground">Klicken oder Dateien hierher ziehen · Mehrfachauswahl möglich</p>
          </div>
        )}
      </div>

      {/* Dateiliste */}
      {cadFiles.length > 0 && (
        <div className="space-y-2">
          {cadFiles.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border group">
              <CadFileThumbnail filename={f.filename} ext={getExt(f.filename)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {f.fileSize ? formatBytes(f.fileSize) : ""} · v{f.version} · {new Date(f.createdAt).toLocaleDateString("de-DE")}
                  {f.uploadedBy ? ` · ${f.uploadedBy}` : ""}
                </p>
              </div>
              {/* Drive-Sync-Status-Icon oder Re-Sync-Button */}
              {f.driveSynced === 1 && f.driveFileId ? (
                <a
                  href={`https://drive.google.com/file/d/${f.driveFileId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="In Google Drive gespeichert – klicken zum Öffnen"
                  className="shrink-0"
                >
                  <svg className="h-4 w-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                    <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                  </svg>
                </a>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Zu Google Drive hochladen"
                  disabled={syncingIds.has(f.id)}
                  onClick={() => { setSyncingIds(prev => new Set(prev).add(f.id)); syncMut.mutate({ id: f.id }); }}
                >
                  {syncingIds.has(f.id)
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <svg viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 opacity-40">
                        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="currentColor"/>
                        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="currentColor"/>
                        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="currentColor"/>
                        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="currentColor"/>
                        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="currentColor"/>
                        <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="currentColor"/>
                      </svg>
                  }
                </Button>
              )}
              <div className="flex items-center gap-1">
                {/* Vorschau-Button: für STL/OBJ 3D-Viewer, für STP/STEP Info-Dialog – immer sichtbar */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary"
                  title={getExt(f.filename) === "stl" || getExt(f.filename) === "obj" ? "3D-Vorschau" : "Datei-Info & Download"}
                  onClick={() => setViewerFile({ url: f.fileUrl, filename: f.filename, fileSize: f.fileSize })}
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Herunterladen" asChild>
                  <a href={f.fileUrl} download={f.filename} target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Löschen"
                  onClick={() => { if (confirm(`"${f.filename}" wirklich löschen?`)) deleteMut.mutate({ id: f.id }); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cadFiles.length === 0 && !uploading && (
        <p className="text-center text-xs text-muted-foreground py-2">Noch keine CAD-Dateien hochgeladen</p>
      )}

      {/* 3D-Viewer Dialog */}
      {viewerFile && (
        <Dialog open={!!viewerFile} onOpenChange={() => setViewerFile(null)}>
          <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <FileCode2 className="h-4 w-4 text-primary" />
                {viewerFile.filename}
                {viewerFile.fileSize && <span className="text-xs text-muted-foreground font-normal">({formatBytes(viewerFile.fileSize)})</span>}
              </DialogTitle>
            </DialogHeader>
            <div className="px-4 pb-4">
              <CadViewer url={viewerFile.url} filename={viewerFile.filename} fileSize={viewerFile.fileSize} />
            </div>
            <div className="px-4 pb-4 flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Maus: Drehen · Scroll: Zoom · Shift+Maus: Verschieben</p>
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={viewerFile.url} download={viewerFile.filename} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5" />Herunterladen
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

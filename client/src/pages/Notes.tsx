import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Bell,
  BellOff,
  Paperclip,
  Trash2,
  Check,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  File,
  Calendar,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  Download,
} from "lucide-react";


type Priority = "niedrig" | "normal" | "hoch";
type Status = "offen" | "erledigt";
type Source = "whatsapp" | "telefon" | "email" | "persoenlich" | "sonstiges";

const SOURCE_LABELS: Record<Source, string> = {
  whatsapp: "WhatsApp",
  telefon: "Telefon",
  email: "E-Mail",
  persoenlich: "Persönlich",
  sonstiges: "Sonstiges",
};

const SOURCE_COLORS: Record<Source, string> = {
  whatsapp: "bg-green-500/20 text-green-300 border-green-500/30",
  telefon: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  email: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  persoenlich: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  sonstiges: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  niedrig: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  normal: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  hoch: "bg-red-500/20 text-red-300 border-red-500/30",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  niedrig: "Niedrig",
  normal: "Normal",
  hoch: "Hoch",
};

function parseDatePreserveLocal(date: Date | string): Date {
  if (date instanceof Date) return date;
  let str = date;
  // MySQL-Format "YYYY-MM-DD HH:MM:SS" → kein Timezone-Suffix → Browser würde UTC annehmen
  // Wir parsen es manuell als lokale Zeit
  if (str.includes(" ") && !str.includes("T")) {
    str = str.replace(" ", "T");
  }
  // Kein Z und kein Offset → lokale Zeit manuell parsen
  const hasTimezone = str.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(str);
  if (hasTimezone) return new Date(str);
  // Manuell parsen: YYYY-MM-DDTHH:MM[:SS]
  const [datePart, timePart] = str.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = (timePart || "00:00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds || 0);
}

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = parseDatePreserveLocal(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toLocalDatetimeInput(date?: Date | string | null): string {
  if (!date) return "";
  const d = parseDatePreserveLocal(date as string);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Push Notification Helper ─────────────────────────────────────────────────
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function scheduleLocalNotification(label: string, remindAt: Date) {
  const now = Date.now();
  const delay = remindAt.getTime() - now;
  if (delay <= 0) return;
  setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification("📌 Fabrica ERP Erinnerung", {
        body: label,
        icon: "/favicon.ico",
      });
    }
  }, delay);
}

// ─── Attachment Preview ────────────────────────────────────────────────────────
function AttachmentItem({
  att,
  onDelete,
}: {
  att: { id: number; filename: string; fileUrl: string; fileType: string };
  onDelete: (id: number) => void;
}) {
  const isImage = att.fileType === "image";
  const isPdf = att.fileType === "pdf";
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 group">
      {isImage ? (
        <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
      ) : isPdf ? (
        <FileText className="w-4 h-4 text-orange-400 shrink-0" />
      ) : (
        <File className="w-4 h-4 text-slate-400 shrink-0" />
      )}
      <a
        href={att.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-300 hover:text-blue-200 truncate flex-1 hover:underline"
      >
        {att.filename}
      </a>
      <button
        onClick={() => onDelete(att.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Reminder Item ─────────────────────────────────────────────────────────────
function ReminderItem({
  reminder,
  onDelete,
}: {
  reminder: { id: number; label: string | null; remindAt: Date | string; isSent: boolean | number };
  onDelete: (id: number) => void;
}) {
  const isPast = parseDatePreserveLocal(reminder.remindAt as string) < new Date();
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 group">
      <Bell className={`w-4 h-4 shrink-0 ${reminder.isSent ? "text-slate-500" : isPast ? "text-orange-400" : "text-yellow-400"}`} />
      <div className="flex-1 min-w-0">
        {reminder.label && (
          <p className="text-sm text-slate-200 truncate">{reminder.label}</p>
        )}
        <p className={`text-xs ${reminder.isSent ? "text-slate-500 line-through" : isPast ? "text-orange-400" : "text-slate-400"}`}>
          {formatDateTime(reminder.remindAt as string)}
          {reminder.isSent && " (gesendet)"}
          {!reminder.isSent && isPast && " (überfällig)"}
        </p>
      </div>
      <button
        onClick={() => onDelete(reminder.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────
function NoteCard({
  note,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  note: {
    id: number;
    title: string;
    content: string | null;
    status: Status;
    priority: Priority;
    source?: Source | null;
    projectId: number | null;
    createdAt: Date | string;
  };
  onEdit: (id: number) => void;
  onToggleStatus: (id: number, current: Status) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDone = note.status === "erledigt";

  return (
    <Card className={`transition-all duration-200 border ${isDone ? "opacity-60 border-white/5" : "border-white/10 hover:border-white/20"} bg-white/3`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start gap-2">
          <button
            onClick={() => onToggleStatus(note.id, note.status)}
            className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              isDone
                ? "border-green-500 bg-green-500/20 text-green-400"
                : "border-slate-500 hover:border-green-400"
            }`}
          >
            {isDone && <Check className="w-3 h-3" />}
          </button>
          <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-medium text-sm leading-tight ${isDone ? "line-through text-slate-500" : "text-slate-100"}`}>
                {note.title}
              </h3>
              <Badge
                variant="outline"
                className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[note.priority]}`}
              >
                {PRIORITY_LABELS[note.priority]}
              </Badge>
              {note.source && note.source !== "sonstiges" && (
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0 ${SOURCE_COLORS[note.source]}`}
                >
                  {SOURCE_LABELS[note.source]}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(note.createdAt as string)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(note.id)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {note.content && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      {expanded && note.content && (
        <CardContent className="px-4 pb-3 pt-0">
          <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed pl-7">
            {note.content}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Note Edit/Create Dialog ──────────────────────────────────────────────────
function NoteDialog({
  open,
  noteId,
  onClose,
}: {
  open: boolean;
  noteId: number | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: projects } = trpc.projects.list.useQuery();
  const { data: noteData, isLoading } = trpc.notes.getById.useQuery(
    { id: noteId! },
    { enabled: !!noteId }
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [priority, setPriority] = useState<Priority>("normal");
  const [source, setSource] = useState<Source>("sonstiges");
  const [newReminderLabel, setNewReminderLabel] = useState("");
  const [newReminderDate, setNewReminderDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      toast.success("Notiz erstellt");
    },
  });

  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      utils.notes.getById.invalidate({ id: noteId! });
      toast.success("Notiz gespeichert");
    },
  });

  const uploadAttachment = trpc.notes.uploadAttachment.useMutation({
    onSuccess: () => {
      utils.notes.getById.invalidate({ id: noteId! });
      toast.success("Datei hochgeladen");
    },
    onError: (e) => toast.error("Upload fehlgeschlagen: " + e.message),
  });

  const deleteAttachment = trpc.notes.deleteAttachment.useMutation({
    onSuccess: () => utils.notes.getById.invalidate({ id: noteId! }),
  });

  const addReminder = trpc.notes.addReminder.useMutation({
    onSuccess: () => {
      utils.notes.getById.invalidate({ id: noteId! });
      setNewReminderLabel("");
      setNewReminderDate("");
      toast.success("Erinnerung hinzugefügt");
    },
  });

  const deleteReminder = trpc.notes.deleteReminder.useMutation({
    onSuccess: () => utils.notes.getById.invalidate({ id: noteId! }),
  });

  // Populate form when editing
  useEffect(() => {
    if (noteData) {
      setTitle(noteData.title);
      setContent(noteData.content ?? "");
      setProjectId(noteData.projectId ? String(noteData.projectId) : "none");
      setPriority(noteData.priority as Priority);
      setSource((noteData as any).source as Source ?? "sonstiges");
    } else if (!noteId) {
      setTitle("");
      setContent("");
      setProjectId("none");
      setPriority("normal");
      setSource("sonstiges");
    }
  }, [noteData, noteId]);

  const handleSave = async () => {
    if (!title.trim()) return;
    const pid = projectId !== "none" ? parseInt(projectId) : null;
    if (noteId) {
      await updateNote.mutateAsync({ id: noteId, title, content, priority, source });
    } else {
      await createNote.mutateAsync({ title, content, projectId: pid, priority, source });
      onClose();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !noteId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Datei zu groß (max. 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadAttachment.mutateAsync({
          noteId,
          filename: file.name,
          fileData: base64,
          mimeType: file.type,
          fileSize: file.size,
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    e.target.value = "";
  };

  const handleAddReminder = async () => {
    if (!newReminderDate || !noteId) return;
    const granted = await requestNotificationPermission();
    // Sende den datetime-local String direkt (YYYY-MM-DDTHH:MM) ohne UTC-Konvertierung
    // Das Backend speichert ihn als lokale Zeit in der DB
    await addReminder.mutateAsync({
      noteId,
      label: newReminderLabel || undefined,
      remindAt: newReminderDate, // z.B. '2026-03-14T15:44' - keine UTC-Konvertierung!
    });
    if (granted) {
      const remindAt = parseDatePreserveLocal(newReminderDate);
      scheduleLocalNotification(newReminderLabel || title, remindAt);
    }
  };

  const isPending = createNote.isPending || updateNote.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {noteId ? "Notiz bearbeiten" : "Neue Notiz"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Titel *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notiz-Titel..."
              className="bg-white/5 border-white/10 text-slate-100"
            />
          </div>

          {/* Content */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Inhalt</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Notiz-Inhalt..."
              rows={5}
              className="bg-white/5 border-white/10 text-slate-100 resize-none"
            />
          </div>

          {/* Source + Priority + Project */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Quelle</label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telefon">Telefon</SelectItem>
                <SelectItem value="email">E-Mail</SelectItem>
                <SelectItem value="persoenlich">Persönlich</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Priorität</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="niedrig">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="hoch">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Projekt (optional)</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                  <SelectValue placeholder="Kein Projekt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Projekt</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Save button for new note */}
          {!noteId && (
            <Button
              onClick={handleSave}
              disabled={!title.trim() || isPending}
              className="w-full"
            >
              {isPending ? "Speichern..." : "Notiz erstellen"}
            </Button>
          )}

          {/* Attachments (only when editing) */}
          {noteId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">Anhänge</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="h-7 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <Paperclip className="w-3 h-3 mr-1" />
                  {uploading ? "Hochladen..." : "Datei hinzufügen"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              {isLoading ? (
                <p className="text-xs text-slate-500">Lade...</p>
              ) : noteData?.attachments?.length ? (
                <div className="space-y-1.5">
                  {noteData.attachments.map((att) => (
                    <AttachmentItem
                      key={att.id}
                      att={att}
                      onDelete={(id) => deleteAttachment.mutate({ id })}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Keine Anhänge</p>
              )}
            </div>
          )}

          {/* Reminders (only when editing) */}
          {noteId && (
            <div>
              <label className="text-xs text-slate-400 mb-2 block">Erinnerungen</label>
              {noteData?.reminders?.length ? (
                <div className="space-y-1.5 mb-3">
                  {noteData.reminders.map((r) => (
                    <ReminderItem
                      key={r.id}
                      reminder={r}
                      onDelete={(id) => deleteReminder.mutate({ id })}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic mb-3">Keine Erinnerungen</p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={newReminderLabel}
                  onChange={(e) => setNewReminderLabel(e.target.value)}
                  placeholder="Bezeichnung (optional)"
                  className="bg-white/5 border-white/10 text-slate-100 text-sm flex-1 min-w-[140px]"
                />
                <Input
                  type="datetime-local"
                  value={newReminderDate}
                  onChange={(e) => setNewReminderDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-slate-100 text-sm flex-1 min-w-[180px]"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddReminder}
                  disabled={!newReminderDate || addReminder.isPending}
                  className="border-white/10 bg-white/5 hover:bg-white/10 shrink-0"
                >
                  <Bell className="w-3.5 h-3.5 mr-1" />
                  Hinzufügen
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Browser-Benachrichtigungen werden zum eingestellten Zeitpunkt angezeigt (solange diese Seite geöffnet ist).
              </p>
            </div>
          )}

          {/* Save button for existing note */}
          {noteId && (
            <DialogFooter>
              <Button variant="outline" onClick={onClose} className="border-white/10">
                Schließen
              </Button>
              <Button
                onClick={handleSave}
                disabled={!title.trim() || isPending}
              >
                {isPending ? "Speichern..." : "Speichern"}
              </Button>
            </DialogFooter>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Notes Page ──────────────────────────────────────────────────────────
export default function Notes() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<"alle" | "offen" | "erledigt">("offen");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Auto-open create dialog when ?new=1 is in URL (from Schnellnotiz button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setEditingId(null);
      setDialogOpen(true);
      // Remove the query param without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const { data: notes = [], isLoading } = trpc.notes.list.useQuery(
    filter === "alle" ? {} : { status: filter }
  );

  const toggleStatus = trpc.notes.update.useMutation({
    onSuccess: () => utils.notes.list.invalidate(),
  });

  const deleteNote = trpc.notes.delete.useMutation({
    onSuccess: () => {
      utils.notes.list.invalidate();
      toast.success("Notiz gelöscht");
      setDeleteId(null);
    },
  });

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? "granted" : "denied");
    if (granted) toast.success("Browser-Benachrichtigungen aktiviert");
    else toast.error("Benachrichtigungen wurden abgelehnt");
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setDialogOpen(true);
  };

  const handleToggle = (id: number, current: Status) => {
    toggleStatus.mutate({
      id,
      status: current === "offen" ? "erledigt" : "offen",
    });
  };

  const filteredNotes = notes.filter((n) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(s) ||
      (n.content ?? "").toLowerCase().includes(s)
    );
  });

  const openCount = notes.filter((n) => n.status === "offen").length;
  const doneCount = notes.filter((n) => n.status === "erledigt").length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Notizen & Erinnerungen</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {openCount} offen · {doneCount} erledigt
          </p>
        </div>
        <div className="flex items-center gap-2">
          {notifPermission !== "granted" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestNotif}
              className="border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20 text-xs"
            >
              <Bell className="w-3.5 h-3.5 mr-1" />
              Benachrichtigungen aktivieren
            </Button>
          )}
          {notifPermission === "granted" && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Bell className="w-3 h-3" /> Aktiv
            </span>
          )}
          <Button onClick={handleNew} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Neue Notiz
          </Button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Notizen durchsuchen..."
            className="pl-9 bg-white/5 border-white/10 text-slate-100"
          />
        </div>
        <div className="flex gap-1">
          {(["offen", "alle", "erledigt"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={`capitalize ${filter !== f ? "border-white/10 bg-white/5 hover:bg-white/10" : ""}`}
            >
              {f === "offen" ? "Offen" : f === "alle" ? "Alle" : "Erledigt"}
            </Button>
          ))}
        </div>
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {search ? "Keine Notizen gefunden" : filter === "offen" ? "Keine offenen Notizen" : "Keine Notizen"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" onClick={handleNew} className="mt-3 border-white/10">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Erste Notiz erstellen
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note as any}
              onEdit={handleEdit}
              onToggleStatus={handleToggle}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <NoteDialog
        open={dialogOpen}
        noteId={editingId}
        onClose={() => {
          setDialogOpen(false);
          setEditingId(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Notiz löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Diese Notiz wird dauerhaft gelöscht, einschließlich aller Anhänge und Erinnerungen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteNote.mutate({ id: deleteId })}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

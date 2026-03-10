import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock,
  User, Briefcase, FileText, Star, MoreHorizontal, Trash2, Edit2,
  RefreshCw, MapPin, Loader2
} from "lucide-react";

// ─── Typen ───────────────────────────────────────────────────────────────────
type EventCategory = 'customer' | 'project' | 'invoice' | 'personal' | 'other';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  customer: 'Kundentermin',
  project: 'Projektdeadline',
  invoice: 'Rechnung fällig',
  personal: 'Persönlich',
  other: 'Sonstiges',
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  customer: '#22c55e',
  project: '#6366f1',
  invoice: '#f59e0b',
  personal: '#ec4899',
  other: '#64748b',
};

const CATEGORY_ICONS: Record<EventCategory, React.ReactNode> = {
  customer: <User className="w-3 h-3" />,
  project: <Briefcase className="w-3 h-3" />,
  invoice: <FileText className="w-3 h-3" />,
  personal: <Star className="w-3 h-3" />,
  other: <MoreHorizontal className="w-3 h-3" />,
};

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number) {
  const firstDay = startOfMonth(year, month).getDay(); // 0=Sun
  const adjustedFirst = (firstDay + 6) % 7; // Mo=0
  const daysInMonth = getDaysInMonth(year, month);
  const daysInPrev = getDaysInMonth(year, month - 1);

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];

  // Vormonat auffüllen
  for (let i = adjustedFirst - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false });
  }
  // Aktueller Monat
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  // Nächsten Monat auffüllen bis 42 Zellen
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay++), isCurrentMonth: false });
  }
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLocal(ts: number) {
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toDatetimeLocal(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string) {
  return new Date(s).getTime();
}

// ─── Leeres Formular ─────────────────────────────────────────────────────────
function emptyForm(startDate?: Date) {
  const now = startDate ?? new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: '',
    description: '',
    startAt: toDatetimeLocal(start.getTime()),
    endAt: toDatetimeLocal(end.getTime()),
    allDay: false,
    category: 'other' as EventCategory,
    color: '#6366f1',
    location: '',
    customerId: undefined as number | undefined,
    projectId: undefined as number | undefined,
  };
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Calendar() {
  const utils = trpc.useUtils();
  const today = new Date();

  const [view, setView] = useState<'month' | 'week'>('month');
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSyncing, setIsSyncing] = useState(false);

  // Zeitbereich für die Abfrage
  const { from, to } = useMemo(() => {
    const f = new Date(currentYear, currentMonth - 1, 1).getTime();
    const t = new Date(currentYear, currentMonth + 2, 0, 23, 59, 59).getTime();
    return { from: f, to: t };
  }, [currentYear, currentMonth]);

  const { data: events = [], isLoading } = trpc.calendar.list.useQuery({ from, to });
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();

  const createMut = trpc.calendar.create.useMutation({
    onSuccess: () => { utils.calendar.list.invalidate(); setShowForm(false); toast.success('Termin erstellt'); },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });
  const updateMut = trpc.calendar.update.useMutation({
    onSuccess: () => { utils.calendar.list.invalidate(); setShowForm(false); toast.success('Termin gespeichert'); },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });
  const deleteMut = trpc.calendar.delete.useMutation({
    onSuccess: () => { utils.calendar.list.invalidate(); setDeleteId(null); toast.success('Termin gelöscht'); },
  });

  // Monats-Grid
  const grid = useMemo(() => getMonthGrid(currentYear, currentMonth), [currentYear, currentMonth]);

  // Events pro Tag
  function eventsForDay(date: Date) {
    return (events as any[]).filter(ev => {
      const evDate = new Date(ev.startAt);
      return isSameDay(evDate, date);
    });
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  function openNew(date?: Date) {
    setEditId(null);
    setForm(emptyForm(date));
    setShowForm(true);
  }

  function openEdit(ev: any) {
    setEditId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      startAt: toDatetimeLocal(ev.startAt),
      endAt: toDatetimeLocal(ev.endAt),
      allDay: !!ev.allDay,
      category: ev.category ?? 'other',
      color: ev.color ?? '#6366f1',
      location: ev.location ?? '',
      customerId: ev.customerId ?? undefined,
      projectId: ev.projectId ?? undefined,
    });
    setShowForm(true);
  }

  function handleSave() {
    const payload = {
      title: form.title,
      description: form.description || undefined,
      startAt: fromDatetimeLocal(form.startAt),
      endAt: fromDatetimeLocal(form.endAt),
      allDay: form.allDay,
      category: form.category,
      color: form.color,
      location: form.location || undefined,
      customerId: form.customerId,
      projectId: form.projectId,
    };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate(payload);
  }

  // Google Calendar Sync (liest Events und importiert sie)
  async function syncGoogleCalendar() {
    setIsSyncing(true);
    try {
      const timeMin = new Date(currentYear, currentMonth, 1).toISOString();
      const timeMax = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
      const response = await fetch('/api/trpc/calendar.syncFromGoogle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { from: timeMin, to: timeMax } }),
      });
      toast.info('Google Calendar Sync: Bitte verbinde Google Calendar in den Einstellungen');
    } catch {
      toast.error('Google Calendar Sync fehlgeschlagen');
    } finally {
      setIsSyncing(false);
    }
  }

  const isToday = (date: Date) => isSameDay(date, today);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Kalender</h1>
            <Badge variant="outline" className="text-xs">
              {MONTHS[currentMonth]} {currentYear}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={syncGoogleCalendar} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5 hidden sm:inline">Google Sync</span>
            </Button>
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-0 h-8 px-3"
                onClick={() => setView('month')}
              >Monat</Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none border-0 h-8 px-3 border-l border-border"
                onClick={() => setView('week')}
              >Woche</Button>
            </div>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="w-4 h-4 mr-1" /> Termin
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); }}>
            Heute
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm ml-2">{MONTHS[currentMonth]} {currentYear}</span>
        </div>

        {/* Monatsansicht */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {/* Wochentag-Header */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          {/* Kalender-Grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {grid.map(({ date, isCurrentMonth }, idx) => {
              const dayEvents = eventsForDay(date);
              const isSelected = selectedDay && isSameDay(date, selectedDay);
              return (
                <div
                  key={idx}
                  className={`
                    bg-card min-h-[100px] p-1.5 cursor-pointer transition-colors
                    hover:bg-accent/30
                    ${!isCurrentMonth ? 'opacity-40' : ''}
                    ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                  onClick={() => { setSelectedDay(date); }}
                  onDoubleClick={() => openNew(date)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`
                      text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday(date) ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                    `}>
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev: any) => (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer hover:opacity-80 truncate"
                        style={{ backgroundColor: (ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1') + '33', color: ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1', borderLeft: `2px solid ${ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1'}` }}
                        onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                      >
                        {!ev.allDay && <span className="opacity-70 shrink-0">{formatTime(ev.startAt)}</span>}
                        <span className="truncate">{ev.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} weitere</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tages-Detail Panel (wenn Tag ausgewählt) */}
        {selectedDay && (
          <div className="border-t border-border px-6 py-3 bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">
                {selectedDay.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <Button size="sm" variant="outline" onClick={() => openNew(selectedDay)}>
                <Plus className="w-3 h-3 mr-1" /> Termin
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {eventsForDay(selectedDay).length === 0 && (
                <span className="text-sm text-muted-foreground">Keine Termine — Doppelklick auf den Tag um einen Termin zu erstellen.</span>
              )}
              {eventsForDay(selectedDay).map((ev: any) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border cursor-pointer hover:opacity-80"
                  style={{ borderColor: ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1', backgroundColor: (ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1') + '15' }}
                  onClick={() => openEdit(ev)}
                >
                  <span style={{ color: ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1' }}>
                    {CATEGORY_ICONS[ev.category as EventCategory]}
                  </span>
                  <div>
                    <div className="font-medium">{ev.title}</div>
                    {!ev.allDay && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(ev.startAt)} – {formatTime(ev.endAt)}
                      </div>
                    )}
                    {ev.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {ev.location}
                      </div>
                    )}
                  </div>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); openEdit(ev); }}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={(e) => { e.stopPropagation(); setDeleteId(ev.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Termin-Formular (Sheet) ───────────────────────────────────────────── */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle>{editId ? 'Termin bearbeiten' : 'Neuer Termin'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Kundentermin DataCollect"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as EventCategory, color: CATEGORY_COLORS[v as EventCategory] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CATEGORY_COLORS[k as EventCategory] }} />
                          {v}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Farbe</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-9 rounded border border-border cursor-pointer bg-transparent"
                  />
                  <span className="text-sm text-muted-foreground">{form.color}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={form.allDay}
                onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="allDay" className="cursor-pointer">Ganztägig</Label>
            </div>

            {!form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Beginn</Label>
                  <Input type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({ ...f, startAt: e.target.value }))} />
                </div>
                <div>
                  <Label>Ende</Label>
                  <Input type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({ ...f, endAt: e.target.value }))} />
                </div>
              </div>
            )}
            {form.allDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Von</Label>
                  <Input type="date" value={form.startAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, startAt: e.target.value + 'T00:00' }))} />
                </div>
                <div>
                  <Label>Bis</Label>
                  <Input type="date" value={form.endAt.slice(0, 10)} onChange={e => setForm(f => ({ ...f, endAt: e.target.value + 'T23:59' }))} />
                </div>
              </div>
            )}

            <div>
              <Label>Ort / Link</Label>
              <Input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="z.B. Büro, Zoom-Link..."
              />
            </div>

            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Details zum Termin..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kunde</Label>
                <Select value={form.customerId ? String(form.customerId) : 'none'} onValueChange={v => setForm(f => ({ ...f, customerId: v !== 'none' ? parseInt(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Kein Kunde" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Kunde</SelectItem>
                    {(customers as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.company || c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projekt</Label>
                <Select value={form.projectId ? String(form.projectId) : 'none'} onValueChange={v => setForm(f => ({ ...f, projectId: v !== 'none' ? parseInt(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Kein Projekt" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Projekt</SelectItem>
                    {(projects as any[]).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t border-border">
            {editId && (
              <Button variant="ghost" className="text-red-400 mr-auto" onClick={() => { setDeleteId(editId); setShowForm(false); }}>
                <Trash2 className="w-4 h-4 mr-1" /> Löschen
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={!form.title || createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editId ? 'Speichern' : 'Erstellen'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Löschen-Bestätigung ──────────────────────────────────────────────── */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Dieser Termin wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Abbrechen</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} disabled={deleteMut.isPending}>
              {deleteMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

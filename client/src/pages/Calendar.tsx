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
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const adjustedFirst = (firstDay + 6) % 7; // Mo=0
  const daysInMonth = getDaysInMonth(year, month);
  const daysInPrev = getDaysInMonth(year, month - 1);

  const cells: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = adjustedFirst - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay++), isCurrentMonth: false });
  }
  return cells;
}

/** Gibt die 7 Tage der Woche zurück, die das Datum enthält (Mo–So) */
function getWeekDays(date: Date): Date[] {
  const day = date.getDay(); // 0=Sun
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocal(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s: string) {
  return new Date(s).getTime();
}

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
    reminder1Min: null as number | null,
    reminder2Min: null as number | null,
    reminder3Min: null as number | null,
  };
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Calendar() {
  const utils = trpc.useUtils();
  const today = new Date();

  const [view, setView] = useState<'month' | 'week'>('month');
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Zeitbereich für die Abfrage (immer 3 Monate für Monat, 2 Wochen für Woche)
  const { from, to } = useMemo(() => {
    if (view === 'week') {
      const days = getWeekDays(weekAnchor);
      return {
        from: days[0].getTime() - 7 * 24 * 3600000,
        to: days[6].getTime() + 7 * 24 * 3600000,
      };
    }
    return {
      from: new Date(currentYear, currentMonth - 1, 1).getTime(),
      to: new Date(currentYear, currentMonth + 2, 0, 23, 59, 59).getTime(),
    };
  }, [view, currentYear, currentMonth, weekAnchor]);

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

  // Wochentage
  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);

  function eventsForDay(date: Date) {
    return (events as any[]).filter(ev => isSameDay(new Date(ev.startAt), date));
  }

  function prevPeriod() {
    if (view === 'month') {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
      else setCurrentMonth(m => m - 1);
    } else {
      const d = new Date(weekAnchor);
      d.setDate(d.getDate() - 7);
      setWeekAnchor(d);
    }
  }
  function nextPeriod() {
    if (view === 'month') {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
      else setCurrentMonth(m => m + 1);
    } else {
      const d = new Date(weekAnchor);
      d.setDate(d.getDate() + 7);
      setWeekAnchor(d);
    }
  }
  function goToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    setWeekAnchor(d);
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
      reminder1Min: ev.reminder1Min ?? null,
      reminder2Min: ev.reminder2Min ?? null,
      reminder3Min: ev.reminder3Min ?? null,
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
      reminder1Min: form.reminder1Min,
      reminder2Min: form.reminder2Min,
      reminder3Min: form.reminder3Min,
    };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate(payload);
  }

  const syncMut = trpc.calendar.syncFromGoogle.useMutation({
    onSuccess: (data) => {
      utils.calendar.list.invalidate();
      setLastSync(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      toast.success(`✅ Google Sync: ${data.message}`);
      setIsSyncing(false);
    },
    onError: (e) => {
      toast.error(`Google Sync Fehler: ${e.message}`);
      setIsSyncing(false);
    },
  });

  function syncGoogleCalendar() {
    setIsSyncing(true);
    syncMut.mutate({});
  }

  const isToday = (date: Date) => isSameDay(date, today);

  // Perioden-Label
  const periodLabel = view === 'month'
    ? `${MONTHS[currentMonth]} ${currentYear}`
    : (() => {
        const first = weekDays[0];
        const last = weekDays[6];
        if (first.getMonth() === last.getMonth()) {
          return `${first.getDate()}. – ${last.getDate()}. ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
        }
        return `${first.getDate()}. ${MONTHS[first.getMonth()]} – ${last.getDate()}. ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
      })();

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">Kalender</h1>
            <Badge variant="outline" className="text-xs">{periodLabel}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={syncGoogleCalendar} disabled={isSyncing}
              title={lastSync ? `Zuletzt synchronisiert: ${lastSync}` : 'Google Calendar synchronisieren'}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-green-500" />}
              <span className="ml-1.5 hidden sm:inline">{lastSync ? `Sync (${lastSync})` : 'Google Sync'}</span>
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevPeriod}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>Heute</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextPeriod}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm ml-2">{periodLabel}</span>
        </div>

        {/* Kalender-Inhalt */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade Termine...
            </div>
          ) : view === 'month' ? (
            /* ── MONATSANSICHT ── */
            <>
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>
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
                      onClick={() => setSelectedDay(date)}
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
                            style={{
                              backgroundColor: (ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1') + '33',
                              color: ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1',
                              borderLeft: `2px solid ${ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1'}`
                            }}
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
            </>
          ) : (
            /* ── WOCHENANSICHT ── */
            <>
              {/* Wochentag-Header */}
              <div className="grid grid-cols-7 gap-px mb-1">
                {weekDays.map((date, i) => (
                  <div key={i} className={`text-center py-2 rounded-t ${isToday(date) ? 'bg-primary/10' : ''}`}>
                    <div className="text-xs font-semibold text-muted-foreground">{WEEKDAYS[i]}</div>
                    <div className={`
                      text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full mx-auto
                      ${isToday(date) ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                    `}>
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>
              {/* Wochentag-Spalten */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {weekDays.map((date, i) => {
                  const dayEvents = eventsForDay(date);
                  return (
                    <div
                      key={i}
                      className={`bg-card min-h-[400px] p-2 cursor-pointer hover:bg-accent/20 transition-colors ${isToday(date) ? 'bg-primary/5' : ''}`}
                      onDoubleClick={() => openNew(date)}
                      onClick={() => setSelectedDay(date)}
                    >
                      {dayEvents.length === 0 && (
                        <div className="text-[10px] text-muted-foreground/40 text-center mt-4">–</div>
                      )}
                      <div className="space-y-1">
                        {dayEvents.map((ev: any) => (
                          <div
                            key={ev.id}
                            className="px-2 py-1.5 rounded text-xs font-medium cursor-pointer hover:opacity-80"
                            style={{
                              backgroundColor: (ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1') + '25',
                              color: ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1',
                              borderLeft: `3px solid ${ev.color ?? CATEGORY_COLORS[ev.category as EventCategory] ?? '#6366f1'}`
                            }}
                            onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                          >
                            {!ev.allDay && (
                              <div className="text-[10px] opacity-70 mb-0.5">{formatTime(ev.startAt)} – {formatTime(ev.endAt)}</div>
                            )}
                            <div className="truncate">{ev.title}</div>
                            {ev.location && (
                              <div className="flex items-center gap-1 text-[10px] opacity-60 mt-0.5 truncate">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />{ev.location}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
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

            <div className="flex flex-col gap-3">
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

            {/* ─── Erinnerungen ─── */}
            <div>
              <Label className="mb-2 block">Erinnerungen</Label>
              <div className="flex flex-col gap-2">
                {[
                  { key: 'reminder1Min' as const, label: '1. Erinnerung' },
                  { key: 'reminder2Min' as const, label: '2. Erinnerung' },
                  { key: 'reminder3Min' as const, label: '3. Erinnerung' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                    <Select
                      value={form[key] !== null ? String(form[key]) : 'none'}
                      onValueChange={v => setForm(f => ({ ...f, [key]: v !== 'none' ? parseInt(v) : null }))}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Keine" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine</SelectItem>
                        <SelectItem value="10080">1 Woche vorher</SelectItem>
                        <SelectItem value="1440">1 Tag vorher</SelectItem>
                        <SelectItem value="60">1 Stunde vorher</SelectItem>
                        <SelectItem value="30">30 Min vorher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
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

import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, FileText, Receipt, Search, Download, Lock, XCircle,
  ChevronDown, ChevronUp, Trash2, Eye, History, AlertTriangle,
  CheckCircle, Clock, Send, Euro
} from "lucide-react";

// ─── Typen ───────────────────────────────────────────────────────────────────
type TaxMode = 'standard' | 'reduced' | 'mixed' | 'tax_free' | 'kleinunternehmer';
type InvoiceType = 'offer' | 'invoice' | 'credit_note';
type InvoiceStatus = 'draft' | 'sent' | 'accepted' | 'invoiced' | 'paid' | 'cancelled' | 'overdue';

interface InvoiceItem {
  position: number;
  description: string;
  quantity: string;
  unit: string;
  unitPriceNet: string;
  taxRate: string;
  lineTotalNet: string;
  lineTax: string;
  lineTotalGross: string;
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Entwurf', sent: 'Gesendet', accepted: 'Angenommen',
  invoiced: 'Rechnung gestellt', paid: 'Bezahlt', cancelled: 'Storniert', overdue: 'Überfällig',
};
const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  accepted: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  invoiced: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  paid: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  overdue: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};
const TYPE_LABELS: Record<InvoiceType, string> = {
  offer: 'Angebot', invoice: 'Rechnung', credit_note: 'Gutschrift',
};
const TAX_MODE_LABELS: Record<TaxMode, string> = {
  standard: '19% MwSt (Standard)',
  reduced: '7% MwSt (ermäßigt)',
  mixed: 'Gemischt (je Position)',
  tax_free: 'Steuerfrei (§4 UStG)',
  kleinunternehmer: 'Kleinunternehmer (§19 UStG)',
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function calcItem(item: InvoiceItem, taxMode: TaxMode): InvoiceItem {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPriceNet) || 0;
  const rate = taxMode === 'kleinunternehmer' || taxMode === 'tax_free' ? 0
    : taxMode === 'standard' ? 19
    : taxMode === 'reduced' ? 7
    : parseFloat(item.taxRate) || 19;
  const net = qty * price;
  const tax = net * rate / 100;
  return {
    ...item,
    taxRate: String(rate),
    lineTotalNet: net.toFixed(2),
    lineTax: tax.toFixed(2),
    lineTotalGross: (net + tax).toFixed(2),
  };
}

function calcTotals(items: InvoiceItem[]) {
  const net = items.reduce((s, i) => s + parseFloat(i.lineTotalNet || '0'), 0);
  const tax = items.reduce((s, i) => s + parseFloat(i.lineTax || '0'), 0);
  return { subtotalNet: net.toFixed(2), taxAmount: tax.toFixed(2), totalGross: (net + tax).toFixed(2) };
}

function formatEur(val: string | number | null | undefined) {
  const n = parseFloat(String(val ?? 0));
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Leere Position ───────────────────────────────────────────────────────────
function emptyItem(pos: number): InvoiceItem {
  return { position: pos, description: '', quantity: '1', unit: 'Stk.', unitPriceNet: '0.00', taxRate: '19', lineTotalNet: '0.00', lineTax: '0.00', lineTotalGross: '0.00' };
}

// ─── Formular-Standardwerte ───────────────────────────────────────────────────
const DEFAULT_SENDER = {
  senderName: 'Daniel Rincón',
  senderStreet: 'Hüttenstraße 205',
  senderZip: '50170',
  senderCity: 'Kerpen-Sindorf',
  senderTaxId: '',
  senderVatId: '',
  senderEmail: 'd.rincon@fabrica3d.eu',
  senderPhone: '+49 2273 9529429',
  senderIban: '',
  senderBic: '',
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Invoices() {
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<'all' | 'offer' | 'invoice' | 'credit_note'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showAudit, setShowAudit] = useState<number | null>(null);

  // Daten laden
  const { data: invoiceList = [], isLoading } = trpc.invoices.list.useQuery(undefined);
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: detailData } = trpc.invoices.getById.useQuery(
    { id: showDetail! }, { enabled: showDetail !== null }
  );
  const { data: auditData = [] } = trpc.invoices.auditLog.useQuery(
    { id: showAudit! }, { enabled: showAudit !== null }
  );

  // Mutationen
  const createMut = trpc.invoices.create.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); setShowForm(false); toast.success('Erstellt'); } });
  const updateMut = trpc.invoices.update.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); setShowForm(false); toast.success('Gespeichert'); } });
  const statusMut = trpc.invoices.changeStatus.useMutation({ onSuccess: () => utils.invoices.list.invalidate() });
  const lockMut = trpc.invoices.lock.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); toast.success('Rechnung finalisiert — GoBD-konform gesperrt.'); } });
  const cancelMut = trpc.invoices.cancel.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); toast.success('Storniert'); } });
  const deleteMut = trpc.invoices.delete.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); toast.success('Gelöscht'); } });
  const { data: csvData } = trpc.invoices.exportCsv.useQuery(undefined);
  const { data: datevData } = trpc.invoices.exportDatev.useQuery(undefined);

  // Formular-State
  const [form, setForm] = useState({
    type: 'offer' as InvoiceType,
    customerId: undefined as number | undefined,
    projectId: undefined as number | undefined,
    ...DEFAULT_SENDER,
    recipientName: '',
    recipientCompany: '',
    recipientStreet: '',
    recipientZip: '',
    recipientCity: '',
    recipientEmail: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    deliveryDate: '',
    paymentTerms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
    taxMode: 'standard' as TaxMode,
    introText: '',
    notes: '',
    footerText: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem(1)]);

  const totals = useMemo(() => calcTotals(items), [items]);

  // Formular öffnen (neu oder bearbeiten)
  function openNew(type: InvoiceType = 'offer') {
    setEditId(null);
    setForm({ type, customerId: undefined, projectId: undefined, ...DEFAULT_SENDER, recipientName: '', recipientCompany: '', recipientStreet: '', recipientZip: '', recipientCity: '', recipientEmail: '', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', deliveryDate: '', paymentTerms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.', taxMode: 'standard', introText: '', notes: '', footerText: '' });
    setItems([emptyItem(1)]);
    setShowForm(true);
  }

  function openEdit(inv: any) {
    setEditId(inv.id);
    setForm({
      type: inv.type, customerId: inv.customerId ?? undefined, projectId: inv.projectId ?? undefined,
      senderName: inv.senderName ?? DEFAULT_SENDER.senderName,
      senderStreet: inv.senderStreet ?? DEFAULT_SENDER.senderStreet,
      senderZip: inv.senderZip ?? DEFAULT_SENDER.senderZip,
      senderCity: inv.senderCity ?? DEFAULT_SENDER.senderCity,
      senderTaxId: inv.senderTaxId ?? '',
      senderVatId: inv.senderVatId ?? '',
      senderEmail: inv.senderEmail ?? DEFAULT_SENDER.senderEmail,
      senderPhone: inv.senderPhone ?? DEFAULT_SENDER.senderPhone,
      senderIban: inv.senderIban ?? '',
      senderBic: inv.senderBic ?? '',
      recipientName: inv.recipientName ?? '',
      recipientCompany: inv.recipientCompany ?? '',
      recipientStreet: inv.recipientStreet ?? '',
      recipientZip: inv.recipientZip ?? '',
      recipientCity: inv.recipientCity ?? '',
      recipientEmail: inv.recipientEmail ?? '',
      issueDate: inv.issueDate ?? new Date().toISOString().slice(0, 10),
      dueDate: inv.dueDate ?? '',
      deliveryDate: inv.deliveryDate ?? '',
      paymentTerms: inv.paymentTerms ?? 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
      taxMode: inv.taxMode ?? 'standard',
      introText: inv.introText ?? '',
      notes: inv.notes ?? '',
      footerText: inv.footerText ?? '',
    });
    setItems((inv.items ?? []).map((it: any) => ({
      position: it.position, description: it.description,
      quantity: it.quantity ?? '1', unit: it.unit ?? 'Stk.',
      unitPriceNet: it.unitPriceNet ?? '0.00', taxRate: it.taxRate ?? '19',
      lineTotalNet: it.lineTotalNet ?? '0.00', lineTax: it.lineTax ?? '0.00',
      lineTotalGross: it.lineTotalGross ?? '0.00',
    })));
    setShowForm(true);
  }

  // Kunde auswählen → Empfänger vorausfüllen
  function onCustomerSelect(id: string) {
    const cid = parseInt(id);
    const c = customers.find((x: any) => x.id === cid);
    if (c) {
      setForm(f => ({
        ...f, customerId: cid,
        recipientName: c.name ?? '',
        recipientCompany: c.company ?? '',
        recipientStreet: (c as any).street ?? '',
        recipientZip: (c as any).zip ?? '',
        recipientCity: (c as any).city ?? '',
        recipientEmail: c.email ?? '',
      }));
    }
  }

  // Position bearbeiten
  function updateItem(idx: number, field: keyof InvoiceItem, val: string) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [field]: val }, form.taxMode);
      return next;
    });
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem(prev.length + 1)]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, position: i + 1 })));
  }

  // Speichern
  async function handleSave() {
    const payload = { ...form, ...totals, items };
    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload as any);
    }
  }

  // Gefilterte Liste
  const filtered = useMemo(() => {
    return invoiceList.filter((inv: any) => {
      if (tab !== 'all' && inv.type !== tab) return false;
      if (search) {
        const s = search.toLowerCase();
        return inv.invoiceNumber?.toLowerCase().includes(s) ||
          inv.recipientName?.toLowerCase().includes(s) ||
          inv.recipientCompany?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [invoiceList, tab, search]);

  // PDF-Druckansicht (Browser-Print)
  function printInvoice(inv: any) {
    const taxModeNote = inv.taxMode === 'kleinunternehmer'
      ? '<p style="margin-top:16px;font-size:11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>' : '';
    const itemRows = (inv.items ?? []).map((it: any, i: number) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.description}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(it.quantity ?? 1).toLocaleString('de-DE')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.unit ?? 'Stk.'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${parseFloat(it.unitPriceNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${it.taxRate ?? 19} %</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${parseFloat(it.lineTotalGross ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${inv.invoiceNumber}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:1cm;color:#111;}
    table{width:100%;border-collapse:collapse;}th{background:#f5f5f5;text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;}
    .totals td{padding:4px 8px;}.totals tr:last-child td{font-weight:700;font-size:14px;border-top:2px solid #111;}
    @media print{button{display:none}}</style></head><body>
    <table style="margin-bottom:24px;"><tr>
      <td style="width:50%;vertical-align:top;"><strong style="font-size:16px;">Fabrica GmbH</strong><br>
        ${inv.senderStreet ?? ''}<br>${inv.senderZip ?? ''} ${inv.senderCity ?? ''}<br>
        ${inv.senderEmail ?? ''}<br>${inv.senderPhone ?? ''}<br>
        ${inv.senderVatId ? 'USt-IdNr: ' + inv.senderVatId : ''}</td>
      <td style="width:50%;vertical-align:top;text-align:right;">
        <strong style="font-size:20px;">${TYPE_LABELS[inv.type as InvoiceType] ?? inv.type}</strong><br>
        <strong>Nr. ${inv.invoiceNumber}</strong><br>
        Datum: ${inv.issueDate ?? ''}<br>
        ${inv.dueDate ? 'Fälligkeit: ' + inv.dueDate : ''}
        ${inv.deliveryDate ? '<br>Lieferdatum: ' + inv.deliveryDate : ''}
      </td></tr></table>
    <table style="margin-bottom:24px;"><tr>
      <td><strong>Empfänger:</strong><br>
        ${inv.recipientCompany ? '<strong>' + inv.recipientCompany + '</strong><br>' : ''}
        ${inv.recipientName ?? ''}<br>
        ${inv.recipientStreet ?? ''}<br>${inv.recipientZip ?? ''} ${inv.recipientCity ?? ''}
      </td></tr></table>
    ${inv.introText ? '<p>' + inv.introText + '</p>' : ''}
    <table style="margin-bottom:16px;">
      <thead><tr><th>#</th><th>Beschreibung</th><th style="text-align:right">Menge</th><th>Einheit</th><th style="text-align:right">EP netto</th><th style="text-align:right">MwSt</th><th style="text-align:right">Gesamt brutto</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table class="totals" style="width:300px;margin-left:auto;">
      <tr><td>Nettobetrag:</td><td style="text-align:right">${parseFloat(inv.subtotalNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>
      <tr><td>MwSt:</td><td style="text-align:right">${parseFloat(inv.taxAmount ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>
      <tr><td>Gesamtbetrag:</td><td style="text-align:right">${parseFloat(inv.totalGross ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>
    </table>
    ${taxModeNote}
    ${inv.paymentTerms ? '<p style="margin-top:24px;">' + inv.paymentTerms + '</p>' : ''}
    ${inv.senderIban ? '<p>IBAN: ' + inv.senderIban + (inv.senderBic ? ' | BIC: ' + inv.senderBic : '') + '</p>' : ''}
    ${inv.notes ? '<p style="margin-top:16px;color:#555;">' + inv.notes + '</p>' : ''}
    ${inv.footerText ? '<p style="margin-top:24px;font-size:10px;color:#888;">' + inv.footerText + '</p>' : ''}
    <p style="margin-top:32px;font-size:9px;color:#aaa;">SHA-256: ${inv.contentHash ?? 'noch nicht finalisiert'}</p>
    <script>window.onload=()=>window.print();</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Angebote & Rechnungen</h1>
            <p className="text-muted-foreground text-sm">GoBD-konform nach §14 UStG</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => csvData && downloadCsv(csvData.csv, 'Rechnungen.csv')}>
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => datevData && downloadCsv(datevData.csv, datevData.filename ?? 'DATEV.csv')}>
              <Download className="w-4 h-4 mr-1" /> DATEV
            </Button>
            <Button variant="outline" size="sm" onClick={() => openNew('offer')}>
              <FileText className="w-4 h-4 mr-1" /> Angebot
            </Button>
            <Button size="sm" onClick={() => openNew('invoice')}>
              <Plus className="w-4 h-4 mr-1" /> Rechnung
            </Button>
          </div>
        </div>

        {/* Tabs + Suche */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Tabs value={tab} onValueChange={v => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="offer">Angebote</TabsTrigger>
              <TabsTrigger value="invoice">Rechnungen</TabsTrigger>
              <TabsTrigger value="credit_note">Gutschriften</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* KPI-Karten */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Offen', val: invoiceList.filter((i: any) => i.status === 'invoiced').length, icon: Clock, color: 'text-yellow-400' },
            { label: 'Bezahlt', val: invoiceList.filter((i: any) => i.status === 'paid').length, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Überfällig', val: invoiceList.filter((i: any) => i.status === 'overdue').length, icon: AlertTriangle, color: 'text-orange-400' },
            { label: 'Umsatz (brutto)', val: formatEur(invoiceList.filter((i: any) => i.type === 'invoice' && i.status === 'paid').reduce((s: number, i: any) => s + parseFloat(i.totalGross ?? 0), 0)), icon: Euro, color: 'text-blue-400' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color}`} />
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-bold">{val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Liste */}
        <div className="space-y-2">
          {isLoading && <p className="text-muted-foreground text-sm">Lade...</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Noch keine Einträge</p>
            </div>
          )}
          {filtered.map((inv: any) => (
            <div key={inv.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono font-semibold text-sm">{inv.invoiceNumber}</span>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[inv.type as InvoiceType]}</Badge>
                  <Badge className={`text-xs border ${STATUS_COLORS[inv.status as InvoiceStatus]}`}>
                    {STATUS_LABELS[inv.status as InvoiceStatus]}
                  </Badge>
                  {inv.isLocked ? <Lock className="w-3 h-3 text-yellow-400" /> : null}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground">{inv.issueDate}</span>
                  <span className="font-bold text-green-400">{formatEur(inv.totalGross)}</span>
                </div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {[inv.recipientCompany, inv.recipientName].filter(Boolean).join(' — ')}
                {inv.dueDate && <span className="ml-3 text-xs">Fällig: {inv.dueDate}</span>}
              </div>
              {/* Aktionen */}
              <div className="mt-3 flex gap-2 flex-wrap">
                {!inv.isLocked && (
                  <Button size="sm" variant="outline" onClick={() => { openEdit(inv); }}>Bearbeiten</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowDetail(inv.id)}>
                  <Eye className="w-3 h-3 mr-1" /> Ansicht
                </Button>
                <Button size="sm" variant="outline" onClick={() => printInvoice(inv)}>
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>
                {!inv.isLocked && inv.type === 'invoice' && inv.status !== 'cancelled' && (
                  <Button size="sm" variant="outline" className="text-yellow-400 border-yellow-400/30" onClick={() => { if (confirm('Rechnung finalisieren (GoBD-gesperrt)?')) lockMut.mutate({ id: inv.id }); }}>
                    <Lock className="w-3 h-3 mr-1" /> Finalisieren
                  </Button>
                )}
                {inv.status !== 'cancelled' && inv.status !== 'draft' && (
                  <Button size="sm" variant="outline" className="text-red-400 border-red-400/30" onClick={() => { if (confirm('Stornieren? Eine Gutschrift wird erstellt.')) cancelMut.mutate({ id: inv.id }); }}>
                    <XCircle className="w-3 h-3 mr-1" /> Stornieren
                  </Button>
                )}
                {inv.status === 'draft' && (
                  <Button size="sm" variant="outline" className="text-red-400 border-red-400/30" onClick={() => { if (confirm('Entwurf löschen?')) deleteMut.mutate({ id: inv.id }); }}>
                    <Trash2 className="w-3 h-3 mr-1" /> Löschen
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowAudit(inv.id)}>
                  <History className="w-3 h-3 mr-1" /> Protokoll
                </Button>
                {/* Status-Schnellwechsel */}
                {!inv.isLocked && (
                  <Select value={inv.status} onValueChange={v => statusMut.mutate({ id: inv.id, status: v })}>
                    <SelectTrigger className="h-8 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Formular-Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Bearbeiten' : 'Neu'}: {TYPE_LABELS[form.type]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Typ + Kunde + Projekt */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as InvoiceType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offer">Angebot</SelectItem>
                    <SelectItem value="invoice">Rechnung</SelectItem>
                    <SelectItem value="credit_note">Gutschrift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kunde</Label>
                <Select value={form.customerId ? String(form.customerId) : 'none'} onValueChange={v => v !== 'none' ? onCustomerSelect(v) : setForm(f => ({ ...f, customerId: undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Kunde</SelectItem>
                    {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.company || c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projekt</Label>
                <Select value={form.projectId ? String(form.projectId) : 'none'} onValueChange={v => setForm(f => ({ ...f, projectId: v !== 'none' ? parseInt(v) : undefined }))}>
                  <SelectTrigger><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Projekt</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Absender */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Absender (Ihr Unternehmen)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.senderName} onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} /></div>
                <div><Label>Straße</Label><Input value={form.senderStreet} onChange={e => setForm(f => ({ ...f, senderStreet: e.target.value }))} /></div>
                <div><Label>PLZ</Label><Input value={form.senderZip} onChange={e => setForm(f => ({ ...f, senderZip: e.target.value }))} /></div>
                <div><Label>Ort</Label><Input value={form.senderCity} onChange={e => setForm(f => ({ ...f, senderCity: e.target.value }))} /></div>
                <div><Label>Steuernummer</Label><Input value={form.senderTaxId} onChange={e => setForm(f => ({ ...f, senderTaxId: e.target.value }))} /></div>
                <div><Label>USt-IdNr.</Label><Input value={form.senderVatId} onChange={e => setForm(f => ({ ...f, senderVatId: e.target.value }))} /></div>
                <div><Label>E-Mail</Label><Input value={form.senderEmail} onChange={e => setForm(f => ({ ...f, senderEmail: e.target.value }))} /></div>
                <div><Label>Telefon</Label><Input value={form.senderPhone} onChange={e => setForm(f => ({ ...f, senderPhone: e.target.value }))} /></div>
                <div><Label>IBAN</Label><Input value={form.senderIban} onChange={e => setForm(f => ({ ...f, senderIban: e.target.value }))} /></div>
                <div><Label>BIC</Label><Input value={form.senderBic} onChange={e => setForm(f => ({ ...f, senderBic: e.target.value }))} /></div>
              </div>
            </div>

            {/* Empfänger */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Empfänger (Kunde)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Firma</Label><Input value={form.recipientCompany} onChange={e => setForm(f => ({ ...f, recipientCompany: e.target.value }))} /></div>
                <div><Label>Ansprechpartner</Label><Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} /></div>
                <div><Label>Straße</Label><Input value={form.recipientStreet} onChange={e => setForm(f => ({ ...f, recipientStreet: e.target.value }))} /></div>
                <div><Label>PLZ</Label><Input value={form.recipientZip} onChange={e => setForm(f => ({ ...f, recipientZip: e.target.value }))} /></div>
                <div><Label>Ort</Label><Input value={form.recipientCity} onChange={e => setForm(f => ({ ...f, recipientCity: e.target.value }))} /></div>
                <div><Label>E-Mail</Label><Input value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} /></div>
              </div>
            </div>

            {/* Daten + Steuer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label>Ausstellungsdatum *</Label><Input type="date" value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} /></div>
              <div><Label>Fälligkeitsdatum</Label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
              <div><Label>Lieferdatum</Label><Input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} /></div>
              <div>
                <Label>Steuerregelung *</Label>
                <Select value={form.taxMode} onValueChange={v => { setForm(f => ({ ...f, taxMode: v as TaxMode })); setItems(prev => prev.map(it => calcItem(it, v as TaxMode))); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAX_MODE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Positionen */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Positionen</h3>
                <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Position</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs border-b border-border">
                      <th className="text-left pb-2 w-8">#</th>
                      <th className="text-left pb-2">Beschreibung</th>
                      <th className="text-right pb-2 w-20">Menge</th>
                      <th className="text-left pb-2 w-20">Einheit</th>
                      <th className="text-right pb-2 w-28">EP netto</th>
                      {form.taxMode === 'mixed' && <th className="text-right pb-2 w-20">MwSt %</th>}
                      <th className="text-right pb-2 w-28">Gesamt brutto</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 text-muted-foreground">{it.position}</td>
                        <td className="py-2 pr-2"><Input className="h-8 text-sm" value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Leistungsbeschreibung" /></td>
                        <td className="py-2 pr-2"><Input className="h-8 text-sm text-right w-20" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                        <td className="py-2 pr-2"><Input className="h-8 text-sm w-20" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} /></td>
                        <td className="py-2 pr-2"><Input className="h-8 text-sm text-right w-28" value={it.unitPriceNet} onChange={e => updateItem(idx, 'unitPriceNet', e.target.value)} /></td>
                        {form.taxMode === 'mixed' && <td className="py-2 pr-2"><Input className="h-8 text-sm text-right w-20" value={it.taxRate} onChange={e => updateItem(idx, 'taxRate', e.target.value)} /></td>}
                        <td className="py-2 text-right font-semibold text-green-400">{parseFloat(it.lineTotalGross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                        <td className="py-2 pl-2"><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => removeItem(idx)}><Trash2 className="w-3 h-3" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Summen */}
              <div className="flex justify-end">
                <div className="text-sm space-y-1 min-w-[220px]">
                  <div className="flex justify-between text-muted-foreground"><span>Netto:</span><span>{formatEur(totals.subtotalNet)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>MwSt:</span><span>{formatEur(totals.taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t border-border pt-1"><span>Gesamt:</span><span className="text-green-400">{formatEur(totals.totalGross)}</span></div>
                  {form.taxMode === 'kleinunternehmer' && (
                    <p className="text-xs text-muted-foreground mt-2">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Texte */}
            <div className="grid grid-cols-1 gap-3">
              <div><Label>Einleitungstext</Label><Textarea value={form.introText} onChange={e => setForm(f => ({ ...f, introText: e.target.value }))} rows={2} placeholder="z.B. Vielen Dank für Ihre Anfrage..." /></div>
              <div><Label>Zahlungsbedingungen</Label><Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
              <div><Label>Interne Notiz</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              <div><Label>Fußzeile</Label><Input value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} placeholder="z.B. Handelsregister, Geschäftsführer..." /></div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editId ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Detail-Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={showDetail !== null} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailData?.invoiceNumber} — {TYPE_LABELS[detailData?.type as InvoiceType]}</DialogTitle>
          </DialogHeader>
          {detailData && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Absender</p>
                  <p className="font-semibold">{detailData.senderName}</p>
                  <p>{detailData.senderStreet}</p>
                  <p>{detailData.senderZip} {detailData.senderCity}</p>
                  {detailData.senderVatId && <p>USt-IdNr: {detailData.senderVatId}</p>}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Empfänger</p>
                  <p className="font-semibold">{detailData.recipientCompany}</p>
                  <p>{detailData.recipientName}</p>
                  <p>{detailData.recipientStreet}</p>
                  <p>{detailData.recipientZip} {detailData.recipientCity}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-muted-foreground">Datum:</span> {detailData.issueDate}</div>
                <div><span className="text-muted-foreground">Fällig:</span> {detailData.dueDate ?? '—'}</div>
                <div><span className="text-muted-foreground">Lieferdatum:</span> {detailData.deliveryDate ?? '—'}</div>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead><tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-1">#</th><th className="text-left py-1">Beschreibung</th>
                  <th className="text-right py-1">Menge</th><th className="text-right py-1">EP netto</th>
                  <th className="text-right py-1">MwSt</th><th className="text-right py-1">Gesamt</th>
                </tr></thead>
                <tbody>{(detailData.items ?? []).map((it: any, i: number) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1">{it.position}</td>
                    <td className="py-1">{it.description}</td>
                    <td className="py-1 text-right">{parseFloat(it.quantity ?? 1).toLocaleString('de-DE')} {it.unit}</td>
                    <td className="py-1 text-right">{formatEur(it.unitPriceNet)}</td>
                    <td className="py-1 text-right">{it.taxRate} %</td>
                    <td className="py-1 text-right font-semibold">{formatEur(it.lineTotalGross)}</td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="flex justify-end text-sm space-y-1 flex-col items-end">
                <div className="flex gap-4 text-muted-foreground"><span>Netto:</span><span>{formatEur(detailData.subtotalNet)}</span></div>
                <div className="flex gap-4 text-muted-foreground"><span>MwSt:</span><span>{formatEur(detailData.taxAmount)}</span></div>
                <div className="flex gap-4 font-bold text-base"><span>Gesamt:</span><span className="text-green-400">{formatEur(detailData.totalGross)}</span></div>
              </div>
              {detailData.contentHash && (
                <p className="text-xs text-muted-foreground break-all">SHA-256: {detailData.contentHash}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => printInvoice(detailData)}><Download className="w-3 h-3 mr-1" /> PDF drucken</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Audit-Log-Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showAudit !== null} onOpenChange={() => setShowAudit(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Änderungsprotokoll (GoBD)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {auditData.length === 0 && <p className="text-muted-foreground">Keine Einträge</p>}
            {auditData.map((log: any) => (
              <div key={log.id} className="border border-border rounded p-3 text-xs">
                <div className="flex justify-between text-muted-foreground mb-1">
                  <span className="font-semibold uppercase">{log.action}</span>
                  <span>{new Date(log.changedAt).toLocaleString('de-DE')}</span>
                </div>
                {log.changedBy && <p>Benutzer: {log.changedBy}</p>}
                {log.fieldChanged && <p>Feld: <code>{log.fieldChanged}</code></p>}
                {log.oldValue && <p className="text-red-400">Alt: {log.oldValue}</p>}
                {log.newValue && <p className="text-green-400">Neu: {log.newValue}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

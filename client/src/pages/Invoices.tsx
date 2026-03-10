import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, FileText, Receipt, Search, Download, Lock, XCircle,
  ChevronDown, ChevronUp, Trash2, Eye, History, AlertTriangle,
  CheckCircle, Clock, Send, Euro, Loader2, Printer, BookOpen, ArrowRight
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
  senderName: '',
  senderStreet: '',
  senderZip: '',
  senderCity: '',
  senderTaxId: '',
  senderVatId: '',
  senderEmail: '',
  senderPhone: '',
  senderIban: '',
  senderBic: '',
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Invoices() {
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();

  const [tab, setTab] = useState<'all' | 'offer' | 'invoice' | 'credit_note'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showAudit, setShowAudit] = useState<number | null>(null);

  // Datenblatt-Generator State
  const [showDatasheetGen, setShowDatasheetGen] = useState(false);
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

  // Daten laden
  const { data: invoiceList = [], isLoading } = trpc.invoices.list.useQuery(undefined);
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: companySettings } = trpc.companySettings.get.useQuery();
  const { data: detailData } = trpc.invoices.getById.useQuery(
    { id: showDetail! }, { enabled: showDetail !== null }
  );
  const { data: auditData = [] } = trpc.invoices.auditLog.useQuery(
    { id: showAudit! }, { enabled: showAudit !== null }
  );

  // Mutationen
  const createMut = trpc.invoices.create.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); setShowForm(false); toast.success('Erstellt'); },
    onError: (err) => toast.error(`Fehler beim Erstellen: ${err.message}`),
  });
  const updateMut = trpc.invoices.update.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); setShowForm(false); toast.success('Gespeichert'); },
    onError: (err) => toast.error(`Fehler beim Speichern: ${err.message}`),
  });
  const statusMut = trpc.invoices.changeStatus.useMutation({ onSuccess: () => utils.invoices.list.invalidate() });
  const lockMut = trpc.invoices.lock.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); toast.success('Rechnung finalisiert — GoBD-konform gesperrt.'); } });
  const cancelMut = trpc.invoices.cancel.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); toast.success('Storniert'); } });
  const deleteMut = trpc.invoices.delete.useMutation({ onSuccess: () => { utils.invoices.list.invalidate(); toast.success('Gelöscht'); } });
  const convertMut = trpc.invoices.convertToInvoice.useMutation({
    onSuccess: (data) => {
      utils.invoices.list.invalidate();
      toast.success(`✅ Rechnung ${data.invoiceNumber} wurde erstellt`);
      setTab('invoice');
    },
    onError: (e) => toast.error('Fehler: ' + e.message),
  });
  const { data: csvData } = trpc.invoices.exportCsv.useQuery(undefined);
  const { data: datevData } = trpc.invoices.exportDatev.useQuery(undefined);
  const { data: knowledgeEntries = [] } = trpc.knowledge.list.useQuery({});
  const generateDsMut = trpc.knowledge.generateDatasheet.useMutation({
    onSuccess: (data) => {
      setGeneratedDatasheet(data.text);
      toast.success(`Datenblatt generiert — ${data.usedEntries.length} Wissenseinträge verwendet`);
    },
    onError: () => toast.error('Fehler bei der Datenblatt-Generierung'),
  });

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

  // Firmendaten aus Einstellungen als Sender vorausfüllen
  function buildSenderFromSettings() {
    if (!companySettings) return DEFAULT_SENDER;
    return {
      senderName: [companySettings.name, companySettings.legalForm].filter(Boolean).join(' ') || '',
      senderStreet: companySettings.street ?? '',
      senderZip: companySettings.zip ?? '',
      senderCity: companySettings.city ?? '',
      senderTaxId: companySettings.taxNumber ?? '',
      senderVatId: companySettings.vatId ?? '',
      senderEmail: companySettings.email ?? '',
      senderPhone: companySettings.phone ?? '',
      senderIban: companySettings.iban ?? '',
      senderBic: companySettings.bic ?? '',
    };
  }

  // Formular öffnen (neu oder bearbeiten)
  function openNew(type: InvoiceType = 'offer', prefill?: { projectId?: number; customerId?: number; projectItems?: any[] }) {
    setEditId(null);
    const sender = buildSenderFromSettings();
    const footer = companySettings?.invoiceFooter ?? '';
    setForm({ type, customerId: prefill?.customerId, projectId: prefill?.projectId, ...sender, recipientName: '', recipientCompany: '', recipientStreet: '', recipientZip: '', recipientCity: '', recipientEmail: '', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', deliveryDate: '', paymentTerms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.', taxMode: companySettings?.kleinunternehmer ? 'kleinunternehmer' : 'standard', introText: '', notes: '', footerText: footer });
    // Wenn Projekt-Positionen mitgegeben werden, vorausfüllen
    if (prefill?.projectItems?.length) {
      const mapped = prefill.projectItems.map((it: any, idx: number) => ({
        position: idx + 1,
        description: [it.name, it.material].filter(Boolean).join(' – '),
        quantity: String(it.quantity ?? 1),
        unit: 'Stk.',
        unitPriceNet: parseFloat(it.unitVk ?? '0').toFixed(2),
        taxRate: '19',
        lineTotalNet: (parseFloat(it.unitVk ?? '0') * (it.quantity ?? 1)).toFixed(2),
        lineTax: (parseFloat(it.unitVk ?? '0') * (it.quantity ?? 1) * 0.19).toFixed(2),
        lineTotalGross: (parseFloat(it.unitVk ?? '0') * (it.quantity ?? 1) * 1.19).toFixed(2),
      }));
      setItems(mapped.length ? mapped : [emptyItem(1)]);
    } else {
      setItems([emptyItem(1)]);
    }
    // Wenn Kunde mitgegeben, Empfänger vorausfüllen
    if (prefill?.customerId) {
      const c = customers.find((x: any) => x.id === prefill.customerId);
      if (c) {
        setForm(f => ({
          ...f,
          recipientName: (c as any).name ?? '',
          recipientCompany: (c as any).company ?? '',
          recipientStreet: (c as any).street ?? '',
          recipientZip: (c as any).zip ?? '',
          recipientCity: (c as any).city ?? '',
          recipientEmail: (c as any).email ?? '',
        }));
      }
    }
    setShowForm(true);
  }

  // URL-Parameter: projectId für Positionen-Vorausfüllung
  const [pendingProjectId, setPendingProjectId] = useState<number | undefined>(undefined);
  const [pendingCustomerId, setPendingCustomerId] = useState<number | undefined>(undefined);
  const { data: pendingProjectItems } = trpc.projectItems.list.useQuery(
    { projectId: pendingProjectId! },
    { enabled: pendingProjectId !== undefined }
  );

  // URL-Parameter verarbeiten (/invoices/new?projectId=1&customerId=2)
  useEffect(() => {
    if (location.startsWith('/invoices/new')) {
      const searchStr = window.location.search;
      const params = new URLSearchParams(searchStr);
      const projectId = params.get('projectId') ? parseInt(params.get('projectId')!) : undefined;
      const customerId = params.get('customerId') ? parseInt(params.get('customerId')!) : undefined;
      if (projectId) {
        setPendingProjectId(projectId);
        setPendingCustomerId(customerId);
      } else {
        openNew('offer', { customerId });
        setLocation('/invoices');
      }
    }
  }, [location]);

  // Wenn Projekt-Positionen geladen sind, Formular öffnen
  useEffect(() => {
    if (pendingProjectId !== undefined && pendingProjectItems !== undefined) {
      openNew('offer', { projectId: pendingProjectId, customerId: pendingCustomerId, projectItems: pendingProjectItems });
      setPendingProjectId(undefined);
      setPendingCustomerId(undefined);
      setLocation('/invoices');
    }
  }, [pendingProjectItems]);

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
                {/* In Rechnung umwandeln — nur für Angebote, die nicht storniert/bereits umgewandelt sind */}
                {inv.type === 'offer' && inv.status !== 'cancelled' && inv.status !== 'invoiced' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-400 border-green-400/30 hover:bg-green-400/10"
                    disabled={convertMut.isPending}
                    onClick={() => {
                      if (confirm(`Angebot ${inv.invoiceNumber} in eine Rechnung umwandeln?\n\nAlle Positionen und Kundendaten werden übernommen.`))
                        convertMut.mutate({ offerId: inv.id });
                    }}
                  >
                    {convertMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowRight className="w-3 h-3 mr-1" />}
                    In Rechnung umwandeln
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
      {/* ─── Formular-Sheet (Vollbild) ──────────────────────────────────────────────────────────────────────── */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="right" className="w-full sm:max-w-none sm:w-[calc(100vw-16rem)] overflow-y-auto flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle>{editId ? 'Bearbeiten' : 'Neu'}: {TYPE_LABELS[form.type]}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-5">
            {/* Typ + Kunde + Projekt */}
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_1fr] gap-3">
              <div className="min-w-0">
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as InvoiceType }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offer">Angebot</SelectItem>
                    <SelectItem value="invoice">Rechnung</SelectItem>
                    <SelectItem value="credit_note">Gutschrift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label>Kunde</Label>
                <Select value={form.customerId ? String(form.customerId) : 'none'} onValueChange={v => v !== 'none' ? onCustomerSelect(v) : setForm(f => ({ ...f, customerId: undefined }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Kunde</SelectItem>
                    {customers.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.company || c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0">
                <Label>Projekt</Label>
                <Select value={form.projectId ? String(form.projectId) : 'none'} onValueChange={v => setForm(f => ({ ...f, projectId: v !== 'none' ? parseInt(v) : undefined }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Projekt wählen" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Projekt</SelectItem>
                    {projects.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Absender + Empfänger nebeneinander */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Absender */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Absender (Ihr Unternehmen)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Name</Label><Input value={form.senderName} onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>Straße</Label><Input value={form.senderStreet} onChange={e => setForm(f => ({ ...f, senderStreet: e.target.value }))} /></div>
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
                  <div className="col-span-2"><Label>Straße</Label><Input value={form.recipientStreet} onChange={e => setForm(f => ({ ...f, recipientStreet: e.target.value }))} /></div>
                  <div><Label>PLZ</Label><Input value={form.recipientZip} onChange={e => setForm(f => ({ ...f, recipientZip: e.target.value }))} /></div>
                  <div><Label>Ort</Label><Input value={form.recipientCity} onChange={e => setForm(f => ({ ...f, recipientCity: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>E-Mail</Label><Input value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} /></div>
                </div>
              </div>
            </div>

            {/* Daten + Steuer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

            {/* Datenblatt-Generator */}
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">KI-Datenblatt generieren</h3>
                  <Badge variant="secondary" className="text-xs">optional</Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => {
                    setDsForm(f => ({
                      ...f,
                      topic: form.projectId ? (projects.find((p: any) => p.id === form.projectId) as any)?.name ?? '' : '',
                      customerName: form.recipientCompany || form.recipientName,
                      projectName: form.projectId ? (projects.find((p: any) => p.id === form.projectId) as any)?.name ?? '' : '',
                    }));
                    setGeneratedDatasheet('');
                    setShowDatasheetGen(true);
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Datenblatt erstellen
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Generieren Sie ein technisches Datenblatt aus Ihrer Wissensdatenbank und fügen Sie es dem Angebot bei.
                {generatedDatasheet && (
                  <span className="text-green-400 ml-2">✓ Datenblatt bereit — wird beim Drucken beigefügt</span>
                )}
              </p>
              {generatedDatasheet && (
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowDatasheetGen(true)}>
                    <Eye className="h-3 w-3" /> Vorschau
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setGeneratedDatasheet('')}>
                    <XCircle className="h-3 w-3" /> Entfernen
                  </Button>
                </div>
              )}
            </div>

            {/* Texte */}
            <div className="grid grid-cols-1 gap-3">
              <div><Label>Einleitungstext</Label><Textarea value={form.introText} onChange={e => setForm(f => ({ ...f, introText: e.target.value }))} rows={2} placeholder="z.B. Vielen Dank für Ihre Anfrage..." /></div>
              <div><Label>Zahlungsbedingungen</Label><Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
              <div><Label>Interne Notiz</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              <div><Label>Fußzeile</Label><Input value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} placeholder="z.B. Handelsregister, Geschäftsführer..." /></div>
            </div>
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t border-border">
            <Button variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editId ? 'Speichern' : 'Erstellen'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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

      {/* ─── Datenblatt-Generator-Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showDatasheetGen} onOpenChange={setShowDatasheetGen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              KI-Datenblatt generieren
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Links: Konfiguration */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Thema / Titel des Datenblatts *</Label>
                <Input
                  placeholder="z.B. FDM-Druck in PETG, Toleranzen und Oberflächen"
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Kundenname (optional)</Label>
                  <Input placeholder="Keck GmbH" value={dsForm.customerName} onChange={e => setDsForm(f => ({ ...f, customerName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Projektname (optional)</Label>
                  <Input placeholder="KZ Testmodell" value={dsForm.projectName} onChange={e => setDsForm(f => ({ ...f, projectName: e.target.value }))} />
                </div>
              </div>
              {knowledgeEntries.length > 0 && (
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
                      {knowledgeEntries.map((e: any) => (
                        <div key={e.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`ds-entry-${e.id}`}
                            checked={dsForm.selectedEntryIds.includes(e.id)}
                            onCheckedChange={() => setDsForm(f => ({
                              ...f,
                              selectedEntryIds: f.selectedEntryIds.includes(e.id)
                                ? f.selectedEntryIds.filter(x => x !== e.id)
                                : [...f.selectedEntryIds, e.id],
                            }))}
                          />
                          <label htmlFor={`ds-entry-${e.id}`} className="text-sm cursor-pointer">
                            {e.title}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {knowledgeEntries.length === 0 && (
                <p className="text-xs text-amber-400 bg-amber-400/10 rounded p-2">
                  Noch keine Wissenseinträge vorhanden. Das Datenblatt wird auf Basis allgemeinen 3D-Druck-Fachwissens erstellt.
                </p>
              )}
              <Button
                onClick={() => {
                  if (!dsForm.topic.trim()) { toast.error('Bitte ein Thema eingeben'); return; }
                  setGeneratedDatasheet('');
                  generateDsMut.mutate(dsForm);
                }}
                disabled={!dsForm.topic.trim() || generateDsMut.isPending}
                className="w-full gap-2"
              >
                {generateDsMut.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generiere Datenblatt...</>
                ) : (
                  <><FileText className="h-4 w-4" />Datenblatt generieren</>
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
                    w.document.write(`<html><head><title>Datenblatt – ${dsForm.topic}</title>
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
              <div className="border border-border rounded-lg p-4 min-h-64 max-h-[45vh] overflow-y-auto bg-muted/20 text-sm">
                {generateDsMut.isPending ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm">KI erstellt Datenblatt aus Ihrer Wissensdatenbank...</p>
                  </div>
                ) : generatedDatasheet ? (
                  <div className="whitespace-pre-wrap text-xs leading-relaxed">{generatedDatasheet}</div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-20" />
                    <p className="text-sm">Hier erscheint das generierte Datenblatt</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDatasheetGen(false)}>Schließen</Button>
            {generatedDatasheet && (
              <Button onClick={() => { setShowDatasheetGen(false); toast.success('Datenblatt wird beim Drucken des Angebots beigefügt'); }} className="gap-2">
                <CheckCircle className="h-4 w-4" /> Übernehmen
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Audit-Log-Dialog ───────────────────────────────────────────────────────── */}     <Dialog open={showAudit !== null} onOpenChange={() => setShowAudit(null)}>
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

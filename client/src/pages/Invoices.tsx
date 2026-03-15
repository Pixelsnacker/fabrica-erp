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
  CheckCircle, Clock, Send, Euro, Loader2, Printer, BookOpen, ArrowRight,
  PackageSearch, FolderOpen, Package, Copy, Sparkles, Check, X
} from "lucide-react";

// ─── PDF Download ───────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Typen ───────────────────────────────────────────────────────────────────
type TaxMode = 'standard' | 'reduced' | 'mixed' | 'tax_free' | 'kleinunternehmer';
type InvoiceType = 'offer' | 'invoice' | 'credit_note' | 'order_confirmation' | 'purchase_order';
type InvoiceStatus = 'draft' | 'sent' | 'accepted' | 'invoiced' | 'paid' | 'cancelled' | 'overdue';

interface InvoiceItem {
  position: number;
  description: string;
  longDescription?: string;
  isOptional?: boolean;
  discount?: string;
  discountedNet?: string;
  quantity: string;
  unit: string;
  unitPriceNet: string;
  taxRate: string;
  lineTotalNet: string;
  lineTax: string;
  lineTotalGross: string;
}

const UNIT_OPTIONS = [
  'Stk.', 'Std.', 'km', 'pauschal', '%', 'm²', 'm', 'kg', 't', 'lfm', 'm³', 'L', 'Tag(e)', 'Woche(n)', 'Monat(e)',
];

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
  order_confirmation: 'Auftragsbestätigung', purchase_order: 'Bestellung',
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
  const discountPct = parseFloat(item.discount || '0') || 0;
  const baseNet = qty * price;
  const discountAmount = baseNet * discountPct / 100;
  const net = baseNet - discountAmount;
  const tax = net * rate / 100;
  return {
    ...item,
    taxRate: String(rate),
    discountedNet: discountAmount.toFixed(2),
    lineTotalNet: net.toFixed(2),
    lineTax: tax.toFixed(2),
    lineTotalGross: (net + tax).toFixed(2),
  };
}

function calcTotals(items: InvoiceItem[]) {
  // Optionale Positionen werden NICHT in die Gesamtsumme aufgenommen
  const required = items.filter(i => !i.isOptional);
  const optional = items.filter(i => i.isOptional);
  const net = required.reduce((s, i) => s + parseFloat(i.lineTotalNet || '0'), 0);
  const tax = required.reduce((s, i) => s + parseFloat(i.lineTax || '0'), 0);
  const optionalNet = optional.reduce((s, i) => s + parseFloat(i.lineTotalNet || '0'), 0);
  const totalDiscount = items.reduce((s, i) => s + parseFloat(i.discountedNet || '0'), 0);
  return {
    subtotalNet: net.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalGross: (net + tax).toFixed(2),
    optionalNet: optionalNet.toFixed(2),
    hasOptional: optional.length > 0,
    optionalCount: optional.length,
    totalDiscount: totalDiscount.toFixed(2),
  };
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
  return { position: pos, description: '', longDescription: '', isOptional: false, discount: '0', discountedNet: '0.00', quantity: '1', unit: 'Stk.', unitPriceNet: '0.00', taxRate: '19', lineTotalNet: '0.00', lineTax: '0.00', lineTotalGross: '0.00' };
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

  const [tab, setTab] = useState<'all' | 'offer' | 'invoice' | 'credit_note' | 'order_confirmation' | 'purchase_order'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showAudit, setShowAudit] = useState<number | null>(null);

  // Undo-State für gelöschte Positionen
  const [deletedItem, setDeletedItem] = useState<{ item: InvoiceItem; idx: number } | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  // KI-Textverbesserung State
  const [aiImproving, setAiImproving] = useState<{ idx: number; field: 'description' | 'longDescription' } | null>(null);
  const [aiPreview, setAiPreview] = useState<{ idx: number; field: 'description' | 'longDescription'; original: string; improved: string } | null>(null);
  const improveTextMut = trpc.textImprove.improve.useMutation({
    onSuccess: (data) => {
      if (aiImproving) {
        setAiPreview({ idx: aiImproving.idx, field: aiImproving.field, original: items[aiImproving.idx]?.[aiImproving.field] ?? '', improved: data.improved });
      }
      setAiImproving(null);
    },
    onError: (e) => { toast.error('KI-Fehler: ' + e.message); setAiImproving(null); },
  });
  function triggerAiImprove(idx: number, field: 'description' | 'longDescription', mode: 'improve' | 'correct') {
    const text = items[idx]?.[field] ?? '';
    if (!text.trim()) { toast.error('Bitte zuerst Text eingeben'); return; }
    setAiImproving({ idx, field });
    improveTextMut.mutate({ text, mode, context: form.type === 'offer' ? 'Angebot' : form.type === 'invoice' ? 'Rechnung' : form.type === 'order_confirmation' ? 'Auftragsbestätigung' : form.type === 'purchase_order' ? 'Bestellung' : 'Geschäftsdokument' });
  }

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
  const { data: articleList = [] } = trpc.articles.list.useQuery({ search: articleSearchQuery || undefined, activeOnly: true });
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
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
  const convertMut = trpc.invoices.convert.useMutation({
    onSuccess: (data: { id?: number; invoiceNumber: string }, vars: { offerId: number; targetType: 'invoice' | 'order_confirmation' | 'purchase_order' }) => {
      utils.invoices.list.invalidate();
      const label = vars.targetType === 'invoice' ? 'Rechnung' : vars.targetType === 'order_confirmation' ? 'Auftragsbestätigung' : 'Bestellung';
      toast.success(`✅ ${label} ${data.invoiceNumber} wurde erstellt`);
      setShowConvertDialog(null);
    },
    onError: (e: { message: string }) => toast.error('Fehler: ' + e.message),
  });
  const [showConvertDialog, setShowConvertDialog] = useState<number | null>(null);
  // ─── Lieferantenangebot-Import ───────────────────────────────────────────────
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importProjectId, setImportProjectId] = useState<number | undefined>(undefined);
  const [importDocId, setImportDocId] = useState<number | undefined>(undefined);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  // E-Mail-Versand
  const [showEmailDialog, setShowEmailDialog] = useState<number | null>(null);
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', subject: '', body: '' });
  const sendOfferEmail = trpc.companySettings.sendOfferEmail.useMutation({
    onSuccess: () => { toast.success('E-Mail erfolgreich versendet!'); setShowEmailDialog(null); },
    onError: (e) => toast.error('Fehler: ' + e.message),
  });
  const { data: importDocs = [] } = trpc.projectDocs.list.useQuery(
    { projectId: importProjectId! },
    { enabled: importProjectId !== undefined }
  );
  const supplierDocs = importDocs.filter((d: any) => d.category === 'supplier_offer' && (d.mimeType === 'application/pdf' || d.filename?.toLowerCase().endsWith('.pdf')));
  const extractMut = trpc.projectDocs.extractItems.useMutation({
    onSuccess: (data) => {
      setImportPreview(data.items);
      toast.success(`${data.items.length} Positionen aus "${data.filename}" extrahiert`);
    },
    onError: (e) => toast.error('KI-Extraktion fehlgeschlagen: ' + e.message),
  });
  function applyImport() {
    if (!importPreview?.length) return;
    setItems(importPreview.map((it, idx) => ({
      position: idx + 1,
      description: it.description,
      quantity: String(it.quantity),
      unit: it.unit,
      unitPriceNet: String(it.unitPriceNet),
      taxRate: String(it.taxRate),
      lineTotalNet: it.lineTotalNet,
      lineTax: it.lineTax,
      lineTotalGross: it.lineTotalGross,
    })));
    // Projektbezug setzen
    if (importProjectId) setForm(f => ({ ...f, projectId: importProjectId }));
    setShowImportDialog(false);
    setImportPreview(null);
    setImportProjectId(undefined);
    setImportDocId(undefined);
    toast.success('Positionen übernommen — du kannst sie jetzt bearbeiten');
  }
  // ─────────────────────────────────────────────────────────────────────────────
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
    supplierId: undefined as number | undefined,
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
  function onSupplierSelect(id: string) {
    const sid = parseInt(id);
    const s = suppliers.find((x: any) => x.id === sid);
    if (s) {
      // Bei Bestellungen: recipientName leer lassen, damit im PDF nur der Firmenname erscheint
      setForm(f => ({
        ...f, supplierId: sid,
        recipientName: '',
        recipientCompany: (s as any).name ?? '',
        recipientStreet: (s as any).street ?? '',
        recipientZip: (s as any).zip ?? '',
        recipientCity: (s as any).city ?? '',
        recipientEmail: (s as any).email ?? '',
      }));
    }
  }

  function openNew(type: InvoiceType = 'offer', prefill?: { projectId?: number; customerId?: number; projectItems?: any[] }) {
    setEditId(null);
    const sender = buildSenderFromSettings();
    const footer = companySettings?.invoiceFooter ?? '';
    setForm({ type, customerId: prefill?.customerId, supplierId: undefined, projectId: prefill?.projectId, ...sender, recipientName: '', recipientCompany: '', recipientStreet: '', recipientZip: '', recipientCity: '', recipientEmail: '', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', deliveryDate: '', paymentTerms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.', taxMode: companySettings?.kleinunternehmer ? 'kleinunternehmer' : 'standard', introText: '', notes: '', footerText: footer });
    // Wenn Projekt-Positionen mitgegeben werden, vorausfüllen
    if (prefill?.projectItems?.length) {
      const mapped = prefill.projectItems.map((it: any, idx: number) => ({
        position: idx + 1,
        description: [it.name, it.material].filter(Boolean).join(' – '),
        quantity: it.quantity ? String(parseFloat(String(it.quantity))) : '1',
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

  const [pendingEditId, setPendingEditId] = useState<number | null>(null);
  const { data: editDetailData } = trpc.invoices.getById.useQuery(
    { id: pendingEditId! }, { enabled: pendingEditId !== null }
  );
  useEffect(() => {
    if (pendingEditId !== null && editDetailData) {
      const inv = editDetailData as any;
      setEditId(inv.id);
      setForm({
        type: inv.type, customerId: inv.customerId ?? undefined, supplierId: inv.supplierId ?? undefined, projectId: inv.projectId ?? undefined,
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
        longDescription: it.longDescription ?? '',
        isOptional: !!it.isOptional,
        discount: it.discount ?? '0',
        discountedNet: it.discountedNet ?? '0.00',
        quantity: it.quantity ? String(parseFloat(it.quantity)) : '1', unit: it.unit ?? 'Stk.',
        unitPriceNet: it.unitPriceNet ?? '0.00', taxRate: it.taxRate ?? '19',
        lineTotalNet: it.lineTotalNet ?? '0.00', lineTax: it.lineTax ?? '0.00',
        lineTotalGross: it.lineTotalGross ?? '0.00',
      })));
      setPendingEditId(null);
      setShowForm(true);
    }
  }, [editDetailData, pendingEditId]);

  function openEdit(inv: any) {
    setPendingEditId(inv.id);
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
  function updateItem(idx: number, field: keyof InvoiceItem, val: string | boolean) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [field]: val }, form.taxMode);
      return next;
    });
  }

  function addItem() {
    // Neue Position oben einfügen
    setItems(prev => [emptyItem(1), ...prev].map((it, i) => ({ ...it, position: i + 1 })));
  }
  function copyItem(idx: number) {
    setItems(prev => {
      const copy = { ...prev[idx] };
      const next = [copy, ...prev].map((it, i) => ({ ...it, position: i + 1 }));
      return next;
    });
  }

  function removeItem(idx: number) {
    // Bestätigung prüfen
    if (confirmDeleteIdx !== idx) {
      setConfirmDeleteIdx(idx);
      return;
    }
    setConfirmDeleteIdx(null);
    // Item merken für Undo
    const itemToDelete = items[idx];
    setDeletedItem({ item: itemToDelete, idx });
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, position: i + 1 })));
    // Undo-Timer starten (10 Sekunden)
    if (undoTimer) clearTimeout(undoTimer);
    const timer = setTimeout(() => { setDeletedItem(null); setUndoTimer(null); }, 10000);
    setUndoTimer(timer);
    toast(
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>Position gelöscht</span>
        <button
          onClick={() => {
            setItems(prev => {
              const restored = [...prev];
              restored.splice(idx, 0, itemToDelete);
              return restored.map((it, i) => ({ ...it, position: i + 1 }));
            });
            setDeletedItem(null);
            clearTimeout(timer);
            setUndoTimer(null);
            toast.dismiss();
          }}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontWeight: 600 }}
        >Rückgängig</button>
      </div>,
      { duration: 10000 }
    );
  }

  function moveItem(idx: number, dir: 'up' | 'down') {
    setItems(prev => {
      const arr = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return arr.map((it, i) => ({ ...it, position: i + 1 }));
    });
  }

  // Speichern
  async function handleSave() {
    // Alle numerischen Felder in Items als String sicherstellen (Zod-Validierung erwartet strings)
    const sanitizedItems = items.map(it => ({
      ...it,
      quantity: it.quantity ? String(parseFloat(String(it.quantity))) : '1',
      unitPriceNet: String(it.unitPriceNet ?? '0.00'),
      taxRate: String(it.taxRate ?? '19'),
      lineTotalNet: String(it.lineTotalNet ?? '0.00'),
      lineTax: String(it.lineTax ?? '0.00'),
      lineTotalGross: String(it.lineTotalGross ?? '0.00'),
      discount: String(it.discount ?? '0'),
      discountedNet: String(it.discountedNet ?? '0.00'),
    }));
    const payload = { ...form, ...totals, items: sanitizedItems };
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

  // buildFooterHtml ist jetzt direkt in printInvoice integriert

  // PDF-Druckansicht (Browser-Print)
  function formatDateDE(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return dateStr;
  }

  function printInvoice(inv: any) {
    const cs = companySettings as any;
    const agbText: string = (cs?.agbText ?? '').trim();
    const logoUrl: string = cs?.logoUrl ?? '';
    const isPurchaseOrder = inv.type === 'purchase_order';

    const taxModeNote = inv.taxMode === 'kleinunternehmer'
      ? '<p style="margin-top:16px;font-size:11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>' : '';

    const itemRows = (inv.items ?? []).map((it: any, i: number) => {
      const discountPct = parseFloat(it.discount ?? '0');
      const discountCell = discountPct > 0
        ? `<span style="color:#d97706;font-size:10px;"> (${discountPct}% Rabatt)</span>` : '';
      const optionalBadge = it.isOptional
        ? '<span style="background:#f3f4f6;color:#6b7280;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;">Optional</span>' : '';
      const longDesc = it.longDescription
        ? `<div style="font-size:10px;color:#555;margin-top:3px;white-space:pre-wrap;">${it.longDescription}</div>` : '';
      return `<tr style="${it.isOptional ? 'opacity:0.7;' : ''}">
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;">${i + 1}</td>
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;">
          <span style="font-weight:500;white-space:pre-wrap;">${it.description}</span>${optionalBadge}${discountCell}${longDesc}
        </td>
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${parseFloat(it.quantity ?? 1).toLocaleString('de-DE')}</td>
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;vertical-align:top;white-space:nowrap;">${it.unit ?? 'Stk.'}</td>
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${parseFloat(it.unitPriceNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;">${it.taxRate ?? 19} %</td>
        <td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;vertical-align:top;white-space:nowrap;font-weight:600;">${parseFloat(it.lineTotalGross ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
      </tr>`;
    }).join('');

    // Summen berechnen
    const pdfItems = inv.items ?? [];
    const reqItems = pdfItems.filter((i: any) => !i.isOptional);
    const optItems = pdfItems.filter((i: any) => i.isOptional);
    const pdfNet = reqItems.reduce((s: number, i: any) => s + parseFloat(i.lineTotalNet ?? 0), 0);
    const pdfTax = reqItems.reduce((s: number, i: any) => s + parseFloat(i.lineTax ?? 0), 0);
    const pdfGross = pdfNet + pdfTax;
    const pdfOptGross = optItems.reduce((s: number, i: any) => s + parseFloat(i.lineTotalGross ?? 0), 0);
    const pdfDiscount = pdfItems.reduce((s: number, i: any) => s + parseFloat(i.discountedNet ?? 0), 0);
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';

    // Fußzeile aus companySettings (4 Spalten) - als normaler Fließtext, KEIN position:fixed
    // Bei Bestellungen: footerCol4 (Bankdaten/IBAN) nicht anzeigen
    const footerCols = isPurchaseOrder
      ? [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', '']
      : [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', cs?.footerCol4 ?? ''];
    const hasFooterCols = footerCols.some(c => c.trim());
    const renderCol = (text: string) => text.split('\n')
      .map((l: string) => `<span>${l.replace(/https?:\/\//, '')}</span>`)
      .join('<br/>');

    const recipientLabel = isPurchaseOrder ? 'LIEFERANT' : 'EMPFÄNGER';
    const docTitle = TYPE_LABELS[inv.type as InvoiceType] ?? inv.type;

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${inv.invoiceNumber}</title>
<style>
  @page {
    size: A4;
    margin: 1.5cm 1.5cm 2.5cm 1.5cm;
    @bottom-center {
      content: '';
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
  }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    color: #111;
    line-height: 1.5;
    background: #fff;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .main-content {
    flex: 1;
  }
  table { width: 100%; border-collapse: collapse; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .doc-header-left { flex: 1; }
  .doc-header-right { text-align: right; }
  .doc-title { font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px; }
  .doc-meta { font-size: 11px; color: #333; line-height: 1.8; }
  .sender-name { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
  .sender-info { font-size: 10px; color: #444; line-height: 1.6; }
  .recipient-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .recipient-block { margin-bottom: 20px; }
  .divider { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  .items-table th {
    background: #f0f0f0;
    text-align: left;
    padding: 6px;
    border-bottom: 2px solid #ccc;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .items-table td { padding: 5px 6px; border-bottom: 1px solid #e8e8e8; font-size: 11px; vertical-align: top; }
  .totals-section { display: flex; justify-content: flex-end; margin: 16px 0; }
  .totals-table { width: 280px; }
  .totals-table td { padding: 3px 6px; font-size: 11px; }
  .totals-table .total-row td { font-weight: 700; font-size: 13px; border-top: 2px solid #111; padding-top: 6px; }
  .payment-info { font-size: 10px; color: #333; margin-top: 8px; line-height: 1.8; }
  .notes { font-size: 10px; color: #555; margin-top: 12px; }
  .footer-area {
    margin-top: 32px;
    padding-top: 8px;
    border-top: 1.5px solid #bbb;
    font-size: 9px;
    color: #555;
  }
  .footer-area table td { padding: 0 8px 0 0; vertical-align: top; font-size: 9px; color: #555; }
  .page-num { text-align: right; font-size: 9px; color: #999; margin-top: 4px; }
  .agb-page { page-break-before: always; padding-top: 8px; }
  .agb-page h2 { font-size: 15px; margin-bottom: 14px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  @media print {
    a { text-decoration: none; color: inherit; }
    button { display: none; }
  }
</style>
</head>
<body>

<div class="main-content">
<!-- KOPF -->
<div class="doc-header">
  <div class="doc-header-left">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height:65px;max-width:200px;object-fit:contain;margin-bottom:10px;display:block;">` : ''}
    <div class="sender-name">${inv.senderName || ''}</div>
    <div class="sender-info">
      ${inv.senderStreet ? inv.senderStreet + '<br>' : ''}
      ${(inv.senderZip || inv.senderCity) ? (inv.senderZip ?? '') + ' ' + (inv.senderCity ?? '') + '<br>' : ''}
      ${inv.senderEmail ? inv.senderEmail + '<br>' : ''}
      ${inv.senderPhone ? 'Tel. ' + inv.senderPhone + '<br>' : ''}
      ${inv.senderVatId ? 'USt-IdNr: ' + inv.senderVatId : ''}
    </div>
  </div>
  <div class="doc-header-right">
    <div class="doc-title">${docTitle}</div>
    <div class="doc-meta">
      <strong>Nr. ${inv.invoiceNumber}</strong><br>
      Datum: ${formatDateDE(inv.issueDate)}<br>
      ${inv.dueDate ? 'Fälligkeit: ' + formatDateDE(inv.dueDate) + '<br>' : ''}
      ${inv.deliveryDate ? 'Lieferdatum: ' + formatDateDE(inv.deliveryDate) : ''}
    </div>
  </div>
</div>

<!-- EMPFÄNGER / LIEFERANT -->
<div class="recipient-block">
  <div class="recipient-label">${recipientLabel}</div>
  <div style="font-size:11px;line-height:1.7;">
    ${isPurchaseOrder
      ? `${inv.recipientCompany ? `<strong>${inv.recipientCompany}</strong><br>` : ''}${inv.recipientStreet ? inv.recipientStreet + '<br>' : ''}${(inv.recipientZip || inv.recipientCity) ? (inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '') + '<br>' : ''}${inv.recipientCountry && inv.recipientCountry !== 'Deutschland' ? inv.recipientCountry : ''}`
      : `${inv.recipientCompany ? `<strong>${inv.recipientCompany}</strong><br>` : ''}${inv.recipientName && inv.recipientName !== inv.recipientCompany ? inv.recipientName + '<br>' : ''}${inv.recipientStreet ? inv.recipientStreet + '<br>' : ''}${(inv.recipientZip || inv.recipientCity) ? (inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '') : ''}`
    }
  </div>
</div>

<hr class="divider">

${inv.introText ? `<p style="margin-bottom:16px;font-size:11px;">${inv.introText}</p>` : ''}

<!-- POSITIONEN -->
<table class="items-table" style="margin-bottom:16px;">
  <thead><tr>
    <th style="width:4%;">#</th>
    <th>Beschreibung</th>
    <th style="text-align:right;width:8%;">Menge</th>
    <th style="width:7%;">Einheit</th>
    <th style="text-align:right;width:11%;">EP netto</th>
    <th style="text-align:right;width:8%;">MwSt</th>
    <th style="text-align:right;width:12%;">Gesamt brutto</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- SUMMEN -->
<div class="totals-section">
  <table class="totals-table">
    ${pdfDiscount > 0 ? `<tr style="color:#c47a00;"><td>Rabatt gesamt:</td><td style="text-align:right">-${fmt(pdfDiscount)}</td></tr>` : ''}
    <tr><td style="color:#555;">Nettobetrag:</td><td style="text-align:right">${fmt(pdfNet)}</td></tr>
    <tr><td style="color:#555;">MwSt:</td><td style="text-align:right">${fmt(pdfTax)}</td></tr>
    <tr class="total-row"><td>Gesamtbetrag:</td><td style="text-align:right">${fmt(pdfGross)}</td></tr>
    ${optItems.length > 0 ? `<tr><td colspan="2" style="font-size:9px;color:#888;padding-top:6px;border-top:1px dashed #ccc;">zzgl. optionale Pos. (${optItems.length}): ${fmt(pdfOptGross)}</td></tr>` : ''}
  </table>
</div>

${taxModeNote}

<!-- ZAHLUNGSINFOS -->
<div class="payment-info">
  ${inv.type !== 'purchase_order' && inv.paymentTerms ? inv.paymentTerms + '<br>' : ''}
  ${inv.type !== 'purchase_order' && inv.senderIban ? 'IBAN: ' + inv.senderIban + (inv.senderBic ? ' | BIC: ' + inv.senderBic : '') : ''}
</div>
${inv.notes ? `<div class="notes">${inv.notes}</div>` : ''}
${inv.footerText ? `<p style="margin-top:16px;font-size:9px;color:#888;">${inv.footerText}</p>` : ''}
</div><!-- end main-content -->

<!-- Fußzeile immer unten -->
${hasFooterCols ? `<div class="footer-area">
  <table><tr>
    ${footerCols.map(c => `<td style="width:25%;">${renderCol(c)}</td>`).join('')}
  </tr></table>
</div>` : ''}

${agbText ? `<div class="agb-page">
  <h2>Allgemeine Geschäftsbedingungen</h2>
  <div style="white-space:pre-wrap;line-height:1.6;font-size:11px;">${agbText}</div>
</div>` : ''}

<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  async function downloadPDF(invOrId: any) {
    const toastId = toast.loading('PDF wird erstellt...');
    try {
      // Sicherstellen dass wir vollständige Daten inkl. items haben
      // Die list-Query gibt keine items zurück, daher immer getById aufrufen
      let inv = invOrId;
      if (!inv.items || inv.items.length === 0) {
        const fullData = await utils.invoices.getById.fetch({ id: inv.id });
        if (fullData) inv = fullData;
      }

      // HTML-Inhalt in einem versteckten iframe rendern
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;';
      document.body.appendChild(iframe);

      // printInvoice HTML generieren (ohne window.print)
      const cs = companySettings as any;
      const agbText: string = (cs?.agbText ?? '').trim();
      const logoUrl: string = cs?.logoUrl ?? '';
      const isPurchaseOrder = inv.type === 'purchase_order';
      const taxModeNote = inv.taxMode === 'kleinunternehmer'
        ? '<p style="margin-top:16px;font-size:11px;">Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</p>' : '';
      const itemRows = (inv.items ?? []).map((it: any, i: number) => {
        const discountPct = parseFloat(it.discount ?? '0');
        const discountCell = discountPct > 0 ? `<span style="color:#d97706;font-size:10px;"> (${discountPct}% Rabatt)</span>` : '';
        const optionalBadge = it.isOptional ? '<span style="background:#f3f4f6;color:#6b7280;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:6px;">Optional</span>' : '';
        const longDesc = it.longDescription ? `<div style="font-size:10px;color:#555;margin-top:3px;white-space:pre-wrap;">${it.longDescription}</div>` : '';
        return `<tr><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;">${i + 1}</td><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;"><span style="font-weight:500;">${it.description}</span>${optionalBadge}${discountCell}${longDesc}</td><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;">${parseFloat(it.quantity ?? 1).toLocaleString('de-DE')}</td><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;">${it.unit ?? 'Stk.'}</td><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;">${parseFloat(it.unitPriceNet ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;">${it.taxRate ?? 19} %</td><td style="padding:5px 6px;border-bottom:1px solid #e8e8e8;text-align:right;font-weight:600;">${parseFloat(it.lineTotalGross ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td></tr>`;
      }).join('');
      const pdfItems = inv.items ?? [];
      const reqItems = pdfItems.filter((i: any) => !i.isOptional);
      const pdfNet = reqItems.reduce((s: number, i: any) => s + parseFloat(i.lineTotalNet ?? 0), 0);
      const pdfTax = reqItems.reduce((s: number, i: any) => s + parseFloat(i.lineTax ?? 0), 0);
      const pdfGross = pdfNet + pdfTax;
      const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
       // Bei Bestellungen: footerCol4 (Bankdaten) nicht anzeigen
      const footerCols = isPurchaseOrder
        ? [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', '']
        : [cs?.footerCol1 ?? '', cs?.footerCol2 ?? '', cs?.footerCol3 ?? '', cs?.footerCol4 ?? ''];
      const hasFooterCols = footerCols.some(c => c.trim());
      const renderCol = (text: string) => text.split('\n').map((l: string) => `<span>${l.replace(/https?:\/\//, '')}</span>`).join('<br/>');
      const recipientLabel = isPurchaseOrder ? 'LIEFERANT' : 'EMPFÄNGER';
      const docTitle = TYPE_LABELS[inv.type as InvoiceType] ?? inv.type;

      const htmlContent = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.5; background: #fff; padding: 40px; }
        table { width: 100%; border-collapse: collapse; }
        .doc-header { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .doc-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .items-table th { background: #f0f0f0; text-align: left; padding: 6px; border-bottom: 2px solid #ccc; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .totals-table { width: 280px; margin-left: auto; }
        .totals-table td { padding: 3px 6px; }
        .total-row td { font-weight: 700; font-size: 13px; border-top: 2px solid #111; padding-top: 6px; }
        .footer-area { margin-top: 24px; padding-top: 8px; border-top: 1.5px solid #bbb; font-size: 9px; color: #555; }
        .footer-area table td { padding: 0 8px 0 0; vertical-align: top; font-size: 9px; }
      </style></head><body>
      <div class="doc-header">
          <div>${logoUrl ? `<img src="${logoUrl}" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:8px;display:block;">` : ''}<div style="font-size:13px;font-weight:700;">${inv.senderName || ''}</div><div style="font-size:10px;color:#444;line-height:1.6;">${inv.senderStreet ?? ''}<br>${(inv.senderZip ?? '') + ' ' + (inv.senderCity ?? '')}<br>${inv.senderEmail ?? ''}<br>${inv.senderPhone ? 'Tel. ' + inv.senderPhone : ''}</div></div>
          <div style="text-align:right;"><div class="doc-title">${docTitle}</div><div style="font-size:11px;color:#333;line-height:1.8;"><strong>Nr. ${inv.invoiceNumber}</strong><br>Datum: ${formatDateDE(inv.issueDate)}<br>${inv.dueDate ? 'Fälligkeit: ' + formatDateDE(inv.dueDate) + '<br>' : ''}${inv.deliveryDate ? 'Lieferdatum: ' + formatDateDE(inv.deliveryDate) : ''}</div></div>
        </div>
        <div style="margin-bottom:16px;"><div style="font-size:9px;color:#888;text-transform:uppercase;margin-bottom:4px;">${recipientLabel}</div><div style="font-size:11px;line-height:1.7;">${isPurchaseOrder ? `${inv.recipientCompany ? `<strong>${inv.recipientCompany}</strong><br>` : ''}${inv.recipientStreet ? inv.recipientStreet + '<br>' : ''}${(inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '')}` : `${inv.recipientCompany ? `<strong>${inv.recipientCompany}</strong><br>` : ''}${inv.recipientName && inv.recipientName !== inv.recipientCompany ? inv.recipientName + '<br>' : ''}${inv.recipientStreet ? inv.recipientStreet + '<br>' : ''}${(inv.recipientZip ?? '') + ' ' + (inv.recipientCity ?? '')}`}</div></div>
        <hr style="border:none;border-top:1px solid #ddd;margin:12px 0;">
        ${inv.introText ? `<p style="margin-bottom:12px;">${inv.introText}</p>` : ''}
        <table class="items-table" style="margin-bottom:12px;"><thead><tr><th style="width:4%;">#</th><th>Beschreibung</th><th style="text-align:right;width:8%;">Menge</th><th style="width:7%;">Einheit</th><th style="text-align:right;width:11%;">EP netto</th><th style="text-align:right;width:8%;">MwSt</th><th style="text-align:right;width:12%;">Gesamt brutto</th></tr></thead><tbody>${itemRows}</tbody></table>
        <table class="totals-table" style="margin-bottom:12px;"><tr><td style="color:#555;">Nettobetrag:</td><td style="text-align:right">${fmt(pdfNet)}</td></tr><tr><td style="color:#555;">MwSt:</td><td style="text-align:right">${fmt(pdfTax)}</td></tr><tr class="total-row"><td>Gesamtbetrag:</td><td style="text-align:right">${fmt(pdfGross)}</td></tr></table>
        ${taxModeNote}
        <div style="font-size:10px;color:#333;margin-top:8px;">${inv.type !== 'purchase_order' && inv.paymentTerms ? inv.paymentTerms : ''}${inv.type !== 'purchase_order' && inv.senderIban ? '<br>IBAN: ' + inv.senderIban : ''}</div>
        ${inv.notes ? `<div style="font-size:10px;color:#555;margin-top:8px;">${inv.notes}</div>` : ''}
      ${hasFooterCols ? `<div class="footer-area"><table><tr>${footerCols.map(c => `<td style="width:25%;">${renderCol(c)}</td>`).join('')}</tr></table></div>` : ''}
      ${agbText ? `<div style="page-break-before:always;padding-top:8px;"><h2 style="font-size:15px;margin-bottom:14px;border-bottom:2px solid #333;padding-bottom:8px;">Allgemeine Geschäftsbedingungen</h2><div style="white-space:pre-wrap;line-height:1.6;font-size:11px;">${agbText}</div></div>` : ''}
      </body></html>`;

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('iframe nicht verfügbar');
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
      });

      document.body.removeChild(iframe);

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;

      let yPos = 0;
      let remaining = imgH;
      let page = 0;
      while (remaining > 0) {
        if (page > 0) pdf.addPage();
        const sliceH = Math.min(remaining, pageH);
        pdf.addImage(imgData, 'JPEG', 0, -yPos, pageW, imgH);
        yPos += pageH;
        remaining -= sliceH;
        page++;
      }

      pdf.save(`${inv.invoiceNumber}.pdf`);
      toast.dismiss(toastId);
      toast.success('PDF heruntergeladen');
    } catch (err) {
      document.querySelectorAll('iframe[style*="-9999px"]').forEach(el => el.remove());
      toast.dismiss(toastId);
      toast.error('PDF-Erstellung fehlgeschlagen');
      console.error(err);
    }
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
            <Button variant="outline" size="sm" onClick={() => openNew('order_confirmation')}>
              <Package className="w-4 h-4 mr-1" /> AB
            </Button>
            <Button variant="outline" size="sm" onClick={() => openNew('purchase_order')}>
              <PackageSearch className="w-4 h-4 mr-1" /> Bestellung
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
              <TabsTrigger value="order_confirmation">AB</TabsTrigger>
              <TabsTrigger value="purchase_order">Bestellungen</TabsTrigger>
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
                {inv.type === 'purchase_order' && inv.supplierId ? (
                  <span className="text-orange-400/80">[Lieferant] {[inv.recipientCompany, inv.recipientName].filter(Boolean).join(' — ')}</span>
                ) : (
                  [inv.recipientCompany, inv.recipientName].filter(Boolean).join(' — ')
                )}
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
                <Button size="sm" variant="outline" onClick={() => downloadPDF(inv)} title="PDF herunterladen">
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>

                {['offer','order_confirmation','purchase_order'].includes(inv.type) && (
                  <Button size="sm" variant="outline" className="text-blue-400 border-blue-400/30" onClick={() => {
                    const typeLabel = TYPE_LABELS[inv.type as InvoiceType] ?? inv.type;
                    setEmailForm({
                      to: inv.recipientEmail ?? '',
                      cc: '',
                      subject: `${typeLabel} ${inv.invoiceNumber} von Fabrica GmbH`,
                      body: `vielen Dank für Ihr Interesse.\n\nAnbei erhalten Sie unsere ${typeLabel} ${inv.invoiceNumber}.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.`,
                    });
                    setShowEmailDialog(inv.id);
                  }}>
                    <Send className="w-3 h-3 mr-1" /> E-Mail
                  </Button>
                )}
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
                    onClick={() => setShowConvertDialog(inv.id)}
                  >
                    <ArrowRight className="w-3 h-3 mr-1" />
                    Konvertieren
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
                    <SelectItem value="order_confirmation">Auftragsbestätigung</SelectItem>
                    <SelectItem value="purchase_order">Bestellung</SelectItem>
                    <SelectItem value="credit_note">Gutschrift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === 'purchase_order' ? (
                <div className="min-w-0">
                  <Label>Lieferant</Label>
                  <Select value={form.supplierId ? String(form.supplierId) : 'none'} onValueChange={v => v !== 'none' ? onSupplierSelect(v) : setForm(f => ({ ...f, supplierId: undefined }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Lieferant wählen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Lieferant</SelectItem>
                      {(suppliers as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
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
              )}
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
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{form.type === 'purchase_order' ? 'Lieferant (Empfänger)' : 'Empfänger (Kunde)'}</h3>
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-amber-400 border-amber-400/40 hover:bg-amber-400/10" onClick={() => { setImportPreview(null); setImportProjectId(undefined); setImportDocId(undefined); setShowImportDialog(true); }}>
                    <PackageSearch className="w-3 h-3 mr-1" /> Aus Lieferantenangebot
                  </Button>
                  <Button size="sm" variant="outline" className="text-primary border-primary/40 hover:bg-primary/10" onClick={() => { setArticleSearchQuery(''); setShowArticleSearch(true); }}>
                    <Package className="w-3 h-3 mr-1" /> Aus Artikeldatenbank
                  </Button>
                  <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Position</Button>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className={`border rounded-lg p-3 space-y-2 ${it.isOptional ? 'border-dashed border-muted-foreground/40 bg-muted/20' : 'border-border'}`}>
                    {/* Zeile 1: #, Beschreibung, Menge, Einheit, EP, Rabatt, Gesamt, Löschen */}
                    <div className="flex items-start gap-2 flex-wrap">
                      {/* Pfeil-Buttons + Positionsnummer */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-primary" disabled={idx === 0} onClick={() => moveItem(idx, 'up')} title="Nach oben">
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <span className="text-muted-foreground text-xs leading-none">{it.position}</span>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-primary" disabled={idx === items.length - 1} onClick={() => moveItem(idx, 'down')} title="Nach unten">
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex-1 min-w-[160px] flex items-start gap-1">
                        <Textarea
                          className="text-sm flex-1 min-h-[36px] resize-none overflow-hidden py-1.5 px-3"
                          value={it.description}
                          onChange={e => {
                            updateItem(idx, 'description', e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          rows={1}
                          placeholder="Leistungsbeschreibung *"
                        />
                        {/* KI-Button für Beschreibung */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10" title="KI: Professionell umformulieren" disabled={aiImproving?.idx === idx && aiImproving?.field === 'description'} onClick={() => triggerAiImprove(idx, 'description', 'improve')}>
                            {aiImproving?.idx === idx && aiImproving?.field === 'description' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                      <Input
                        className="h-8 text-sm text-right w-16"
                        value={it.quantity}
                        onChange={e => {
                          // Nur Ziffern, Komma und Punkt erlauben; Komma zu Punkt normalisieren
                          const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                          updateItem(idx, 'quantity', raw);
                        }}
                        placeholder="Menge"
                      />
                      {/* Einheit-Dropdown mit Freitext */}
                      <Select value={UNIT_OPTIONS.includes(it.unit) ? it.unit : '__custom'} onValueChange={v => { if (v !== '__custom') updateItem(idx, 'unit', v); }}>
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue>{UNIT_OPTIONS.includes(it.unit) ? it.unit : it.unit}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          <SelectItem value="__custom">Eigene...</SelectItem>
                        </SelectContent>
                      </Select>
                      {!UNIT_OPTIONS.includes(it.unit) && (
                        <Input className="h-8 text-sm w-20" value={it.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Einheit" />
                      )}
                      <Input className="h-8 text-sm text-right w-24" value={it.unitPriceNet} onChange={e => updateItem(idx, 'unitPriceNet', e.target.value)} placeholder="EP netto" />
                      {/* Rabatt % */}
                      <div className="flex items-center gap-1">
                        <Input className="h-8 text-sm text-right w-16" value={it.discount ?? '0'} onChange={e => updateItem(idx, 'discount', e.target.value)} placeholder="0" />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      {form.taxMode === 'mixed' && (
                        <div className="flex items-center gap-1">
                          <Input className="h-8 text-sm text-right w-14" value={it.taxRate} onChange={e => updateItem(idx, 'taxRate', e.target.value)} />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}
                      <span className="font-semibold text-green-400 text-sm w-24 text-right shrink-0">
                        {parseFloat(it.lineTotalGross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary shrink-0" title="Position kopieren" onClick={() => copyItem(idx)}><Copy className="w-3 h-3" /></Button>
                      {confirmDeleteIdx === idx ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-red-400 whitespace-nowrap">Löschen?</span>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 text-xs font-bold" onClick={() => removeItem(idx)}>Ja</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground text-xs" onClick={() => setConfirmDeleteIdx(null)}>Nein</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 shrink-0" onClick={() => removeItem(idx)}><Trash2 className="w-3 h-3" /></Button>
                      )}
                    </div>
                    {/* Zeile 2: Langbeschreibung + Optional-Toggle */}
                    <div className="flex items-start gap-3 pl-7">
                      <div className="flex-1 flex items-start gap-1">
                        <Textarea
                          className="text-xs flex-1 text-muted-foreground min-h-[28px] resize-none overflow-hidden py-1 px-3"
                          value={it.longDescription ?? ''}
                          rows={1}
                          onChange={e => {
                            updateItem(idx, 'longDescription', e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          placeholder="Detailbeschreibung (optional, erscheint im PDF)"
                        />
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 shrink-0" title="KI: Professionell umformulieren" disabled={aiImproving?.idx === idx && aiImproving?.field === 'longDescription'} onClick={() => triggerAiImprove(idx, 'longDescription', 'improve')}>
                          {aiImproving?.idx === idx && aiImproving?.field === 'longDescription' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        </Button>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer shrink-0 mt-0.5">
                        <Checkbox
                          checked={!!it.isOptional}
                          onCheckedChange={checked => updateItem(idx, 'isOptional', !!checked)}
                          className="h-4 w-4"
                        />
                        <span className="text-xs text-muted-foreground">Optional</span>
                      </label>
                      {parseFloat(it.discount ?? '0') > 0 && (
                        <span className="text-xs text-amber-400 shrink-0">
                          -{parseFloat(it.discountedNet ?? '0').toLocaleString('de-DE', { minimumFractionDigits: 2 })} € Rabatt
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* KI-Vorschau Dialog */}
              {aiPreview && (
                <div className="border border-purple-500/40 rounded-lg p-4 bg-purple-500/5 space-y-3">
                  <div className="flex items-center gap-2 text-purple-400 font-medium text-sm">
                    <Sparkles className="w-4 h-4" />
                    KI-Vorschlag für Position {aiPreview.idx + 1} ({aiPreview.field === 'description' ? 'Beschreibung' : 'Detailbeschreibung'})
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground mb-1 font-medium">Original:</div>
                      <div className="bg-muted/30 rounded p-2 whitespace-pre-wrap">{aiPreview.original}</div>
                    </div>
                    <div>
                      <div className="text-purple-400 mb-1 font-medium">KI-Vorschlag:</div>
                      <div className="bg-purple-500/10 rounded p-2 whitespace-pre-wrap">{aiPreview.improved}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => {
                      updateItem(aiPreview.idx, aiPreview.field, aiPreview.improved);
                      setAiPreview(null);
                      toast.success('KI-Vorschlag übernommen');
                    }}>
                      <Check className="w-3 h-3 mr-1" /> Übernehmen
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAiPreview(null)}>
                      <X className="w-3 h-3 mr-1" /> Verwerfen
                    </Button>
                  </div>
                </div>
              )}
              {/* Summen */}
              <div className="flex justify-end">
                <div className="text-sm space-y-1 min-w-[260px]">
                  {parseFloat(totals.totalDiscount) > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Rabatt gesamt:</span>
                      <span>-{formatEur(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground"><span>Netto (Pflichtpositionen):</span><span>{formatEur(totals.subtotalNet)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>MwSt:</span><span>{formatEur(totals.taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t border-border pt-1"><span>Gesamt:</span><span className="text-green-400">{formatEur(totals.totalGross)}</span></div>
                  {totals.hasOptional && (
                    <div className="flex justify-between text-muted-foreground text-xs pt-1 border-t border-dashed border-border/50">
                      <span>zzgl. optionale Pos. ({totals.optionalCount}):</span>
                      <span>{formatEur(totals.optionalNet)}</span>
                    </div>
                  )}
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
              {form.type !== 'purchase_order' && (
                <div><Label>Zahlungsbedingungen</Label><Input value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
              )}
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
      {/* ─── Artikeldatenbank-Such-Dialog ──────────────────────────────────────────── */}
      <Dialog open={showArticleSearch} onOpenChange={o => { if (!o) setShowArticleSearch(false); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Artikel aus Datenbank einfügen
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Suche nach Name, Artikelnummer..."
              value={articleSearchQuery}
              onChange={e => setArticleSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-1 mt-2">
            {articleList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {articleSearchQuery ? 'Keine Artikel gefunden.' : 'Noch keine Artikel in der Datenbank.'}
              </div>
            ) : (
              articleList.map((a: any) => {
                const net = parseFloat(a.unitPriceNet ?? 0);
                const gross = net * (1 + (a.taxRate ?? 19) / 100);
                return (
                  <button
                    key={a.id}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border group"
                    onClick={() => {
                      setItems(prev => [...prev, {
                        position: prev.length + 1,
                        description: a.name,
                        longDescription: a.longDescription ?? '',
                        quantity: '1',
                        unit: a.unit ?? 'Stk.',
                        unitPriceNet: String(net.toFixed(2)),
                        taxRate: String(a.taxRate ?? 19),
                        discount: '0',
                        isOptional: false,
                        lineTotalNet: String(net.toFixed(2)),
                        lineTax: String((net * (a.taxRate ?? 19) / 100).toFixed(2)),
                        lineTotalGross: String(gross.toFixed(2)),
                        discountedNet: '0',
                      }]);
                      setShowArticleSearch(false);
                      toast.success(`"${a.name}" eingefügt`);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{a.name}</div>
                        {a.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</div>}
                        {a.articleNumber && <div className="text-xs text-muted-foreground/60 font-mono mt-0.5">{a.articleNumber}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-primary">{net.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
                        <div className="text-xs text-muted-foreground">{a.unit} · {a.taxRate} % MwSt</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" onClick={() => setShowArticleSearch(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Lieferantenangebot-Import-Dialog ──────────────────────────────────────── */}
      <Dialog open={showImportDialog} onOpenChange={o => { if (!o) { setShowImportDialog(false); setImportPreview(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageSearch className="w-5 h-5 text-amber-400" />
              Positionen aus Lieferantenangebot importieren
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Schritt 1: Projekt wählen */}
            <div className="space-y-2">
              <Label>1. Projekt auswählen</Label>
              <Select value={importProjectId ? String(importProjectId) : ''} onValueChange={v => { setImportProjectId(Number(v)); setImportDocId(undefined); setImportPreview(null); }}>
                <SelectTrigger><SelectValue placeholder="Projekt wählen..." /></SelectTrigger>
                <SelectContent>
                  {(projects as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Schritt 2: Lieferantenangebot-PDF wählen */}
            {importProjectId && (
              <div className="space-y-2">
                <Label>2. Lieferantenangebot (PDF) auswählen</Label>
                {supplierDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-lg">
                    Keine Lieferantenangebote (PDF) im Projekt gefunden. Lade zuerst ein PDF im Projekt-Detail unter Dokumente hoch (Typ: Lieferantenangebot).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {supplierDocs.map((doc: any) => (
                      <div key={doc.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        importDocId === doc.id ? 'border-amber-400 bg-amber-400/10' : 'border-border hover:border-amber-400/50'
                      }`} onClick={() => { setImportDocId(doc.id); setImportPreview(null); }}>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-amber-400" />
                          <div>
                            <p className="text-sm font-medium">{doc.filename}</p>
                            <p className="text-xs text-muted-foreground">{doc.notes || 'Kein Kommentar'} · {new Date(doc.createdAt).toLocaleDateString('de-DE')}</p>
                          </div>
                        </div>
                        {importDocId === doc.id && <CheckCircle className="w-4 h-4 text-amber-400" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Schritt 3: KI-Extraktion starten */}
            {importDocId && !importPreview && (
              <Button className="w-full" variant="outline" disabled={extractMut.isPending}
                onClick={() => extractMut.mutate({ docId: importDocId! })}>
                {extractMut.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> KI liest Positionen aus PDF...</> : <><PackageSearch className="w-4 h-4 mr-2" /> Positionen extrahieren</>}
              </Button>
            )}
            {/* Schritt 4: Vorschau und Bestätigung */}
            {importPreview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-green-400">✓ {importPreview.length} Positionen erkannt</Label>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setImportPreview(null); }}>
                    Neu extrahieren
                  </Button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 text-muted-foreground">#</th>
                        <th className="text-left p-2 text-muted-foreground">Beschreibung</th>
                        <th className="text-right p-2 text-muted-foreground">Menge</th>
                        <th className="text-left p-2 text-muted-foreground">Einheit</th>
                        <th className="text-right p-2 text-muted-foreground">EP netto</th>
                        <th className="text-right p-2 text-muted-foreground">Gesamt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((it, idx) => (
                        <tr key={idx} className="border-t border-border/50">
                          <td className="p-2 text-muted-foreground">{it.position}</td>
                          <td className="p-2 max-w-xs truncate" title={it.description}>{it.description}</td>
                          <td className="p-2 text-right">{it.quantity}</td>
                          <td className="p-2">{it.unit}</td>
                          <td className="p-2 text-right">{parseFloat(it.unitPriceNet).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="p-2 text-right font-semibold text-green-400">{parseFloat(it.lineTotalGross).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">Du kannst alle Positionen nach der Übernahme noch bearbeiten (Preis, Menge, Beschreibung).</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => { setShowImportDialog(false); setImportPreview(null); }}>Abbrechen</Button>
            <Button disabled={!importPreview?.length} onClick={applyImport} className="bg-amber-500 hover:bg-amber-600 text-black">
              <ArrowRight className="w-4 h-4 mr-2" /> {importPreview?.length ?? 0} Positionen übernehmen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Detail-Dialog ───────────────────────────────────────────────────────── */}
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
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => downloadPDF(detailData)}><Download className="w-3 h-3 mr-1" /> PDF</Button>

                {detailData.type === 'offer' && (
                    <Button size="sm" variant="outline" className="text-green-400 border-green-400/30 hover:bg-green-400/10" onClick={() => setShowConvertDialog(detailData.id)}>
                      <ArrowRight className="w-3 h-3 mr-1" /> Konvertieren
                    </Button>
                  )}
                  {['offer','order_confirmation','purchase_order'].includes(detailData.type) && (
                    <Button size="sm" variant="outline" className="text-blue-400 border-blue-400/30" onClick={() => {
                      const typeLabel = TYPE_LABELS[detailData.type as InvoiceType] ?? detailData.type;
                      setEmailForm({
                        to: detailData.recipientEmail ?? '',
                        cc: '',
                        subject: `${typeLabel} ${detailData.invoiceNumber} von Fabrica GmbH`,
                        body: `vielen Dank für Ihr Interesse.\n\nAnbei erhalten Sie unsere ${typeLabel} ${detailData.invoiceNumber}.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.`,
                      });
                      setShowEmailDialog(detailData.id);
                    }}>
                      <Send className="w-3 h-3 mr-1" /> Per E-Mail senden
                    </Button>
                  )}
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

      {/* ─── E-Mail-Versand-Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showEmailDialog !== null} onOpenChange={() => setShowEmailDialog(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-400" />
              Angebot per E-Mail senden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Empfänger (An)*</Label>
              <Input
                value={emailForm.to}
                onChange={e => setEmailForm(f => ({ ...f, to: e.target.value }))}
                placeholder="kunde@beispiel.de"
                type="email"
              />
            </div>
            <div>
              <Label>CC (optional)</Label>
              <Input
                value={emailForm.cc}
                onChange={e => setEmailForm(f => ({ ...f, cc: e.target.value }))}
                placeholder="kopie@beispiel.de"
                type="email"
              />
            </div>
            <div>
              <Label>Betreff*</Label>
              <Input
                value={emailForm.subject}
                onChange={e => setEmailForm(f => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nachricht*</Label>
              <Textarea
                value={emailForm.body}
                onChange={e => setEmailForm(f => ({ ...f, body: e.target.value }))}
                rows={7}
                placeholder="Ihre Nachricht an den Kunden..."
              />
              <p className="text-xs text-muted-foreground mt-1">Die E-Mail-Signatur aus den Einstellungen wird automatisch angehängt.</p>
            </div>
            <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3 text-sm text-blue-300">
              <p className="font-medium mb-1">ℹ️ Hinweis zum PDF-Anhang</p>
              <p className="text-xs text-muted-foreground">Das Angebot wird als strukturierte HTML-E-Mail versendet. Für den PDF-Anhang: Drucken Sie das Angebot zuerst als PDF und hängen Sie es manuell an, oder konfigurieren Sie einen PDF-Export-Service.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(null)}>Abbrechen</Button>
            <Button
              onClick={() => {
                if (!emailForm.to || !emailForm.subject || !emailForm.body) {
                  toast.error('Bitte Empfänger, Betreff und Nachricht ausfüllen.');
                  return;
                }
                sendOfferEmail.mutate({
                  invoiceId: showEmailDialog!,
                  to: emailForm.to,
                  cc: emailForm.cc || undefined,
                  subject: emailForm.subject,
                  body: emailForm.body,
                });
              }}
              disabled={sendOfferEmail.isPending}
              className="gap-2"
            >
              {sendOfferEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              E-Mail senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Konvertierungs-Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showConvertDialog !== null} onOpenChange={() => setShowConvertDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-green-400" />
              Angebot konvertieren
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">Wähle den Zieldokumenttyp. Alle Positionen und Kundendaten werden übernommen.</p>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start gap-3 h-14 text-left"
                disabled={convertMut.isPending}
                onClick={() => convertMut.mutate({ offerId: showConvertDialog!, targetType: 'order_confirmation' })}
              >
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="font-medium">Auftragsbestätigung</div>
                  <div className="text-xs text-muted-foreground">Angebot wird als angenommen markiert (AB-Nummer)</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-3 h-14 text-left"
                disabled={convertMut.isPending}
                onClick={() => convertMut.mutate({ offerId: showConvertDialog!, targetType: 'invoice' })}
              >
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <div className="font-medium">Rechnung</div>
                  <div className="text-xs text-muted-foreground">Direkt zur Rechnung umwandeln (RE-Nummer)</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-3 h-14 text-left"
                disabled={convertMut.isPending}
                onClick={() => convertMut.mutate({ offerId: showConvertDialog!, targetType: 'purchase_order' })}
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Package className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="font-medium">Bestellung</div>
                  <div className="text-xs text-muted-foreground">Als Bestellung an Lieferanten (BE-Nummer)</div>
                </div>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConvertDialog(null)}>Abbrechen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

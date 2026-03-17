import DashboardLayout from "@/components/DashboardLayout";
import { EntitySearch } from "@/components/EntitySearch";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Search, Trash2, FileText, Send, CheckCircle, XCircle,
  Clock, ChevronUp, ChevronDown, Download, Loader2, PackageSearch
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ─── Typen ───────────────────────────────────────────────────────────────────
type InquiryStatus = "draft" | "sent" | "answered" | "completed" | "cancelled";

interface InquiryItem {
  description: string;
  longDescription?: string;
  quantity: string;
  unit: string;
  remark?: string;
  articleId?: number;
}

const STATUS_LABELS: Record<InquiryStatus, string> = {
  draft: "Entwurf",
  sent: "Versendet",
  answered: "Beantwortet",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  draft: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  sent: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  answered: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

const UNIT_OPTIONS = [
  "Stk.", "Std.", "km", "pauschal", "%", "m²", "m", "kg", "t", "lfm", "m³", "L", "Tag(e)", "Woche(n)", "Monat(e)",
];

const emptyItem = (): InquiryItem => ({
  description: "",
  longDescription: "",
  quantity: "1",
  unit: "Stk.",
  remark: "",
});

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export default function Inquiries() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Formular-State
  const [supplierId, setSupplierId] = useState<number | undefined>();
  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [introText, setIntroText] = useState("Sehr geehrte Damen und Herren,\n\nhiermit bitten wir Sie um ein Angebot für folgende Positionen:");
  const [outroText, setOutroText] = useState("Bitte teilen Sie uns Ihre Konditionen, Lieferzeit und Zahlungsbedingungen mit.\n\nMit freundlichen Grüßen\nFabrica GmbH");
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Tage netto");
  const [deliveryTerms, setDeliveryTerms] = useState("frei Haus");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InquiryItem[]>([emptyItem()]);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Queries
  const { data: inquiries = [], refetch } = trpc.inquiries.list.useQuery(undefined, { staleTime: 0 });
  const { data: nextNumber } = trpc.inquiries.nextNumber.useQuery(undefined, { staleTime: 0 });
  const { data: suppliersRaw = [] } = trpc.suppliers.list.useQuery(undefined, { staleTime: 60000 });
  const supplierOptions = (suppliersRaw as any[]).map((s: any) => ({
    id: s.id,
    label: s.companyName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
    sublabel: s.contactPerson ?? undefined,
  }));

  const utils = trpc.useUtils();

  // Mutations
  const createMut = trpc.inquiries.create.useMutation({
    onSuccess: () => {
      utils.inquiries.list.invalidate();
      utils.inquiries.nextNumber.invalidate();
      toast.success("Anfrage erstellt");
      closeForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.inquiries.update.useMutation({
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: [["inquiries", "getById"], { input: { id }, type: "query" }] });
      utils.inquiries.list.invalidate();
      toast.success("Anfrage gespeichert");
      closeForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const statusMut = trpc.inquiries.updateStatus.useMutation({
    onSuccess: () => { utils.inquiries.list.invalidate(); toast.success("Status aktualisiert"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.inquiries.delete.useMutation({
    onSuccess: () => { utils.inquiries.list.invalidate(); toast.success("Anfrage gelöscht"); setDeleteConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  const pdfMut = trpc.inquiries.generatePdf.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank");
      setPdfLoading(false);
    },
    onError: (e) => { toast.error(e.message); setPdfLoading(false); },
  });

  // Formular-Hilfsfunktionen
  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditId(null);
    setSupplierId(undefined);
    setSupplierName("");
    setSupplierContact("");
    setSupplierEmail("");
    setSubject("");
    setIntroText("Sehr geehrte Damen und Herren,\n\nhiermit bitten wir Sie um ein Angebot für folgende Positionen:");
    setOutroText("Bitte teilen Sie uns Ihre Konditionen, Lieferzeit und Zahlungsbedingungen mit.\n\nMit freundlichen Grüßen\nFabrica GmbH");
    setDesiredDeliveryDate("");
    setPaymentTerms("30 Tage netto");
    setDeliveryTerms("frei Haus");
    setNotes("");
    setItems([emptyItem()]);
  }, []);

  const openNew = () => {
    closeForm();
    setShowForm(true);
  };

  const openEdit = async (inq: any) => {
    queryClient.removeQueries({ queryKey: [["inquiries", "getById"], { input: { id: inq.id }, type: "query" }] });
    setEditId(inq.id);
    setSupplierId(inq.supplierId ?? undefined);
    setSupplierName(inq.supplierName ?? "");
    setSupplierContact(inq.supplierContact ?? "");
    setSupplierEmail(inq.supplierEmail ?? "");
    setSubject(inq.subject ?? "");
    setIntroText(inq.introText ?? "");
    setOutroText(inq.outroText ?? "");
    setDesiredDeliveryDate(inq.desiredDeliveryDate ?? "");
    setPaymentTerms(inq.paymentTerms ?? "30 Tage netto");
    setDeliveryTerms(inq.deliveryTerms ?? "frei Haus");
    setNotes(inq.notes ?? "");
    // Items werden nach dem Öffnen geladen
    setItems(inq.items?.length > 0 ? inq.items.map((it: any) => ({
      description: it.description,
      longDescription: it.longDescription ?? "",
      quantity: it.quantity ?? "1",
      unit: it.unit ?? "Stk.",
      remark: it.remark ?? "",
    })) : [emptyItem()]);
    setShowForm(true);
  };

  const handleSave = () => {
    const payload = {
      supplierId,
      supplierName: supplierName || undefined,
      supplierContact: supplierContact || undefined,
      supplierEmail: supplierEmail || undefined,
      subject: subject || undefined,
      introText: introText || undefined,
      outroText: outroText || undefined,
      desiredDeliveryDate: desiredDeliveryDate || undefined,
      paymentTerms: paymentTerms || undefined,
      deliveryTerms: deliveryTerms || undefined,
      notes: notes || undefined,
      items: items.filter(it => it.description.trim()),
    };
    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  // Positionen-Hilfsfunktionen
  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const moveItem = (i: number, dir: -1 | 1) => {
    setItems(prev => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };
  const updateItem = (i: number, field: keyof InquiryItem, val: string) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  };

  // Lieferant aus Stammdaten auswählen
  const handleSupplierSelect = (id: number | undefined) => {
    if (!id) { setSupplierId(undefined); setSupplierName(""); setSupplierContact(""); setSupplierEmail(""); return; }
    setSupplierId(id);
    const sup = (suppliersRaw as any[]).find((s: any) => s.id === id);
    if (sup) {
      setSupplierName(sup.companyName || `${sup.firstName ?? ''} ${sup.lastName ?? ''}`.trim());
      setSupplierContact(sup.contactPerson ?? "");
      setSupplierEmail(sup.email ?? "");
    }
  };

  // Gefilterte Liste
  const filtered = (inquiries as any[]).filter((inq: any) => {
    const matchStatus = filterStatus === "all" || inq.status === filterStatus;
    const matchSearch = !search || (
      inq.inquiryNumber?.toLowerCase().includes(search.toLowerCase()) ||
      inq.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
      inq.subject?.toLowerCase().includes(search.toLowerCase())
    );
    return matchStatus && matchSearch;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Lieferantenanfragen</h1>
            <p className="text-sm text-gray-400">Anfragen an Lieferanten verwalten</p>
          </div>
          <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus className="w-4 h-4" /> Neue Anfrage
          </Button>
        </div>

        {/* Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Suche nach Nummer, Lieferant, Betreff..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabelle */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <PackageSearch className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">Keine Anfragen gefunden</p>
              <Button variant="outline" size="sm" className="mt-4 border-gray-700 text-gray-300" onClick={openNew}>
                Erste Anfrage erstellen
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Nummer</th>
                  <th className="text-left px-4 py-3">Lieferant</th>
                  <th className="text-left px-4 py-3">Betreff</th>
                  <th className="text-left px-4 py-3">Datum</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inq: any) => (
                  <tr key={inq.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-indigo-400 font-medium">{inq.inquiryNumber}</td>
                    <td className="px-4 py-3 text-white">{inq.supplierName ?? <span className="text-gray-500 italic">Kein Lieferant</span>}</td>
                    <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">{inq.subject ?? ""}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(inq.createdAt).toLocaleDateString("de-DE")}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[inq.status as InquiryStatus]}`}>
                        {STATUS_LABELS[inq.status as InquiryStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-7 px-2" onClick={() => openEdit(inq)}>
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 h-7 px-2"
                          onClick={() => { setPdfLoading(true); pdfMut.mutate({ id: inq.id }); }}
                          disabled={pdfLoading}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {inq.status === "draft" && (
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 h-7 px-2"
                            onClick={() => statusMut.mutate({ id: inq.id, status: "sent" })}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {inq.status === "sent" && (
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-yellow-400 h-7 px-2"
                            onClick={() => statusMut.mutate({ id: inq.id, status: "answered" })}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {inq.status === "answered" && (
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-green-400 h-7 px-2"
                            onClick={() => statusMut.mutate({ id: inq.id, status: "completed" })}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 h-7 px-2"
                          onClick={() => setDeleteConfirm(inq.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Formular-Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm(); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">
              {editId ? "Anfrage bearbeiten" : `Neue Anfrage ${nextNumber ?? ""}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Lieferant */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">Lieferant</Label>
                <EntitySearch
                  options={supplierOptions}
                  value={supplierId}
                  onChange={handleSupplierSelect}
                  placeholder="Lieferant suchen..."
                  emptyLabel="Kein Lieferant"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">Betreff</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Betreff der Anfrage" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">Ansprechpartner</Label>
                <Input value={supplierContact} onChange={e => setSupplierContact(e.target.value)} placeholder="Name des Ansprechpartners" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">E-Mail</Label>
                <Input value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="E-Mail-Adresse" className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>

            {/* Vorbemerkung */}
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">Vorbemerkung</Label>
              <Textarea value={introText} onChange={e => setIntroText(e.target.value)} rows={3} className="bg-gray-800 border-gray-700 text-white resize-none" />
            </div>

            {/* Positionen */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 text-sm">Positionen</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="border-gray-600 text-gray-300 hover:bg-gray-700 gap-1 h-7">
                  <Plus className="w-3 h-3" /> Position
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs w-5 text-center">{i + 1}</span>
                      <Input
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        placeholder="Bezeichnung"
                        className="flex-1 bg-gray-700 border-gray-600 text-white h-8 text-sm"
                      />
                      <Input
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", e.target.value)}
                        placeholder="Menge"
                        className="w-20 bg-gray-700 border-gray-600 text-white h-8 text-sm text-right"
                      />
                      <Select value={item.unit} onValueChange={v => updateItem(i, "unit", v)}>
                        <SelectTrigger className="w-24 bg-gray-700 border-gray-600 text-white h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-6 p-0 text-gray-500 hover:text-white" onClick={() => moveItem(i, -1)} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-6 p-0 text-gray-500 hover:text-white" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-6 p-0 text-gray-500 hover:text-red-400" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="flex gap-2 pl-7">
                      <Textarea
                        value={item.longDescription ?? ""}
                        onChange={e => updateItem(i, "longDescription", e.target.value)}
                        placeholder="Zusätzliche Beschreibung (optional)"
                        rows={2}
                        className="flex-1 bg-gray-700 border-gray-600 text-white text-xs resize-none"
                      />
                      <Textarea
                        value={item.remark ?? ""}
                        onChange={e => updateItem(i, "remark", e.target.value)}
                        placeholder="Bemerkung (optional)"
                        rows={2}
                        className="w-48 bg-gray-700 border-gray-600 text-white text-xs resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nachbemerkung */}
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">Nachbemerkung</Label>
              <Textarea value={outroText} onChange={e => setOutroText(e.target.value)} rows={3} className="bg-gray-800 border-gray-700 text-white resize-none" />
            </div>

            {/* Konditionen */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">Wunschliefertermin</Label>
                <Input value={desiredDeliveryDate} onChange={e => setDesiredDeliveryDate(e.target.value)} placeholder="z.B. 30.04.2026" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">Zahlungsbedingungen</Label>
                <Input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="z.B. 30 Tage netto" className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-gray-300 text-sm">Lieferbedingungen</Label>
                <Input value={deliveryTerms} onChange={e => setDeliveryTerms(e.target.value)} placeholder="z.B. frei Haus" className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>

            {/* Interne Notizen */}
            <div className="space-y-1">
              <Label className="text-gray-300 text-sm">Interne Notizen</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Nur intern sichtbar" className="bg-gray-800 border-gray-700 text-white resize-none" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeForm} className="border-gray-700 text-gray-300">Abbrechen</Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <Dialog open={deleteConfirm !== null} onOpenChange={open => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Anfrage löschen?</DialogTitle>
          </DialogHeader>
          <p className="text-gray-400 text-sm">Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-gray-700 text-gray-300">Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMut.mutate({ id: deleteConfirm })}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

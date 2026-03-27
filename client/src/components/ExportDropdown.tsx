/**
 * ExportDropdown.tsx — Export-Button mit Dropdown für Chat-Modul
 * Verwendung: ERP-Chat (mode="erp") und Kundenportal (mode="portal")
 * Bestandsschutz: Neue Komponente, keine bestehenden Dateien verändert
 */
import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, Loader2, FileText, Table2, Archive, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Hilfsfunktion: Base64 → Browser-Download ─────────────────────────────────
function triggerDownload(base64: string, filename: string, mimeType: string) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ExportDropdownProps {
  projectId: number;
  mode: "erp" | "portal";
  /** Nur für Portal-Modus: Passwort zur Authentifizierung */
  password?: string;
}

// ─── Komponente ───────────────────────────────────────────────────────────────
export default function ExportDropdown({ projectId, mode, password }: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Außerhalb klicken → schließen
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── tRPC Mutations ──────────────────────────────────────────────────────────
  const chatPdf = trpc.chatExport.chatPdf.useMutation();
  const chatPdfPortal = trpc.chatExport.chatPdfPortal.useMutation();
  const chatCsv = trpc.chatExport.chatCsv.useMutation();
  const chatCsvPortal = trpc.chatExport.chatCsvPortal.useMutation();
  const todosPdf = trpc.chatExport.todosPdf.useMutation();
  const todosPdfPortal = trpc.chatExport.todosPdfPortal.useMutation();
  const todosCsv = trpc.chatExport.todosCsv.useMutation();
  const todosCsvPortal = trpc.chatExport.todosCsvPortal.useMutation();
  const attachmentsZip = trpc.chatExport.attachmentsZip.useMutation();
  const attachmentsZipPortal = trpc.chatExport.attachmentsZipPortal.useMutation();

  // ── Download-Handler ────────────────────────────────────────────────────────
  const handle = async (key: string, label: string) => {
    setLoading(key);
    setOpen(false);
    try {
      if (mode === "erp") {
        if (key === "chatPdf") {
          const r = await chatPdf.mutateAsync({ projectId });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "chatCsv") {
          const r = await chatCsv.mutateAsync({ projectId });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "todosPdf") {
          const r = await todosPdf.mutateAsync({ projectId });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "todosCsv") {
          const r = await todosCsv.mutateAsync({ projectId });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "zip") {
          const r = await attachmentsZip.mutateAsync({ projectId });
          if (r.empty) {
            setToast({ msg: "Für dieses Projekt sind keine Anhänge vorhanden.", type: "err" });
          } else {
            triggerDownload(r.base64, r.filename, r.mimeType);
          }
        }
      } else {
        // Portal-Modus
        const pw = password ?? "";
        if (key === "chatPdf") {
          const r = await chatPdfPortal.mutateAsync({ projectId, password: pw });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "chatCsv") {
          const r = await chatCsvPortal.mutateAsync({ projectId, password: pw });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "todosPdf") {
          const r = await todosPdfPortal.mutateAsync({ projectId, password: pw });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "todosCsv") {
          const r = await todosCsvPortal.mutateAsync({ projectId, password: pw });
          triggerDownload(r.base64, r.filename, r.mimeType);
        } else if (key === "zip") {
          const r = await attachmentsZipPortal.mutateAsync({ projectId, password: pw });
          if (r.empty) {
            setToast({ msg: "Für dieses Projekt sind keine Anhänge vorhanden.", type: "err" });
          } else {
            triggerDownload(r.base64, r.filename, r.mimeType);
          }
        }
      }
      if (key !== "zip") setToast({ msg: `${label} wird heruntergeladen…`, type: "ok" });
    } catch (e: any) {
      setToast({ msg: `Fehler beim Export: ${e?.message ?? "Unbekannter Fehler"}`, type: "err" });
    } finally {
      setLoading(null);
    }
  };

  // ── Menüeinträge ────────────────────────────────────────────────────────────
  const items = [
    { key: "chatPdf",  icon: <FileText className="h-3.5 w-3.5" />,  label: "Chatverlauf als PDF" },
    { key: "chatCsv",  icon: <Table2 className="h-3.5 w-3.5" />,    label: "Chatverlauf als CSV" },
    { key: "todosPdf", icon: <FileText className="h-3.5 w-3.5" />,  label: "Todo-Liste als PDF" },
    { key: "todosCsv", icon: <Table2 className="h-3.5 w-3.5" />,    label: "Todo-Liste als CSV" },
    { key: "zip",      icon: <Archive className="h-3.5 w-3.5" />,   label: "Alle Anhänge (ZIP)" },
  ];

  const isPortal = mode === "portal";

  return (
    <div className="relative" ref={ref}>
      {/* Export-Button */}
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!loading}
        className={[
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
          isPortal
            ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            : "bg-white/10 hover:bg-white/20 text-white border border-white/20",
          loading ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Export
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown-Menü */}
      {open && (
        <div
          className={[
            "absolute right-0 top-full mt-1.5 w-52 rounded-xl shadow-lg border z-50 py-1 overflow-hidden",
            isPortal
              ? "bg-white border-slate-200"
              : "bg-gray-900 border-gray-700",
          ].join(" ")}
        >
          {items.map((item, idx) => (
            <button
              key={item.key}
              onClick={() => handle(item.key, item.label)}
              className={[
                "w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition-colors",
                isPortal
                  ? "text-slate-700 hover:bg-slate-50"
                  : "text-gray-200 hover:bg-gray-800",
                idx === 4 ? (isPortal ? "border-t border-slate-100 mt-0.5 pt-2" : "border-t border-gray-700 mt-0.5 pt-2") : "",
              ].join(" ")}
            >
              <span className={isPortal ? "text-slate-400" : "text-gray-400"}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Toast-Meldung */}
      {toast && (
        <div
          className={[
            "absolute right-0 top-full mt-10 w-72 rounded-xl px-3.5 py-2.5 text-xs shadow-lg z-50 flex items-start gap-2",
            toast.type === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white",
          ].join(" ")}
        >
          {toast.type === "ok" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

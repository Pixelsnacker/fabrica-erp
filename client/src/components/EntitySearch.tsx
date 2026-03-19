import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EntityOption {
  id: number | string;
  label: string;       // Hauptname (Firma oder Personenname)
  sublabel?: string;   // Zweite Zeile (z.B. Ansprechpartner, Kundennummer)
}

interface EntitySearchProps {
  options: EntityOption[];
  value?: number | string;
  onChange: (id: number | string | undefined) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function EntitySearch({
  options,
  value,
  onChange,
  placeholder = "Suchen...",
  emptyLabel = "Keine Auswahl",
  disabled = false,
  className,
}: EntitySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.id) === String(value));

  // Gefilterte Vorschläge
  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 50)
    : options.slice(0, 50);

  // Klick außerhalb schließt Dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSelect(option: EntityOption) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger / Anzeige */}
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={cn(
            "flex items-center justify-between w-full px-3 py-2 rounded-md border border-input bg-background text-sm",
            "hover:bg-accent/50 transition-colors text-left",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : emptyLabel}
          </span>
          <span className="flex items-center gap-1 ml-2 shrink-0">
            {selected && (
              <X
                className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </button>
      ) : (
        /* Suchfeld */
        <div className="flex items-center w-full px-3 py-2 rounded-md border border-primary bg-background text-sm ring-1 ring-primary">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Escape") { setOpen(false); setQuery(""); }
              if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0]);
            }}
          />
          <X
            className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
            onClick={() => { setOpen(false); setQuery(""); }}
          />
        </div>
      )}

      {/* Dropdown-Liste */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {/* "Keine Auswahl" Option */}
          <button
            type="button"
            onClick={() => { onChange(undefined); setOpen(false); setQuery(""); }}
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {emptyLabel}
          </button>

          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                  String(value) === String(option.id) && "bg-accent/60 font-medium"
                )}
              >
                <div className="truncate">{option.label}</div>
                {option.sublabel && (
                  <div className="text-xs text-muted-foreground truncate">{option.sublabel}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

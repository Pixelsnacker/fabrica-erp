/**
 * TodoPanel.tsx — Projekt-Todo-Panel
 * Verwendung: ERP (ProjectDetail) und Kundenportal (ProjectPortal)
 * Props: mode "erp" | "portal"
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Circle, ArrowRightLeft, ChevronDown, ChevronUp,
  Plus, Loader2, User
} from "lucide-react";
import { toast } from "sonner";

// ─── Typen ────────────────────────────────────────────────────────────────────
interface Todo {
  id: number;
  projectId: number;
  text: string;
  createdBy: string;
  createdByType: "erp" | "customer";
  assignedTo: string | null;
  assignedToType: "erp" | "customer" | null;
  status: "open" | "done";
  createdAt: number;
  doneAt: number | null;
  doneBy: string | null;
  handoverComment: string | null;
}

// ─── ERP-Version ──────────────────────────────────────────────────────────────
interface ErpTodoPanelProps {
  mode: "erp";
  projectId: number;
  currentUser: string;
  customerName?: string;
  customerEmail?: string;
  portalUrl?: string;
}

// ─── Portal-Version ───────────────────────────────────────────────────────────
interface PortalTodoPanelProps {
  mode: "portal";
  projectId: number;
  password: string;
  senderName: string;
}

type TodoPanelProps = ErpTodoPanelProps | PortalTodoPanelProps;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ─── ERP Todo Panel ───────────────────────────────────────────────────────────
function ErpTodoPanel({ projectId, currentUser, customerName, customerEmail, portalUrl }: ErpTodoPanelProps) {
  const utils = trpc.useUtils();
  const [newText, setNewText] = useState("");
  const [assignTo, setAssignTo] = useState<"erp" | "customer">("erp");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [handoverId, setHandoverId] = useState<number | null>(null);
  const [handoverTarget, setHandoverTarget] = useState<"erp" | "customer">("erp");
  const [handoverComment, setHandoverComment] = useState("");

  const { data: todos = [], isLoading } = trpc.projectTodos.list.useQuery({ projectId }, { refetchInterval: 15000 });

  const createTodo = trpc.projectTodos.create.useMutation({
    onSuccess: () => {
      utils.projectTodos.list.invalidate({ projectId });
      setNewText("");
      toast.success("Aufgabe erstellt");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const markDone = trpc.projectTodos.markDone.useMutation({
    onSuccess: () => {
      utils.projectTodos.list.invalidate({ projectId });
      toast.success("Aufgabe erledigt");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const reopen = trpc.projectTodos.reopen.useMutation({
    onSuccess: () => {
      utils.projectTodos.list.invalidate({ projectId });
      toast.success("Aufgabe wieder geöffnet");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handover = trpc.projectTodos.handover.useMutation({
    onSuccess: () => {
      utils.projectTodos.list.invalidate({ projectId });
      setHandoverId(null);
      setHandoverComment("");
      toast.success("Aufgabe übergeben");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const handleCreate = () => {
    if (!newText.trim()) return;
    createTodo.mutate({
      projectId,
      text: newText.trim(),
      assignedTo: assignTo === "customer" ? (customerName ?? "Kunde") : currentUser,
      assignedToType: assignTo,
      customerEmail: assignTo === "customer" ? customerEmail : undefined,
    });
  };

  const handleHandover = (todo: Todo) => {
    const targetName = handoverTarget === "customer" ? (customerName ?? "Kunde") : currentUser;
    handover.mutate({
      todoId: todo.id,
      assignedTo: targetName,
      assignedToType: handoverTarget,
      handoverComment: handoverComment.trim() || undefined,
      customerEmail: handoverTarget === "customer" ? customerEmail : undefined,
      portalUrl: handoverTarget === "customer" ? portalUrl : undefined,
    });
  };

  const open = todos.filter(t => t.status === "open");
  const done = todos.filter(t => t.status === "done");

  return (
    <div className="flex flex-col h-full">
      {/* Neues Todo */}
      <div className="p-3 border-b border-border bg-card space-y-2 shrink-0">
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            placeholder="Neue Aufgabe… (Enter)"
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" className="h-8 px-2 shrink-0" onClick={handleCreate} disabled={createTodo.isPending}>
            {createTodo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Zuweisen an:</span>
          <button
            onClick={() => setAssignTo("erp")}
            className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${assignTo === "erp" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
          >
            {currentUser}
          </button>
          {customerName && (
            <button
              onClick={() => setAssignTo("customer")}
              className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${assignTo === "customer" ? "bg-blue-600 text-white border-blue-600" : "border-border hover:border-blue-500"}`}
            >
              {customerName}
            </button>
          )}
        </div>
      </div>

      {/* Todo-Liste */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />Lade…
          </div>
        ) : open.length === 0 && done.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Noch keine Aufgaben
          </div>
        ) : (
          <>
            {open.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                expanded={expandedId === todo.id}
                onToggle={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                onDone={() => markDone.mutate({ todoId: todo.id })}
                onReopen={() => reopen.mutate({ todoId: todo.id })}
                onHandover={() => { setHandoverId(todo.id); setExpandedId(todo.id); }}
                showHandover={handoverId === todo.id}
                handoverTarget={handoverTarget}
                setHandoverTarget={setHandoverTarget}
                handoverComment={handoverComment}
                setHandoverComment={setHandoverComment}
                onHandoverSubmit={() => handleHandover(todo)}
                onHandoverCancel={() => setHandoverId(null)}
                customerName={customerName}
                currentUser={currentUser}
                mode="erp"
              />
            ))}
            {done.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground px-1 pt-2 pb-1 border-t border-border mt-2">
                  Erledigt ({done.length})
                </div>
                  {done.map(todo => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    expanded={expandedId === todo.id}
                    onToggle={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    onDone={() => {}}
                    onReopen={() => reopen.mutate({ todoId: todo.id })}
                    onHandover={() => {}}
                    showHandover={false}
                    handoverTarget="erp"
                    setHandoverTarget={() => {}}
                    handoverComment=""
                    setHandoverComment={() => {}}
                    onHandoverSubmit={() => {}}
                    onHandoverCancel={() => {}}
                    customerName={customerName}
                    currentUser={currentUser}
                    mode="erp"
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Portal Todo Panel ────────────────────────────────────────────────────────
function PortalTodoPanel({ projectId, password, senderName }: PortalTodoPanelProps) {
  const utils = trpc.useUtils();
  const [newText, setNewText] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: todos = [], isLoading } = trpc.projectTodos.portalList.useQuery(
    { projectId, password },
    { refetchInterval: 15000 }
  );

  const createTodo = trpc.projectTodos.portalCreate.useMutation({
    onSuccess: () => {
      utils.projectTodos.portalList.invalidate({ projectId, password });
      setNewText("");
      toast.success("Aufgabe erstellt");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const markDone = trpc.projectTodos.portalMarkDone.useMutation({
    onSuccess: () => utils.projectTodos.portalList.invalidate({ projectId, password }),
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const open = todos.filter(t => t.status === "open");
  const done = todos.filter(t => t.status === "done");

  return (
    <div className="flex flex-col h-full">
      {/* Neues Todo */}
      <div className="p-3 border-b border-slate-200 bg-white space-y-2 shrink-0">
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newText.trim()) createTodo.mutate({ projectId, password, text: newText.trim(), senderName }); }}
            placeholder="Neue Aufgabe… (Enter)"
            className="h-8 text-sm flex-1 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400"
          />
          <Button
            size="sm"
            className="h-8 px-2 shrink-0 bg-slate-800 hover:bg-slate-700 text-white"
            onClick={() => { if (newText.trim()) createTodo.mutate({ projectId, password, text: newText.trim(), senderName }); }}
            disabled={createTodo.isPending}
          >
            {createTodo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Todo-Liste */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />Lade…
          </div>
        ) : open.length === 0 && done.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Noch keine Aufgaben</div>
        ) : (
          <>
            {open.map(todo => (
              <PortalTodoItem
                key={todo.id}
                todo={todo}
                expanded={expandedId === todo.id}
                onToggle={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                onDone={() => markDone.mutate({ projectId, password, todoId: todo.id, senderName })}
                senderName={senderName}
              />
            ))}
            {done.length > 0 && (
              <>
                <div className="text-xs text-slate-400 px-1 pt-2 pb-1 border-t border-slate-200 mt-2">
                  Erledigt ({done.length})
                </div>
                {done.map(todo => (
                  <PortalTodoItem
                    key={todo.id}
                    todo={todo}
                    expanded={expandedId === todo.id}
                    onToggle={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    onDone={() => {}}
                    senderName={senderName}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ERP Todo Item ────────────────────────────────────────────────────────────
interface TodoItemProps {
  todo: Todo;
  expanded: boolean;
  onToggle: () => void;
  onDone: () => void;
  onReopen: () => void;
  onHandover: () => void;
  showHandover: boolean;
  handoverTarget: "erp" | "customer";
  setHandoverTarget: (v: "erp" | "customer") => void;
  handoverComment: string;
  setHandoverComment: (v: string) => void;
  onHandoverSubmit: () => void;
  onHandoverCancel: () => void;
  customerName?: string;
  currentUser: string;
  mode: "erp";
}

function TodoItem({
  todo, expanded, onToggle, onDone, onReopen, onHandover,
  showHandover, handoverTarget, setHandoverTarget,
  handoverComment, setHandoverComment, onHandoverSubmit, onHandoverCancel,
  customerName, currentUser
}: TodoItemProps) {
  const isDone = todo.status === "done";

  return (
    <div className={`rounded-md border text-sm transition-colors ${isDone ? "border-border/50 bg-muted/30 opacity-60" : "border-border bg-card hover:border-primary/30"}`}>
      <div className="flex items-start gap-2 px-2.5 py-2">
        {isDone
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          : (
            <button
              className="h-4 w-4 shrink-0 mt-0.5 rounded-full border-2 border-muted-foreground hover:border-emerald-500 hover:bg-emerald-50 transition-colors focus:outline-none"
              title="Als erledigt markieren"
              onClick={(e) => { e.stopPropagation(); onDone(); }}
            />
          )
        }
        <div className="flex-1 flex items-start gap-1 cursor-pointer" onClick={onToggle}>
          <span className={`flex-1 leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {todo.text}
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-border/50 pt-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              Von: <strong>{todo.createdBy}</strong>
            </span>
            {todo.assignedTo && (
              <span className="flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                Für: <strong>{todo.assignedTo}</strong>
                {todo.assignedToType === "customer" && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-400 text-blue-400">Kunde</Badge>
                )}
              </span>
            )}
            <span>{formatDate(todo.createdAt)}</span>
          </div>
          {todo.handoverComment && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">
              {todo.handoverComment}
            </p>
          )}
          {isDone && todo.doneBy && (
            <p className="text-xs text-emerald-600">✓ Erledigt von {todo.doneBy} am {formatDate(todo.doneAt!)}</p>
          )}

          {isDone && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-slate-500 border-slate-300 hover:bg-slate-50" onClick={onReopen}>
                <Circle className="h-3 w-3" /> Wieder öffnen
              </Button>
            </div>
          )}

          {!isDone && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-600 border-emerald-500/50 hover:bg-emerald-500/10" onClick={onDone}>
                <CheckCircle2 className="h-3 w-3" /> Erledigt
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onHandover}>
                <ArrowRightLeft className="h-3 w-3" /> Übergeben
              </Button>
            </div>
          )}

          {showHandover && !isDone && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground font-medium">Übergeben an:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setHandoverTarget("erp")}
                  className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${handoverTarget === "erp" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"}`}
                >
                  {currentUser}
                </button>
                {customerName && (
                  <button
                    onClick={() => setHandoverTarget("customer")}
                    className={`px-2 py-0.5 rounded-full border text-xs transition-colors ${handoverTarget === "customer" ? "bg-blue-600 text-white border-blue-600" : "border-border hover:border-blue-500"}`}
                  >
                    {customerName}
                  </button>
                )}
              </div>
              <Input
                value={handoverComment}
                onChange={e => setHandoverComment(e.target.value)}
                placeholder="Übergabekommentar (optional)"
                className="h-7 text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={onHandoverSubmit}>Bestätigen</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onHandoverCancel}>Abbrechen</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Portal Todo Item ─────────────────────────────────────────────────────────
interface PortalTodoItemProps {
  todo: Todo;
  expanded: boolean;
  onToggle: () => void;
  onDone: () => void;
  senderName: string;
}

function PortalTodoItem({ todo, expanded, onToggle, onDone, senderName }: PortalTodoItemProps) {
  const isDone = todo.status === "done";
  // Kunde kann abhaken wenn: explizit zugewiesen (customer) ODER keine Zuweisung (null = jeder)
  const canDone = !isDone && (todo.assignedToType === "customer" || todo.assignedToType === null);

  return (
    <div className={`rounded-md border text-sm transition-colors ${isDone ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="flex items-start gap-2 px-2.5 py-2">
        {isDone
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          : (
            <button
              className={`h-4 w-4 shrink-0 mt-0.5 rounded-full border-2 transition-colors focus:outline-none ${
                canDone
                  ? "border-slate-400 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer"
                  : "border-slate-300 cursor-default opacity-50"
              }`}
              title={canDone ? "Als erledigt markieren" : ""}
              onClick={(e) => { e.stopPropagation(); if (canDone) onDone(); }}
              disabled={!canDone}
            />
          )
        }
        <div className="flex-1 flex items-start gap-1 cursor-pointer" onClick={onToggle}>
          <span className={`flex-1 leading-snug text-slate-800 ${isDone ? "line-through text-slate-400" : ""}`}>
            {todo.text}
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />}
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2 border-t border-slate-100 pt-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>Von: <strong>{todo.createdBy}</strong></span>
            {todo.assignedTo && (
              <span>Für: <strong>{todo.assignedTo}</strong></span>
            )}
            <span>{formatDate(todo.createdAt)}</span>
          </div>
          {todo.handoverComment && (
            <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">{todo.handoverComment}</p>
          )}
          {isDone && todo.doneBy && (
            <p className="text-xs text-emerald-600">✓ Erledigt von {todo.doneBy}</p>
          )}
          {canDone && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onDone}
            >
              <CheckCircle2 className="h-3 w-3" /> Als erledigt markieren
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────
export default function TodoPanel(props: TodoPanelProps) {
  if (props.mode === "erp") {
    return <ErpTodoPanel {...props} />;
  }
  return <PortalTodoPanel {...props} />;
}

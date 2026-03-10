
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, Building2, Truck, BookOpen, Image, Bot, Layers, TrendingUp, MessageSquare, FolderKanban, Zap, MessageCircle, Phone, UserCheck, Mail, MoreHorizontal, Bell, AlertTriangle, Receipt, CalendarDays } from "lucide-react";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

import { useAuth } from "@/_core/hooks/useAuth";

const SOURCE_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "telefon", label: "Telefon", icon: Phone },
  { value: "persoenlich", label: "Persönlich", icon: UserCheck },
  { value: "email", label: "E-Mail", icon: Mail },
  { value: "sonstiges", label: "Sonstiges", icon: MoreHorizontal },
];

function QuickNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("whatsapp");
  const [projectId, setProjectId] = useState<string>("none");
  const { data: projects } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const createNote = trpc.quickNotes.create.useMutation({
    onSuccess: () => {
      toast.success("Notiz gespeichert");
      setText("");
      setSource("whatsapp");
      setProjectId("none");
      utils.quickNotes.list.invalidate();
      utils.dashboard.stats.invalidate();
      onClose();
    },
    onError: () => toast.error("Fehler beim Speichern"),
  });
  const handleSave = () => {
    if (!text.trim()) return;
    createNote.mutate({
      text: text.trim(),
      source: source as any,
      projectId: projectId !== "none" ? parseInt(projectId) : null,
    });
  };
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSave();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, text, source, projectId]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            Schnellnotiz
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            autoFocus
            placeholder="Was wurde besprochen? (WhatsApp, Telefon, persönlich...)"
            value={text}
            onChange={e => setText(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <div className="flex gap-2">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Projekt zuordnen (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Projekt</SelectItem>
                {(projects ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Tipp: Strg+Enter zum schnellen Speichern</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={!text.trim() || createNote.isPending}>
            {createNote.isPending ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FolderKanban, label: "Projekte", path: "/projects" },
  { icon: Users, label: "Kunden", path: "/customers" },
  { icon: Truck, label: "Lieferanten", path: "/suppliers" },
  { icon: MessageSquare, label: "Beratungshistorie", path: "/consultation" },
  { icon: Bot, label: "KI-Assistent", path: "/ai" },
  { icon: BookOpen, label: "Wissensdatenbank", path: "/knowledge" },
  { icon: Image, label: "Bilddatenbank", path: "/images" },
  { icon: Layers, label: "Materialien", path: "/materials" },
  { icon: TrendingUp, label: "Lead-Quellen", path: "/leads" },
  { icon: Bell, label: "Notizen", path: "/notes" },
  { icon: AlertTriangle, label: "Reklamationen", path: "/complaints" },
  { icon: Receipt, label: "Angebote & Rechnungen", path: "/invoices" },
  { icon: CalendarDays, label: "Kalender", path: "/calendar" },
  { icon: MoreHorizontal, label: "Einstellungen", path: "/settings" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate text-primary">
                    Fabrica ERP
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <QuickNoteModal open={quickNoteOpen} onClose={() => setQuickNoteOpen(false)} />
      <SidebarInset>
        {/* Mobile + Desktop Header */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-3 md:px-4 py-2 bg-background/95 backdrop-blur border-b h-14">
          <div className="flex items-center gap-2">
            {isMobile && (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background shrink-0" />
            )}
            <span className="font-medium text-foreground text-sm md:text-base truncate">
              {activeMenuItem?.label ?? "Fabrica ERP"}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-yellow-400 border-yellow-400/30 hover:bg-yellow-400/10 hover:text-yellow-300 text-xs md:text-sm px-2 md:px-3"
            onClick={() => setQuickNoteOpen(true)}
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Schnellnotiz</span>
            <span className="sm:hidden">Notiz</span>
          </Button>
        </div>
        <main className="flex-1 p-3 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

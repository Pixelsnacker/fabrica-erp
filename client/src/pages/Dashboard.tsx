import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, FolderKanban, Euro, ArrowRight, Plus, HardDrive, Wifi, WifiOff, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const STATUS_LABELS: Record<string, string> = {
  inquiry: "Anfrage",
  calculation: "Kalkulation",
  offer: "Angebot",
  order: "Auftrag",
  production: "Produktion",
  shipping: "Versand",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

const STATUS_COLORS: Record<string, string> = {
  inquiry: "#3b82f6",
  calculation: "#eab308",
  offer: "#f97316",
  order: "#a855f7",
  production: "#06b6d4",
  shipping: "#6366f1",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: projects } = trpc.projects.list.useQuery({});
  const { data: driveStatus, isLoading: driveLoading } = trpc.customerFiles.testConnection.useQuery(
    undefined,
    { retry: false, refetchOnWindowFocus: false }
  );

  const recentProjects = projects?.slice(0, 6) ?? [];

  const chartData = stats?.statusCounts
    ? Object.entries(stats.statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status] ?? status,
        count,
        status,
      }))
    : [];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">Willkommen zurück, Daniel</p>
        </div>
        <Button onClick={() => setLocation("/projects")} size="sm" className="gap-1.5 text-xs md:text-sm">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Neues Projekt</span>
          <span className="sm:hidden">Neu</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs md:text-sm leading-tight">Projekte</span>
              <FolderKanban className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary shrink-0" />
            </div>
            <div className="text-2xl md:text-3xl font-bold">{isLoading ? "–" : stats?.totalProjects ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{stats?.openProjects ?? 0} offen</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs md:text-sm leading-tight">Monat EK</span>
              <Euro className="h-3.5 w-3.5 md:h-4 md:w-4 text-yellow-400 shrink-0" />
            </div>
            <div className="text-xl md:text-3xl font-bold text-yellow-400">
              {isLoading ? "–" : `${parseFloat(stats?.monthlyEk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Einkauf</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs md:text-sm leading-tight">Monat VK</span>
              <Euro className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary shrink-0" />
            </div>
            <div className="text-xl md:text-3xl font-bold text-primary">
              {isLoading ? "–" : `${parseFloat(stats?.monthlyVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Verkauf</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-muted-foreground text-xs md:text-sm leading-tight">Marge</span>
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-400 shrink-0" />
            </div>
            <div className="text-xl md:text-3xl font-bold text-green-400">
              {isLoading ? "–" : `${parseFloat(stats?.monthlyMargin ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {parseFloat(stats?.totalMarginPct ?? "0").toFixed(1)}% gesamt
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Google Drive Status */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card">
        <div className={`flex items-center gap-1.5 shrink-0 ${
          driveLoading ? 'text-muted-foreground' :
          driveStatus?.connected ? 'text-green-400' : 'text-destructive'
        }`}>
          {driveLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : driveStatus?.connected ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <HardDrive className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium">
            Google Drive
          </span>
          <span className={`ml-2 text-xs ${
            driveLoading ? 'text-muted-foreground' :
            driveStatus?.connected ? 'text-green-400' : 'text-destructive'
          }`}>
            {driveLoading ? 'Verbinde...' : driveStatus?.connected ? `Verbunden · ${driveStatus.email}` : 'Nicht verbunden'}
          </span>
        </div>
        {driveStatus?.connected && driveStatus.storageUsed && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            {driveStatus.storageUsed}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Status Chart */}
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm md:text-base font-semibold">Projekte nach Status</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {chartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                Noch keine Projekte
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} width={72} />
                  <Tooltip
                    contentStyle={{ background: "#1e2130", border: "1px solid #374151", borderRadius: 6 }}
                    labelStyle={{ color: "#e5e7eb" }}
                    itemStyle={{ color: "#9ca3af" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Projects */}
        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base font-semibold">Aktuelle Projekte</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="gap-1 text-xs h-7">
              Alle <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {recentProjects.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <FolderKanban className="h-8 w-8 opacity-30" />
                <p className="text-sm">Noch keine Projekte angelegt</p>
                <Button size="sm" onClick={() => setLocation("/projects")}>Erstes Projekt anlegen</Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-2.5 md:p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-xs md:text-sm truncate">{project.title}</span>
                        {project.projectNumber && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">#{project.projectNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString("de-DE")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <div className="text-right hidden xs:block">
                        <div className="text-xs md:text-sm font-medium text-primary">
                          {parseFloat(project.totalVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €
                        </div>
                        <div className="text-xs text-green-400">
                          {parseFloat(project.marginPercent ?? "0").toFixed(0)}%
                        </div>
                      </div>
                      <Badge className={`status-${project.status} text-xs px-1.5 py-0.5`}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

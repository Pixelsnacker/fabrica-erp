import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, FolderKanban, Users, Euro, ArrowRight, Plus } from "lucide-react";
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

  const recentProjects = projects?.slice(0, 6) ?? [];

  const chartData = stats?.statusCounts
    ? Object.entries(stats.statusCounts).map(([status, count]) => ({
        name: STATUS_LABELS[status] ?? status,
        count,
        status,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Willkommen zurück, Daniel</p>
        </div>
        <Button onClick={() => setLocation("/projects")} className="gap-2">
          <Plus className="h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">Projekte gesamt</span>
              <FolderKanban className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">{isLoading ? "–" : stats?.totalProjects ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats?.openProjects ?? 0} offen</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">Monat EK</span>
              <Euro className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold text-yellow-400">
              {isLoading ? "–" : `${parseFloat(stats?.monthlyEk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Einkauf diesen Monat</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">Monat VK</span>
              <Euro className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-bold text-primary">
              {isLoading ? "–" : `${parseFloat(stats?.monthlyVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Verkauf diesen Monat</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">Marge (Monat)</span>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400">
              {isLoading ? "–" : `${parseFloat(stats?.monthlyMargin ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Gesamt: {parseFloat(stats?.totalMarginPct ?? "0").toFixed(1)}% Marge
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Chart */}
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Projekte nach Status</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Noch keine Projekte
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} width={80} />
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Aktuelle Projekte</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/projects")} className="gap-1 text-xs">
              Alle anzeigen <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <FolderKanban className="h-8 w-8 opacity-30" />
                <p className="text-sm">Noch keine Projekte angelegt</p>
                <Button size="sm" onClick={() => setLocation("/projects")}>Erstes Projekt anlegen</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                    onClick={() => setLocation(`/projects/${project.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{project.title}</span>
                        {project.projectNumber && (
                          <span className="text-xs text-muted-foreground">#{project.projectNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.createdAt).toLocaleDateString("de-DE")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">
                          {parseFloat(project.totalVk ?? "0").toLocaleString("de-DE", { minimumFractionDigits: 0 })} €
                        </div>
                        <div className="text-xs text-green-400">
                          {parseFloat(project.marginPercent ?? "0").toFixed(0)}% Marge
                        </div>
                      </div>
                      <Badge className={`status-${project.status} text-xs px-2 py-0.5`}>
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

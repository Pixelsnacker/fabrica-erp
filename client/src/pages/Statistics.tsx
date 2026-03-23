import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, XCircle, CheckCircle2, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from "recharts";

const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const REJECTION_REASON_LABELS: Record<string, string> = {
  preis: "Preis zu hoch",
  timing: "Timing / Lieferzeit",
  wettbewerber: "Wettbewerber",
  kein_feedback: "Kein Feedback",
  sonstiges: "Sonstiges",
};

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#6b7280"];

const CHART_COLORS = {
  offers: "#6366f1",
  orders: "#22c55e",
  rejected: "#ef4444",
};

export default function Statistics() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const { data, isLoading } = trpc.statistics.projectStats.useQuery({ year });

  const byMonth = (data?.byMonth ?? []).map((m: any) => ({
    ...m,
    name: MONTH_LABELS[m.month - 1],
  }));

  const rejectionReasons = (data?.rejectionReasons ?? []).map((r: any) => ({
    name: REJECTION_REASON_LABELS[r.reason] ?? r.reason,
    value: r.count,
  }));

  const kpis = data?.kpis ?? { hitRate: 0, totalOffers: 0, totalOrders: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            Statistik & Auswertung
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">Projektauswertung und Hit Rate</p>
        </div>
        <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Lade Statistiken...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Hit Rate</p>
                    <p className="text-3xl font-bold text-primary mt-1">{kpis.hitRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Anfragen → Aufträge</p>
                  </div>
                  <Target className="h-10 w-10 text-primary/30" />
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(kpis.hitRate, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Projekte gesamt</p>
                    <p className="text-3xl font-bold mt-1">{kpis.totalOffers}</p>
                    <p className="text-xs text-muted-foreground mt-1">Anfragen in {year}</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Aufträge</p>
                    <p className="text-3xl font-bold text-green-400 mt-1">{kpis.totalOrders}</p>
                    <p className="text-xs text-muted-foreground mt-1">Angenommene Projekte</p>
                  </div>
                  <CheckCircle2 className="h-10 w-10 text-green-400/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monatsverlauf {year}</CardTitle>
            </CardHeader>
            <CardContent>
              {byMonth.every((m: any) => m.offers === 0) ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart2 className="h-10 w-10 opacity-20 mb-2" />
                  <p className="text-sm">Keine Daten für {year}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={byMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ color: "#f1f5f9" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="offers" name="Anfragen" fill={CHART_COLORS.offers} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="orders" name="Aufträge" fill={CHART_COLORS.orders} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="rejected" name="Nicht angenommen" fill={CHART_COLORS.rejected} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Rejection Reasons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  Ablehnungsgründe {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rejectionReasons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">Keine Ablehnungen in {year}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={rejectionReasons}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {rejectionReasons.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Aufschlüsselung</CardTitle>
              </CardHeader>
              <CardContent>
                {rejectionReasons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <p className="text-sm">Keine Ablehnungen in {year}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rejectionReasons
                      .sort((a: any, b: any) => b.value - a.value)
                      .map((r: any, i: number) => {
                        const total = rejectionReasons.reduce((s: number, x: any) => s + x.value, 0);
                        const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
                        return (
                          <div key={r.name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                {r.name}
                              </span>
                              <span className="text-muted-foreground text-xs">{r.value}× ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

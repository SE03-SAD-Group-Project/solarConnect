"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart3, Download, TrendingUp, Package, Star, Users } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { fetchApplications, type Application } from "@/lib/auth"

type Invoice = {
  id: string
  amount: number
  type: "authority_fee" | "installation" | "monthly_bill"
  status: "pending" | "paid" | "overdue"
  createdAt: string
}

type BidSession = {
  id: string
  bids: { installerId?: string; status: string }[]
  startedAt: string
}

export default function InstallerReports() {
  const [period, setPeriod] = useState("6months")
  const [applications, setApplications] = useState<Application[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [sessions, setSessions] = useState<BidSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [apps, invoicesRes, bidsRes] = await Promise.all([
          fetchApplications(),
          fetch("/api/payments?includeMonthly=true", { cache: "no-store" }),
          fetch("/api/bids", { cache: "no-store" }),
        ])
        if (!invoicesRes.ok) throw new Error("Unable to load invoices")
        const invoicesData = await invoicesRes.json()
        const bidsData = bidsRes.ok ? await bidsRes.json() : { bidSessions: [] }
        setApplications(apps)
        setInvoices(invoicesData.invoices ?? [])
        setSessions(bidsData.bidSessions ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load reports")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const monthWindow = period === "1month" ? 1 : period === "3months" ? 3 : period === "1year" ? 12 : 6
  const now = new Date()
  const months = useMemo(() => {
    const result: { key: string; label: string; month: number; year: number }[] = []
    for (let i = monthWindow - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      result.push({
        key: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: date.toLocaleString("default", { month: "short" }),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      })
    }
    return result
  }, [monthWindow, now])

  const installationInvoices = invoices.filter((inv) => inv.type === "installation")

  const monthlyData = useMemo(() => {
    return months.map((m) => {
      const revenue = installationInvoices
        .filter((inv) => {
          const created = new Date(inv.createdAt)
          return created.getMonth() + 1 === m.month && created.getFullYear() === m.year
        })
        .reduce((sum, inv) => sum + inv.amount, 0)
      const installations = applications.filter((app) => {
        const created = new Date(app.createdAt)
        return created.getMonth() + 1 === m.month && created.getFullYear() === m.year
      }).length
      const bidsWon = sessions
        .filter((session) => {
          const started = new Date(session.startedAt)
          return started.getMonth() + 1 === m.month && started.getFullYear() === m.year
        })
        .filter((session) => session.bids.some((bid) => bid.status === "accepted")).length
      return { month: m.label, revenue, installations, bidsWon }
    })
  }, [months, installationInvoices, applications, sessions])

  const stats = useMemo(() => {
    const totalRevenue = installationInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    const totalInstallations = applications.filter((app) =>
      ["installation_in_progress", "installation_complete", "final_inspection", "completed"].includes(app.status),
    ).length
    const bidWins = sessions.filter((session) => session.bids.some((bid) => bid.status === "accepted")).length
    const bidsTotal = sessions.length
    const bidSuccessRate = bidsTotal ? Math.round((bidWins / bidsTotal) * 100) : 0
    return {
      totalRevenue,
      totalInstallations,
      avgRating: 4.8,
      bidSuccessRate,
      repeatCustomers: new Set(applications.map((app) => app.customerId)).size,
    }
  }, [applications, installationInvoices, sessions])

  const packagePerformance = useMemo(() => {
    const map = new Map<string, { sales: number; revenue: number }>()
    applications.forEach((app) => {
      const name = app.selectedInstaller?.packageName ?? "Unspecified"
      const price = app.selectedInstaller?.price ?? 0
      const current = map.get(name) ?? { sales: 0, revenue: 0 }
      map.set(name, { sales: current.sales + 1, revenue: current.revenue + price })
    })
    return Array.from(map.entries()).map(([name, values]) => ({
      name,
      sales: values.sales,
      revenue: values.revenue,
    }))
  }, [applications])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground">Track your business performance and growth</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="bg-transparent" asChild>
              <a href="/api/reports/installer/pdf" download>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </a>
            </Button>
          </div>
        </div>

        {error && <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">{error}</div>}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-lg font-bold text-foreground">Rs. {(stats.totalRevenue / 1000000).toFixed(1)}M</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Installations</p>
                  <p className="text-lg font-bold text-foreground">{stats.totalInstallations}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                  <p className="text-lg font-bold text-foreground">{stats.avgRating}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bid Success</p>
                  <p className="text-lg font-bold text-foreground">{stats.bidSuccessRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Repeat Customers</p>
                  <p className="text-lg font-bold text-foreground">{stats.repeatCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Revenue Trend
              </CardTitle>
              <CardDescription>Monthly revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">Loading chart…</div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" tickFormatter={(value) => `${value / 1000000}M`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [`Rs. ${value.toLocaleString()}`, "Revenue"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Installations & Bids
              </CardTitle>
              <CardDescription>Monthly installations and bid wins</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center text-muted-foreground">Loading chart…</div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar
                        dataKey="installations"
                        fill="hsl(var(--chart-1))"
                        name="Installations"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar dataKey="bidsWon" fill="hsl(var(--chart-2))" name="Bids Won" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Package Performance</CardTitle>
            <CardDescription>Sales breakdown by package type</CardDescription>
          </CardHeader>
          <CardContent>
            {packagePerformance.length === 0 ? (
              <div className="text-center text-muted-foreground">No package performance data yet.</div>
            ) : (
              <div className="space-y-4">
                {packagePerformance.map((pkg) => (
                  <div key={pkg.name} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div>
                      <p className="font-semibold text-foreground">{pkg.name} Package</p>
                      <p className="text-sm text-muted-foreground">{pkg.sales} sales</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">Rs. {(pkg.revenue / 1000000).toFixed(1)}M</p>
                      <p className="text-xs text-muted-foreground">
                        Avg: Rs. {pkg.sales ? Math.round(pkg.revenue / pkg.sales).toLocaleString() : 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

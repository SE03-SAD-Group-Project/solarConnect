"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Download, CheckCircle, Clock, Zap, CreditCard, TrendingUp, FileText } from "lucide-react"
import type { Invoice, MonthlyBill } from "@/lib/prisma-types"

export default function OfficerBillingPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [invoiceSaving, setInvoiceSaving] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({
    applicationId: "",
    type: "authority_fee",
    amount: "",
    dueDate: "",
    description: "",
  })
  const [quickInvoice, setQuickInvoice] = useState<{
    applicationId: string
    amount: number
    description: string
  } | null>(null)

  const loadBilling = async () => {
    try {
      const res = await fetch("/api/payments?includeMonthly=true", {
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Unable to load billing records")
      const data = await res.json()
      setMonthlyBills(data.monthlyBills ?? [])
      setInvoices(data.invoices ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load billing records")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBilling()
  }, [])

  const billingRecords = useMemo(
    () =>
      monthlyBills.map((bill) => {
        const amount = bill.amount ?? bill.netAmount
        return {
          ...bill,
          amount,
          period: `${bill.month} ${bill.year}`,
          invoice: invoices.find((inv) => inv.id === bill.invoiceId || inv.id === bill.id),
          isCredit: amount < 0,
          applicationId: bill.applicationId ?? "N/A",
          meterReadingId: bill.meterReadingId ?? "N/A",
        }
      }),
    [monthlyBills, invoices],
  )

  const filteredRecords = billingRecords.filter((r) => {
    const matchesSearch =
      r.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(r.applicationId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.invoice?.id || "").toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && r.status === "pending") ||
      (activeTab === "credit" && r.isCredit) ||
      (activeTab === "paid" && r.status === "paid")
    return matchesSearch && matchesTab
  })

  const totalCredits = billingRecords.filter((r) => r.isCredit).reduce((sum, r) => sum + Math.abs(r.amount), 0)
  const totalPending = billingRecords.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0)
  const totalNetExport = billingRecords.reduce((sum, r) => sum + Math.max(0, r.kwhExported - r.kwhImported), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing Management</h1>
            <p className="text-muted-foreground">
              Generate invoices from payment events and monthly meter readings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => {
                const dueDate = new Date()
                dueDate.setDate(dueDate.getDate() + 14)
                setInvoiceForm((prev) => ({
                  ...prev,
                  dueDate: prev.dueDate || dueDate.toISOString().split("T")[0],
                }))
                setInvoiceDialogOpen(true)
              }}
            >
              Generate Invoice
            </Button>
            <Button variant="outline" className="bg-transparent" asChild>
              <a href="/api/reports/officer/billing/pdf" download>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </a>
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
              <a href="/api/reports/officer/billing/csv" download>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </a>
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Monthly Bills</p>
                  <p className="text-2xl font-bold text-foreground">{billingRecords.length}</p>
                </div>
                <CreditCard className="w-8 h-8 text-cyan-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Customer Credits</p>
                  <p className="text-2xl font-bold text-emerald-500">LKR {totalCredits.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Collection</p>
                  <p className="text-2xl font-bold text-amber-500">LKR {totalPending.toLocaleString()}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Grid Export</p>
                  <p className="text-2xl font-bold text-foreground">{totalNetExport} kWh</p>
                </div>
                <Zap className="w-8 h-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-foreground">Billing Records</CardTitle>
                <CardDescription>
                  Monthly bills generated from meter readings and pushed to customer invoices
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by application or invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({billingRecords.length})</TabsTrigger>
                <TabsTrigger value="credit">Credits ({billingRecords.filter((r) => r.isCredit).length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({billingRecords.filter((r) => r.status === "pending").length})</TabsTrigger>
                <TabsTrigger value="paid">Paid ({billingRecords.filter((r) => r.status === "paid").length})</TabsTrigger>
              </TabsList>

              {loading ? (
                <div className="py-10 text-center text-muted-foreground">Loading billing records…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Application</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Period</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Meter Reading</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Net</th>
                        <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Amount</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Invoice</th>
                        <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-3 px-2">
                            <p className="font-medium text-foreground">{record.applicationId}</p>
                            <p className="text-xs text-muted-foreground">Customer {record.customerId}</p>
                          </td>
                          <td className="py-3 px-2 text-foreground">{record.period}</td>
                          <td className="py-3 px-2 text-foreground">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              {record.meterReadingId}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className={record.kwhExported - record.kwhImported >= 0 ? "text-emerald-500" : "text-amber-500"}>
                              {record.kwhExported - record.kwhImported >= 0 ? "+" : ""}
                              {record.kwhExported - record.kwhImported} kWh
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            {record.isCredit ? (
                              <span className="text-emerald-500">+LKR {Math.abs(record.amount).toLocaleString()}</span>
                            ) : (
                              <span className="text-foreground">LKR {record.amount.toLocaleString()}</span>
                            )}
                          </td>
                        <td className="py-3 px-2">
                          {record.invoice ? (
                            <div className="flex flex-col gap-1">
                              <Link
                                href={`/customer/invoices/${record.invoice.id}`}
                                className="text-sm text-emerald-600 hover:underline"
                              >
                                {record.invoice.id}
                              </Link>
                              <a
                                href={record.invoice.pdfUrl ?? `/api/invoices/${record.invoice.id}/pdf`}
                                download
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Download PDF
                              </a>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <span className="text-sm text-muted-foreground">Not generated</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-fit bg-transparent"
                                onClick={() => {
                                  const dueDate = new Date()
                                  dueDate.setDate(dueDate.getDate() + 14)
                                  setInvoiceForm((prev) => ({
                                    ...prev,
                                    dueDate: prev.dueDate || dueDate.toISOString().split("T")[0],
                                    description: prev.description || `${record.period} Net Metering Bill`,
                                  }))
                                  setQuickInvoice({
                                    applicationId: record.applicationId,
                                    amount: Math.max(0, record.amount),
                                    description: `${record.period} Net Metering Bill`,
                                  })
                                }}
                              >
                                Generate Invoice
                              </Button>
                            </div>
                          )}
                        </td>
                          <td className="py-3 px-2 text-center">
                            <Badge
                              className={
                                record.isCredit
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : record.status === "paid"
                                    ? "bg-cyan-500/10 text-cyan-600"
                                    : "bg-amber-500/10 text-amber-600"
                              }
                              variant="secondary"
                            >
                              {record.isCredit ? (
                                <TrendingUp className="w-3 h-3 mr-1" />
                              ) : record.status === "paid" ? (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              ) : (
                                <Clock className="w-3 h-3 mr-1" />
                              )}
                              {record.isCredit ? "Credit" : record.status === "paid" ? "Paid" : "Pending"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={!!quickInvoice} onOpenChange={(open) => !open && setQuickInvoice(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Invoice</DialogTitle>
              <DialogDescription>Create an invoice for this billing record.</DialogDescription>
            </DialogHeader>
            {quickInvoice && (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quickApp">Application ID</Label>
                  <Input id="quickApp" value={quickInvoice.applicationId} readOnly />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quickAmount">Amount</Label>
                    <Input id="quickAmount" value={quickInvoice.amount} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quickDue">Due Date</Label>
                    <Input
                      id="quickDue"
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quickDesc">Description</Label>
                  <Input
                    id="quickDesc"
                    value={invoiceForm.description || quickInvoice.description}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setQuickInvoice(null)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={invoiceSaving}
                onClick={async () => {
                  if (!quickInvoice) return
                  setInvoiceSaving(true)
                  try {
                    const dueDateValue =
                      invoiceForm.dueDate ||
                      new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
                        .toISOString()
                        .split("T")[0]
                    const res = await fetch("/api/invoices", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        applicationId: quickInvoice.applicationId,
                        type: "monthly_bill",
                        amount: quickInvoice.amount,
                        dueDate: dueDateValue,
                        description: invoiceForm.description || quickInvoice.description,
                      }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data.error || "Unable to create invoice")
                    setQuickInvoice(null)
                    setInvoiceForm((prev) => ({ ...prev, dueDate: "", description: "" }))
                    await loadBilling()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Unable to create invoice")
                  } finally {
                    setInvoiceSaving(false)
                  }
                }}
              >
                {invoiceSaving ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
              <DialogDescription>Generate a new invoice for a customer application.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="applicationId">Application ID</Label>
                <Input
                  id="applicationId"
                  placeholder="APP-XXXXXX"
                  value={invoiceForm.applicationId}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, applicationId: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceType">Type</Label>
                  <select
                    id="invoiceType"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={invoiceForm.type}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="authority_fee">Authority Fee</option>
                    <option value="installation">Installation</option>
                    <option value="monthly_bill">Monthly Bill</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={invoiceSaving}
                onClick={async () => {
                  setInvoiceSaving(true)
                  try {
                    const res = await fetch("/api/invoices", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        applicationId: invoiceForm.applicationId,
                        type: invoiceForm.type,
                        amount: Number(invoiceForm.amount),
                        dueDate: invoiceForm.dueDate,
                        description: invoiceForm.description,
                      }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error(data.error || "Unable to create invoice")
                    setInvoiceDialogOpen(false)
                    setInvoiceForm({
                      applicationId: "",
                      type: "authority_fee",
                      amount: "",
                      dueDate: "",
                      description: "",
                    })
                    await loadBilling()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Unable to create invoice")
                  } finally {
                    setInvoiceSaving(false)
                  }
                }}
              >
                {invoiceSaving ? "Creating..." : "Create Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}

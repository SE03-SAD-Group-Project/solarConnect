"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Download, ArrowLeft } from "lucide-react"

type InvoicePayload = {
  id: string
  type: "authority_fee" | "installation" | "monthly_bill"
  description: string
  amount: number
  status: "pending" | "paid" | "overdue"
  dueDate: string
  paidAt?: string | null
  pdfUrl?: string | null
  application?: { status?: string }
}

type MonthlyBillPayload = {
  month: number
  year: number
  kwhGenerated: number
  kwhExported: number
  kwhImported: number
}

export default function InvoiceBillPage() {
  const params = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null)
  const [monthlyBill, setMonthlyBill] = useState<MonthlyBillPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/invoices/${params.id}`, { cache: "no-store" })
        if (!res.ok) throw new Error("Invoice not found")
        const data = await res.json()
        setInvoice(data.invoice)
        setMonthlyBill(data.monthlyBill ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load invoice")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  const netUnits = useMemo(() => {
    if (!monthlyBill) return 0
    return monthlyBill.kwhExported - monthlyBill.kwhImported
  }, [monthlyBill])

  async function handlePayNow() {
    if (!invoice) return
    setPaying(true)
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Unable to start payment")
      if (data.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed")
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-12 text-muted-foreground">Loading bill…</div>
      </DashboardLayout>
    )
  }

  if (!invoice || error) {
    return (
      <DashboardLayout>
        <div className="py-12 space-y-4">
          <p className="text-destructive">{error ?? "Invoice not found"}</p>
          <Button asChild variant="outline">
            <Link href="/customer/invoices">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to invoices
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline">
            <Link href={`/customer/invoices/${invoice.id}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/invoices/${invoice.id}/pdf`} download>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </a>
          </Button>
        </div>

        <div className="rounded-3xl border border-border overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-emerald-500/15 via-sky-500/10 to-pink-500/15 px-8 pt-8 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
                <h1 className="text-2xl font-bold text-foreground">{invoice.id}</h1>
              </div>
              <Badge
                className={
                  invoice.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-700"
                    : invoice.status === "overdue"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-amber-500/10 text-amber-600"
                }
                variant="secondary"
              >
                {invoice.status.toUpperCase()}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{invoice.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-pink-500/40 px-3 py-1 text-xs font-semibold text-pink-600">
              NET ACCOUNT
            </div>
          </div>

          <div className="px-8 py-6 space-y-6 bg-white">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Billing Month</p>
              <p className="text-lg font-semibold text-foreground">
                {monthlyBill
                  ? `${monthlyBill.year}-${String(monthlyBill.month).padStart(2, "0")}`
                  : new Date(invoice.dueDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Billing Date | {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 px-6 py-6 text-center space-y-2 bg-gradient-to-b from-white to-emerald-500/5">
              <p className="text-sm text-emerald-700">Total amount due on last issued bill</p>
              <p className="text-4xl font-bold text-foreground">
                {invoice.amount.toFixed(2)} LKR
              </p>
              <p className="text-xs text-muted-foreground">(Full or partial payments accepted)</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={handlePayNow}
                  disabled={invoice.status !== "pending" || paying}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {paying ? "Processing..." : "Pay Now"}
                </Button>
                <Button asChild variant="outline" className="bg-transparent border-pink-400 text-pink-600 hover:bg-pink-500/10">
                  <a href={`/api/invoices/${invoice.id}/pdf`} download>
                    <Download className="w-4 h-4 mr-2" />
                    View e-Bill
                  </a>
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border/60 rounded-2xl border border-border/70 overflow-hidden">
              <Row label="Outstanding" value={`${invoice.amount.toFixed(2)} LKR`} />
              <Row label="Import" value={`${monthlyBill?.kwhImported ?? 0} kWh`} />
              <Row label="Export" value={`${monthlyBill?.kwhExported ?? 0} kWh`} />
              <Row label="Net Units" value={`${netUnits} kWh`} />
              <Row label="Monthly Bill" value={`${invoice.amount.toFixed(2)} LKR`} />
              <Row label="Total Amount Due" value={`${invoice.amount.toFixed(2)} LKR`} highlight />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              To get e-Bill every month to your e-mail{" "}
              <span className="text-emerald-600 font-medium">register here</span>
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white">
      <span className={highlight ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>
        {value}
      </span>
    </div>
  )
}

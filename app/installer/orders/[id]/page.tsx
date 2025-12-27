"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, CheckCircle, Clock, MapPin, Package, Phone, Mail } from "lucide-react"
import { fetchApplications, type Application } from "@/lib/auth"

type OrderStatus = "installation_pending" | "in_progress" | "completed"

export default function InstallerOrderDetail() {
  const params = useParams<{ id: string }>()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    let active = true
    async function loadOrder() {
      try {
        const apps = await fetchApplications()
        const match = apps.find(
          (app) => app.id === params.id || app.reference === params.id || app.bidId === params.id,
        )
        if (!match) {
          throw new Error("Order not found")
        }
        if (active) setApplication(match)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load order")
      } finally {
        if (active) setLoading(false)
      }
    }
    loadOrder()
    return () => {
      active = false
    }
  }, [params.id])

  const orderStatus: OrderStatus | null = useMemo(() => {
    if (!application) return null
    if (application.status === "installation_in_progress") return "in_progress"
    if (
      ["installation_complete", "final_inspection", "completed"].includes(application.status)
    ) {
      return "completed"
    }
    return "installation_pending"
  }, [application])

  const installationInvoice = useMemo(() => {
    return application?.invoices?.find((inv) => inv.type === "installation")
  }, [application])

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "installation_pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600" variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending Start
          </Badge>
        )
      case "in_progress":
        return (
          <Badge className="bg-blue-500/10 text-blue-600" variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600" variant="secondary">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      default:
        return null
    }
  }

  const updateStatus = async (status: Application["status"]) => {
    if (!application) return
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to update order")
      }
      setApplication(data.application)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-muted-foreground">Loading order...</div>
      </DashboardLayout>
    )
  }

  if (error || !application || !orderStatus) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Link href="/installer/orders">
            <Button variant="ghost" size="sm" className="bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to orders
            </Button>
          </Link>
          <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            {error || "Order not found"}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const amount = application.selectedInstaller?.price ?? installationInvoice?.amount ?? 0
  const location =
    (application.technicalDetails as any)?.siteAddress ||
    (application.technicalDetails as any)?.address ||
    application.address ||
    "Address not provided"

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/installer/orders">
            <Button variant="ghost" size="icon" className="bg-transparent">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Order {application.id}</h1>
            <p className="text-muted-foreground">
              {application.customerName} • {application.selectedInstaller?.packageName ?? "Selected package"}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Order Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(orderStatus)}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Order Value</p>
                <p className="text-xl font-bold text-foreground">Rs. {amount.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-foreground">{location}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Package className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-foreground">
                    {application.selectedInstaller?.packageName ?? "Package selected"}
                  </p>
                  {application.technicalDetails?.desiredCapacity && (
                    <p className="text-xs text-muted-foreground">
                      {application.technicalDetails.desiredCapacity} kW
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 mt-0.5" />
                <p className="text-foreground">{application.phone ?? "Phone not available"}</p>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Mail className="w-4 h-4 mt-0.5" />
                <p className="text-foreground">{application.email ?? "Email not available"}</p>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 mt-0.5" />
                <p className="text-foreground">
                  Updated {new Date(application.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invoice Status</span>
              <span className="text-foreground">
                {installationInvoice?.status ?? "Not generated"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invoice Amount</span>
              <span className="text-foreground">
                Rs. {(installationInvoice?.amount ?? amount).toLocaleString()}
              </span>
            </div>
            {installationInvoice?.dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="text-foreground">
                  {new Date(installationInvoice.dueDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-2">
          {orderStatus === "installation_pending" && (
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={() => updateStatus("installation_in_progress")}
              disabled={actionLoading}
            >
              {actionLoading ? "Updating..." : "Start Installation"}
            </Button>
          )}
          {orderStatus === "in_progress" && (
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => updateStatus("installation_complete")}
              disabled={actionLoading}
            >
              {actionLoading ? "Updating..." : "Mark Installation Complete"}
            </Button>
          )}
          {orderStatus === "completed" && (
            <Button variant="outline" className="bg-transparent" disabled>
              Installation Completed
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

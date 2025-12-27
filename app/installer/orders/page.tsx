"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ClipboardList, Clock, CheckCircle, MapPin, Phone, Mail, Calendar } from "lucide-react"
import { fetchApplications, type Application } from "@/lib/auth"

type OrderStatus = "installation_pending" | "in_progress" | "completed"

type Order = {
  id: string
  applicationId: string
  customerName: string
  email?: string
  phone?: string
  location: string
  packageName: string
  capacity: string
  amount: number
  status: OrderStatus
  paymentStatus: "pending" | "paid" | "overdue"
  updatedAt: string
}

export default function InstallerOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    async function loadOrders() {
      try {
        const apps = await fetchApplications()
        const mapped = apps
          .filter((app) => app.selectedInstaller)
          .map<Order>((app) => {
            const statusMap: Record<Application["status"], OrderStatus> = {
              pending: "installation_pending",
              under_review: "installation_pending",
              pre_visit_approved: "installation_pending",
              site_visit_scheduled: "installation_pending",
              approved: "installation_pending",
              site_visit_payment_completed: "installation_pending",
              rejected: "installation_pending",
              payment_pending: "installation_pending",
              payment_confirmed: "installation_pending",
              finding_installer: "installation_pending",
              agreement_pending: "installation_pending",
              installation_in_progress: "in_progress",
              installation_complete: "completed",
              final_inspection: "completed",
              completed: "completed",
            }
            const installationInvoice = app.invoices?.find((inv) => inv.type === "installation")
            const amount = app.selectedInstaller?.price ?? installationInvoice?.amount ?? 0
            return {
              id: `ORD-${app.id}`,
              applicationId: app.id,
              customerName: app.customerName,
              email: app.email,
              phone: app.phone,
              location:
                (app.technicalDetails as any)?.siteAddress ||
                (app.technicalDetails as any)?.address ||
                app.address ||
                "Address not provided",
              packageName: app.selectedInstaller?.packageName || "Selected package",
              capacity: app.technicalDetails?.desiredCapacity
                ? `${app.technicalDetails.desiredCapacity} kW`
                : "Capacity TBD",
              amount,
              status: statusMap[app.status] || "installation_pending",
              paymentStatus: installationInvoice?.status ?? "pending",
              updatedAt: app.updatedAt,
            }
          })
        if (active) setOrders(mapped)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load orders")
      } finally {
        if (active) setLoading(false)
      }
    }
    loadOrders()
    return () => {
      active = false
    }
  }, [])

  const getStatusBadge = (status: string) => {
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

  const filteredOrders =
    activeTab === "all"
      ? orders
      : orders.filter((order) => {
          if (activeTab === "pending") return order.status === "installation_pending"
          if (activeTab === "in_progress") return order.status === "in_progress"
          if (activeTab === "completed") return order.status === "completed"
          return true
        })

  const stats = useMemo(() => {
    return {
      pending: orders.filter((o) => o.status === "installation_pending").length,
      inProgress: orders.filter((o) => o.status === "in_progress").length,
      completed: orders.filter((o) => o.status === "completed").length,
      totalValue: orders.reduce((sum, o) => sum + o.amount, 0),
    }
  }, [orders])

  const updateOrderStatus = async (order: Order, status: Application["status"]) => {
    try {
      const res = await fetch(`/api/applications/${order.applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to update order")
      }
      const updatedStatus: Record<Application["status"], OrderStatus> = {
        pending: "installation_pending",
        under_review: "installation_pending",
        pre_visit_approved: "installation_pending",
        site_visit_scheduled: "installation_pending",
        approved: "installation_pending",
        site_visit_payment_completed: "installation_pending",
        rejected: "installation_pending",
        payment_pending: "installation_pending",
        payment_confirmed: "installation_pending",
        finding_installer: "installation_pending",
        agreement_pending: "installation_pending",
        installation_in_progress: "in_progress",
        installation_complete: "completed",
        final_inspection: "completed",
        completed: "completed",
      }
      setOrders((prev) =>
        prev.map((item) =>
          item.applicationId === order.applicationId
            ? { ...item, status: updatedStatus[data.application?.status ?? status], updatedAt: data.application?.updatedAt ?? item.updatedAt }
            : item,
        ),
      )
      setSelectedOrder((prev) =>
        prev && prev.applicationId === order.applicationId
          ? { ...prev, status: updatedStatus[data.application?.status ?? status], updatedAt: data.application?.updatedAt ?? prev.updatedAt }
          : prev,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order")
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Installation Orders</h1>
          <p className="text-muted-foreground">Manage your solar installation projects</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.pending}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.inProgress}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stats.completed}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    Rs. {stats.totalValue.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Orders ({filteredOrders.length})</CardTitle>
                <CardDescription>Click on an order to view details and update status</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
                ) : error ? (
                  <div className="text-center py-8 text-destructive">{error}</div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No orders in this category</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredOrders.map((order) => (
                      <Dialog key={order.id}>
                        <DialogTrigger asChild>
                          <div
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:border-amber-500/30 cursor-pointer transition-colors"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <div className="mb-3 sm:mb-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground">{order.customerName}</p>
                                {getStatusBadge(order.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {order.packageName} • {order.capacity}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <MapPin className="w-3 h-3" />
                                {order.location}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4">
                              <div className="text-right">
                                <p className="font-bold text-foreground">Rs. {order.amount.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">
                                  Updated: {new Date(order.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-foreground">Order Details</DialogTitle>
                            <DialogDescription>{order.id}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{order.customerName}</span>
                                {getStatusBadge(order.status)}
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Mail className="w-4 h-4" />
                                  {order.email}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Phone className="w-4 h-4" />
                                  {order.phone}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="w-4 h-4" />
                                  {order.location}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="w-4 h-4" />
                                  Updated: {new Date(order.updatedAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between p-3 rounded-lg border border-border">
                              <span className="text-muted-foreground">Package</span>
                              <span className="font-medium text-foreground">
                                {order.packageName} ({order.capacity})
                              </span>
                            </div>
                            <div className="flex justify-between p-3 rounded-lg border border-border">
                              <span className="text-muted-foreground">Amount</span>
                              <span className="font-bold text-foreground">Rs. {order.amount.toLocaleString()}</span>
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            {order.status === "installation_pending" && (
                              <Button
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                                onClick={() => updateOrderStatus(order, "installation_in_progress")}
                              >
                                Start Installation
                              </Button>
                            )}
                            {order.status === "in_progress" && (
                              <Button
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => updateOrderStatus(order, "installation_complete")}
                              >
                                Mark as Complete
                              </Button>
                            )}
                            {order.status === "completed" && (
                              <Button variant="outline" className="w-full bg-transparent" asChild>
                                <a href={`/api/orders/${order.applicationId}/report`} download>
                                  Download Report
                                </a>
                              </Button>
                            )}
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

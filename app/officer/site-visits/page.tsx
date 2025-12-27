"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, CheckCircle, MapPin, ThumbsUp, ThumbsDown, Navigation } from "lucide-react"
import type { Application } from "@/lib/auth"

export default function OfficerSiteVisits() {
  const [activeTab, setActiveTab] = useState("upcoming")
  const [selectedVisit, setSelectedVisit] = useState<{
    id: string
    applicationId: string
    customerName: string
    phone?: string
    address?: string
    date: string
    time: string
    timeLabel: string
    status: "scheduled" | "completed"
    completedAt?: string
    technicalDetails?: {
      roofType?: string
      roofArea?: string
      desiredCapacity?: string
    }
    notes?: string
    recommendation?: "approved" | "rejected"
  } | null>(null)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [visitNotes, setVisitNotes] = useState("")
  const [recommendation, setRecommendation] = useState<"approved" | "rejected" | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rescheduleDateTime, setRescheduleDateTime] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/officer/applications")
        if (!res.ok) throw new Error("Unable to load applications")
        const data = await res.json()
        setApplications(data.applications || [])
      } catch {
        setApplications([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const siteVisits = useMemo(() => {
    return applications
      .filter((app) => app.siteVisitDate)
      .map((app) => {
        const date = new Date(app.siteVisitDate as string)
        const address =
          app.address ||
          (app.technicalDetails as any)?.siteAddress ||
          ""
        const status: "scheduled" | "completed" =
          app.status === "site_visit_scheduled" ? "scheduled" : "completed"
        const recommendation: "approved" | "rejected" | undefined =
          status === "completed"
            ? app.status === "rejected"
              ? "rejected"
              : "approved"
            : undefined
        return {
          id: `SV-${app.id}`,
          applicationId: app.id,
          customerName: app.customerName,
          phone: app.phone,
          address,
          date: date.toISOString().split("T")[0],
          time: date.toISOString().slice(11, 16),
          timeLabel: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          status,
          completedAt: status === "completed" ? date.toISOString() : undefined,
          technicalDetails: {
            roofType: app.technicalDetails?.roofType,
            roofArea: app.technicalDetails?.roofArea,
            desiredCapacity: (app.technicalDetails as any)?.desiredCapacity,
          },
          notes: app.rejectionReason,
          recommendation,
        }
      })
  }, [applications])

  useEffect(() => {
    if (!selectedVisit) return
    setRescheduleDateTime(`${selectedVisit.date}T${selectedVisit.time}`)
  }, [selectedVisit])

  const upcomingVisits = siteVisits.filter((v) => v.status === "scheduled")
  const completedVisits = siteVisits.filter((v) => v.status === "completed")

  const handleCompleteVisit = async () => {
    if (!selectedVisit || !recommendation) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch("/api/officer/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedVisit.applicationId,
          status: recommendation,
          rejectionReason: recommendation === "rejected" ? visitNotes : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to update site visit status")
      }

      setApplications((prev) =>
        prev.map((app) => (app.id === selectedVisit.applicationId ? data.application : app)),
      )
      setShowCompleteDialog(false)
      setSelectedVisit(null)
      setVisitNotes("")
      setRecommendation(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update site visit status")
    } finally {
      setActionLoading(false)
    }
  }

  const openReschedule = (visit: typeof selectedVisit) => {
    if (!visit) return
    setRescheduleDateTime(`${visit.date}T${visit.time}`)
    setSelectedVisit(visit)
  }

  const handleReschedule = async () => {
    if (!selectedVisit || !rescheduleDateTime) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch("/api/officer/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedVisit.applicationId,
          status: "site_visit_scheduled",
          siteVisitDate: rescheduleDateTime,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to reschedule site visit")
      }
      setApplications((prev) =>
        prev.map((app) => (app.id === selectedVisit.applicationId ? data.application : app)),
      )
      setSelectedVisit(null)
      setRescheduleDateTime("")
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to reschedule site visit")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Site Visits</h1>
          <p className="text-muted-foreground">Manage scheduled site inspections and record findings</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold text-foreground">{upcomingVisits.length}</p>
                </div>
                <Calendar className="w-8 h-8 text-cyan-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{completedVisits.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold text-foreground">
                    {upcomingVisits.filter((v) => v.date === new Date().toISOString().split("T")[0]).length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcomingVisits.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedVisits.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Scheduled Visits</CardTitle>
                <CardDescription>Click on a visit to view details or mark as complete</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading site visits…</div>
                ) : upcomingVisits.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No upcoming site visits</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingVisits.map((visit) => (
                      <div
                        key={visit.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:border-cyan-500/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedVisit(visit)}
                      >
                        <div className="flex items-start gap-4 mb-4 sm:mb-0">
                          <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                            <Calendar className="w-6 h-6 text-cyan-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{visit.customerName}</p>
                            <p className="text-sm text-muted-foreground">{visit.applicationId}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <MapPin className="w-3 h-3" />
                              {visit.address}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              {new Date(visit.date).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">{visit.timeLabel}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-transparent"
                            onClick={(event) => {
                              event.stopPropagation()
                              openReschedule(visit)
                            }}
                          >
                            Reschedule
                          </Button>
                          <Button variant="outline" size="sm" className="bg-transparent" asChild>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                visit.address || "",
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center"
                            >
                              <Navigation className="w-4 h-4 mr-1" />
                              Directions
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Completed Visits</CardTitle>
                <CardDescription>View past site visit reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {completedVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border"
                    >
                      <div className="flex items-start gap-4 mb-4 sm:mb-0">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <CheckCircle className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{visit.customerName}</p>
                            <Badge
                              className={
                                visit.recommendation === "approved"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-red-500/10 text-red-600"
                              }
                              variant="secondary"
                            >
                              {visit.recommendation === "approved" ? (
                                <ThumbsUp className="w-3 h-3 mr-1" />
                              ) : (
                                <ThumbsDown className="w-3 h-3 mr-1" />
                              )}
                              {visit.recommendation === "approved" ? "Approved" : "Rejected"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{visit.applicationId}</p>
                          <p className="text-xs text-muted-foreground mt-1">{visit.notes}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Completed{" "}
                          {new Date(visit.completedAt!).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Visit Detail Dialog */}
        {selectedVisit && !showCompleteDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="text-foreground">Visit Details</CardTitle>
                <CardDescription>{selectedVisit.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <p className="font-medium text-foreground">{selectedVisit.customerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium text-foreground">{selectedVisit.phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground">{selectedVisit.address}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium text-foreground">{selectedVisit.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium text-foreground">{selectedVisit.timeLabel}</p>
                  </div>
                </div>
                {actionError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {actionError}
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Reschedule Visit</p>
                  <input
                    type="datetime-local"
                    value={rescheduleDateTime}
                    onChange={(e) => setRescheduleDateTime(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <Button
                    variant="outline"
                    className="bg-transparent"
                    onClick={handleReschedule}
                    disabled={!rescheduleDateTime || actionLoading}
                  >
                    {actionLoading ? "Saving..." : "Save new date"}
                  </Button>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground mb-2">Technical Details</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Roof Type</p>
                      <p className="text-foreground">{selectedVisit.technicalDetails?.roofType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Area</p>
                      <p className="text-foreground">{selectedVisit.technicalDetails?.roofArea}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Capacity</p>
                      <p className="text-foreground">{selectedVisit.technicalDetails?.desiredCapacity}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedVisit(null)} className="flex-1 bg-transparent">
                    Close
                  </Button>
                  <Button
                    onClick={() => setShowCompleteDialog(true)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Complete Visit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Complete Visit Dialog */}
        {showCompleteDialog && selectedVisit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <CardTitle className="text-foreground">Complete Site Visit</CardTitle>
                <CardDescription>Record your findings for {selectedVisit.customerName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {actionError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {actionError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Visit Notes</label>
                  <textarea
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    className="w-full h-32 p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Enter your observations about the site..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Recommendation</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setRecommendation("approved")}
                      className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                        recommendation === "approved"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-emerald-500/50"
                      }`}
                    >
                      <ThumbsUp
                        className={`w-6 h-6 mx-auto mb-2 ${
                          recommendation === "approved" ? "text-emerald-500" : "text-muted-foreground"
                        }`}
                      />
                      <p
                        className={`text-sm font-medium ${
                          recommendation === "approved" ? "text-emerald-500" : "text-foreground"
                        }`}
                      >
                        Approve
                      </p>
                    </button>
                    <button
                      onClick={() => setRecommendation("rejected")}
                      className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                        recommendation === "rejected"
                          ? "border-red-500 bg-red-500/10"
                          : "border-border hover:border-red-500/50"
                      }`}
                    >
                      <ThumbsDown
                        className={`w-6 h-6 mx-auto mb-2 ${
                          recommendation === "rejected" ? "text-red-500" : "text-muted-foreground"
                        }`}
                      />
                      <p
                        className={`text-sm font-medium ${
                          recommendation === "rejected" ? "text-red-500" : "text-foreground"
                        }`}
                      >
                        Reject
                      </p>
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCompleteDialog(false)
                      setVisitNotes("")
                      setRecommendation(null)
                    }}
                    className="flex-1 bg-transparent"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCompleteVisit}
                    disabled={!visitNotes || !recommendation || actionLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

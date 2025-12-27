"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Zap,
  Download,
  Building,
} from "lucide-react"
import { fetchApplication, type Application } from "@/lib/auth"

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending Review", color: "bg-amber-500/10 text-amber-600", icon: Clock },
  under_review: { label: "Under Review", color: "bg-blue-500/10 text-blue-600", icon: FileText },
  pre_visit_approved: {
    label: "Approved (Payment Pending)",
    color: "bg-emerald-500/10 text-emerald-600",
    icon: CheckCircle,
  },
  site_visit_scheduled: { label: "Site Visit Scheduled", color: "bg-cyan-500/10 text-cyan-600", icon: Calendar },
  approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle },
  site_visit_payment_completed: {
    label: "Site Visit Payment Completed",
    color: "bg-emerald-500/10 text-emerald-600",
    icon: CheckCircle,
  },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-600", icon: AlertCircle },
  payment_pending: { label: "Payment Pending", color: "bg-amber-500/10 text-amber-600", icon: Clock },
  payment_confirmed: { label: "Payment Confirmed", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle },
  finding_installer: { label: "Finding Installer", color: "bg-blue-500/10 text-blue-600", icon: FileText },
  installation_in_progress: { label: "Installation In Progress", color: "bg-cyan-500/10 text-cyan-600", icon: Zap },
  installation_complete: {
    label: "Installation Complete",
    color: "bg-emerald-500/10 text-emerald-600",
    icon: CheckCircle,
  },
  final_inspection: { label: "Final Inspection", color: "bg-blue-500/10 text-blue-600", icon: FileText },
  agreement_pending: { label: "Agreement Pending", color: "bg-amber-500/10 text-amber-600", icon: Clock },
  completed: { label: "Completed", color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle },
}

const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

export default function ApplicationDetail() {
  const params = useParams()
  const [application, setApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [previewDoc, setPreviewDoc] = useState<{
    url: string
    label: string
  } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const app = await fetchApplication(params.id as string)
        if (!app) {
          setError("Application not found")
        }
        setApplication(app)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load application")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id])


  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Loading application...
        </div>
      </DashboardLayout>
    )
  }

  if (!application) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
        </div>
      </DashboardLayout>
    )
  }

  const status = statusConfig[application.status] || statusConfig.pending
  const StatusIcon = status.icon

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/customer/applications">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {application.id}
              </h1>
              <Badge className={status.color} variant="secondary">
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created on {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Uploaded Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(application.documents).map(([key, doc]) => {
              if (!doc) return null
              const url = typeof doc === "string" ? doc : doc.url
              const label =
                typeof doc === "string"
                  ? key.replace(/([A-Z])/g, " $1").trim()
                  : doc.fileName
              const lowerLabel = label.toLowerCase()
              const isImage = imageExtensions.some((ext) => lowerLabel.endsWith(ext))
              return (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <p className="text-sm font-medium text-foreground capitalize">
                    {label}
                  </p>
                  {isImage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewDoc({ url, label })}
                    >
                      Preview
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={url} target="_blank" rel="noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {application.status === "pre_visit_approved" && !application.siteVisitFeePaid && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Site Visit Payment Required</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Your application is approved. Please pay the site visit fee to schedule the visit.
              </p>
              <Link href="/customer/invoices">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">Pay Site Visit Fee</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {(application.status === "site_visit_payment_completed" || application.siteVisitFeePaid) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Payment Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your site visit payment is complete. We will schedule your visit shortly.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              Application Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Full Name</p>
              <p className="text-foreground">{application.customerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="text-foreground">{application.email || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p className="text-foreground">{application.phone || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Address</p>
              <p className="text-foreground">{application.address || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Property Type</p>
              <p className="text-foreground">
                {application.technicalDetails?.propertyType || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Property Ownership</p>
              <p className="text-foreground">
                {application.technicalDetails?.propertyOwnership || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Tariff Category</p>
              <p className="text-foreground">
                {application.technicalDetails?.tariffCategory || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Electricity Account</p>
              <p className="text-foreground">
                {application.technicalDetails?.electricityAccountNumber || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Roof Type</p>
              <p className="text-foreground">
                {application.technicalDetails?.roofType || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Roof Area</p>
              <p className="text-foreground">
                {application.technicalDetails?.roofArea || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Roof Orientation</p>
              <p className="text-foreground">
                {application.technicalDetails?.roofOrientation || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Shading</p>
              <p className="text-foreground">
                {application.technicalDetails?.shading || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Monthly Consumption</p>
              <p className="text-foreground">
                {application.technicalDetails?.monthlyConsumption || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Connection Phase</p>
              <p className="text-foreground">
                {application.technicalDetails?.connectionPhase || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Desired Capacity</p>
              <p className="text-foreground">
                {application.technicalDetails?.desiredCapacity || "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Selected Installer */}
        {application.selectedInstaller && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-500" />
                Selected Installer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-semibold text-foreground">
                    {application.selectedInstaller.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {application.selectedInstaller.packageName}
                  </p>
                </div>
                {application.selectedInstaller.price && (
                  <p className="text-lg font-bold text-emerald-500">
                    Rs. {application.selectedInstaller.price.toLocaleString()}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>{previewDoc?.label}</DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <img
                src={previewDoc.url}
                alt={previewDoc.label}
                className="mx-auto max-h-[70vh] w-auto rounded-md object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

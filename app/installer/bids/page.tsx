"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Gavel, Clock, MapPin, Zap, ArrowRight, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { fetchCurrentUser, type BidSession, type Bid, type User } from "@/lib/auth"

export default function InstallerBids() {
  const [activeTab, setActiveTab] = useState("open")
  const [user, setUser] = useState<User | null>(null)
  const [sessions, setSessions] = useState<BidSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [previewBid, setPreviewBid] = useState<
    | (Bid & {
        sessionId: string
        capacity?: string
        address?: string
        customerPhone?: string
        customerEmail?: string
        selectedPackageName?: string
        selectedPackagePrice?: number
      })
    | null
  >(null)

  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((current) => {
        if (active) setUser(current)
      })
      .catch(() => {
        if (active) setUser(null)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 60)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchSessions = async () => {
      setError(null)
      try {
        const res = await fetch("/api/bids")
        if (!res.ok) throw new Error("Unable to load bids")
        const data = await res.json()
        setSessions(data.bidSessions || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unexpected error")
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const installerId = user?.organization?.id ?? user?.id ?? ""

  const openBids = useMemo(() => sessions.filter((session) => session.status === "open"), [sessions])

  const myBidsBySession = useMemo(() => {
    const map = new Map<string, Bid>()
    sessions.forEach((session) => {
      session.bids.forEach((bid) => {
        if (bid.installerId === installerId) {
          map.set(session.id, bid)
        }
      })
    })
    return map
  }, [installerId, sessions])

  const myBids: (Bid & {
    sessionId: string
    applicationId?: string
    capacity?: string
    address?: string
    customerPhone?: string
    customerEmail?: string
    selectedPackageName?: string
    selectedPackagePrice?: number
  })[] = useMemo(() => {
    const submissions: (Bid & {
      sessionId: string
      applicationId?: string
      capacity?: string
      address?: string
      customerPhone?: string
      customerEmail?: string
      selectedPackageName?: string
      selectedPackagePrice?: number
    })[] = []
    sessions.forEach((session) => {
      session.bids.forEach((bid) => {
        if (bid.installerId === installerId) {
          submissions.push({
            ...bid,
            sessionId: session.id,
            applicationId: session.applicationId,
            capacity: session.applicationDetails?.capacity,
            address: session.applicationDetails?.address,
            customerPhone: session.applicationDetails?.customerPhone,
            customerEmail: session.applicationDetails?.customerEmail,
            selectedPackageName: session.applicationDetails?.selectedPackageName,
            selectedPackagePrice: session.applicationDetails?.selectedPackagePrice,
          })
        }
      })
    })
    return submissions
  }, [installerId, sessions])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600" variant="secondary">
            <CheckCircle className="w-3 h-3 mr-1" />
            Accepted
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600" variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-600" variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Not Selected
          </Badge>
        )
      default:
        return null
    }
  }

  const countdown = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - now.getTime()
    if (diff <= 0) return "Expired"
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return days > 0 ? `${days}d ${remainingHours}h` : `${hours}h ${minutes}m`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bid Requests</h1>
          <p className="text-muted-foreground">View open bids and submit your proposals</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="open">Open Bids ({openBids.length})</TabsTrigger>
            <TabsTrigger value="my-bids">My Bids ({myBids.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4 space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading bids...
              </div>
            ) : error ? (
              <Card>
                <CardContent className="py-4 text-destructive">{error}</CardContent>
              </Card>
            ) : openBids.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gavel className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No open bids</h3>
                  <p className="text-muted-foreground">Check back later for new bid opportunities</p>
                </CardContent>
              </Card>
            ) : (
              openBids.map((bid) => {
                const existingBid = myBidsBySession.get(bid.id)
                return (
                <Card key={bid.id} className="hover:border-amber-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg text-foreground">{bid.applicationId}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <MapPin className="w-4 h-4" />
                              {bid.applicationDetails?.address ?? "Address not provided"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-amber-500">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{countdown(bid.expiresAt)}</span>
                          </div>
                        </div>

                        <p className="text-muted-foreground">{bid.requirements ?? "No additional requirements"}</p>

                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-sm">
                            <Zap className="w-3 h-3" />
                            {bid.applicationDetails?.capacity ?? "Capacity TBD"}
                          </div>
                          <div className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm capitalize">
                            {bid.bidType} bid
                          </div>
                          <div className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                            {new Date(bid.startedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex lg:flex-col gap-2 lg:items-end">
                        {existingBid ? (
                          <>
                            <div className="self-end">{getStatusBadge(existingBid.status)}</div>
                            <Link href={`/installer/bids/${bid.id}`} className="flex-1 lg:flex-none">
                              <Button variant="outline" className="w-full bg-transparent">
                                View Submitted Bid
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <>
                            <Link href={`/installer/bids/${bid.id}`} className="flex-1 lg:flex-none">
                              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                                Submit Bid
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </Link>
                            <Link href={`/installer/bids/${bid.id}`} className="flex-1 lg:flex-none">
                              <Button variant="outline" className="w-full bg-transparent">
                                View Details
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="my-bids" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Submitted Bids</CardTitle>
                <CardDescription>Track the status of your bid submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading bids...
                  </div>
                ) : myBids.length === 0 ? (
                  <div className="text-center py-8">
                    <Gavel className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">{"You haven't submitted any bids yet"}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myBids.map((bid) => (
                      <div
                        key={bid.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border"
                      >
                        <div className="mb-3 sm:mb-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground">{bid.sessionId}</p>
                            {getStatusBadge(bid.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {bid.address ?? "Location TBD"} • {bid.capacity ?? "Capacity TBD"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted: {new Date(bid.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Your Bid</p>
                            <p className="font-bold text-foreground">Rs. {bid.price.toLocaleString()}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-transparent"
                            onClick={() => setPreviewBid(bid)}
                          >
                            View Bid
                          </Button>
                          {bid.status === "accepted" && (
                            <Link href={`/installer/orders/${bid.applicationId ?? bid.sessionId}`}>
                              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                View Order
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!previewBid} onOpenChange={(open) => !open && setPreviewBid(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submitted Bid</DialogTitle>
            <DialogDescription>{previewBid?.sessionId}</DialogDescription>
          </DialogHeader>
          {previewBid && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(previewBid.status)}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Bid Amount</p>
                  <p className="text-lg font-bold text-foreground">
                    Rs. {previewBid.price.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="text-foreground">{previewBid.address ?? "Location TBD"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="text-foreground">{previewBid.capacity ?? "Capacity TBD"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer Package</span>
                  <span className="text-foreground">{previewBid.selectedPackageName ?? "Not selected"}</span>
                </div>
                {previewBid.selectedPackagePrice !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Package Price</span>
                    <span className="text-foreground">
                      Rs. {previewBid.selectedPackagePrice.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Warranty</span>
                  <span className="text-foreground">{previewBid.warranty ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated Days</span>
                  <span className="text-foreground">{previewBid.estimatedDays ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Customer Phone</span>
                  <span className="text-foreground">{previewBid.customerPhone ?? "Not provided"}</span>
                </div>
                {previewBid.customerEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Customer Email</span>
                    <span className="text-foreground">{previewBid.customerEmail}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="text-foreground">
                    {new Date(previewBid.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {previewBid.proposal && (
                <div className="rounded-lg border border-border p-3 text-sm">
                  <p className="text-muted-foreground mb-2">Proposal</p>
                  <p className="text-foreground whitespace-pre-wrap">{previewBid.proposal}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

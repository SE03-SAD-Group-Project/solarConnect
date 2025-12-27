"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Package, Plus, X } from "lucide-react"
import { fetchCurrentUser, fetchInstallers } from "@/lib/auth"

const commonFeatures = [
  "Free installation",
  "Net metering setup",
  "Monitoring system",
  "Battery backup option",
  "24/7 support",
  "Annual maintenance",
]

function parsePanelType(panelType: string) {
  const lower = panelType.toLowerCase()
  const candidates = ["monocrystalline", "polycrystalline", "thin_film"]
  const matched = candidates.find((value) => lower.includes(value)) ?? ""
  const brand = matched ? panelType.replace(new RegExp(matched, "i"), "").trim() : panelType
  return { panelType: matched, panelBrand: brand }
}

function parseWarrantyYears(warranty: string) {
  const match = warranty.match(/(\d+)/)
  return match?.[1] ?? ""
}

export default function EditPackage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const packageId = params.id
  const [loading, setLoading] = useState(false)
  const [loadingPackage, setLoadingPackage] = useState(true)
  const [error, setError] = useState("")
  const [customFeature, setCustomFeature] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    capacity: "",
    panelCount: "",
    panelType: "",
    panelBrand: "",
    inverterType: "",
    inverterBrand: "",
    warrantyYears: "",
    price: "",
    description: "",
    installationDays: "",
    features: [] as string[],
  })

  useEffect(() => {
    let active = true
    async function loadPackage() {
      try {
        const user = await fetchCurrentUser()
        const installers = await fetchInstallers(false)
        const installer = installers.find((inst) => inst.id === user?.organization?.id)
        const pkg = installer?.packages.find((item) => item.id === packageId)
        if (!pkg) {
          throw new Error("Package not found")
        }

        const parsedPanel = parsePanelType(pkg.panelType ?? "")
        const warrantyYears = parseWarrantyYears(pkg.warranty ?? "")

        if (!active) return
        setFormData((prev) => ({
          ...prev,
          name: pkg.name ?? "",
          capacity: pkg.capacity ?? "",
          panelCount: String(pkg.panelCount ?? ""),
          panelType: parsedPanel.panelType,
          panelBrand: parsedPanel.panelBrand,
          inverterBrand: pkg.inverterBrand ?? "",
          warrantyYears,
          price: String(pkg.price ?? ""),
          features: pkg.features ?? [],
        }))
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : "Unable to load package")
      } finally {
        if (!active) return
        setLoadingPackage(false)
      }
    }

    loadPackage()
    return () => {
      active = false
    }
  }, [packageId])

  const selectedFeatures = useMemo(() => new Set(formData.features), [formData.features])

  const handleFeatureToggle = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }))
  }

  const addCustomFeature = () => {
    if (customFeature.trim() && !formData.features.includes(customFeature.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, customFeature.trim()],
      }))
      setCustomFeature("")
    }
  }

  const removeFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const panelType = [formData.panelBrand, formData.panelType]
        .filter(Boolean)
        .join(" ")
        .trim()

      const warranty = formData.warrantyYears
        ? `${formData.warrantyYears} years`
        : "Standard warranty"

      const res = await fetch(`/api/installers/packages/${packageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          capacity: formData.capacity,
          panelCount: Number(formData.panelCount || 0),
          panelType: panelType || "Standard panels",
          inverterBrand: formData.inverterBrand || formData.inverterType || "Standard inverter",
          warranty,
          price: Number(formData.price || 0),
          features: formData.features,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Unable to update package")
      }

      router.push("/installer/packages?updated=true")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update package")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/installer/packages">
            <Button variant="ghost" size="icon" className="bg-transparent">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Package</h1>
            <p className="text-muted-foreground">Update your solar installation package details</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {loadingPackage ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Loading package...</CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  Package Information
                </CardTitle>
                <CardDescription>Basic details about your solar package</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Package Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Premium Solar Package"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">System Capacity</Label>
                    <Select
                      value={formData.capacity}
                      onValueChange={(value) => setFormData({ ...formData, capacity: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select capacity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 kW</SelectItem>
                        <SelectItem value="3">3 kW</SelectItem>
                        <SelectItem value="5">5 kW</SelectItem>
                        <SelectItem value="10">10 kW</SelectItem>
                        <SelectItem value="15">15 kW</SelectItem>
                        <SelectItem value="20">20 kW+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your package, its benefits, and what's included..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (LKR)</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="e.g., 450000"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installationDays">Installation Time (days)</Label>
                    <Input
                      id="installationDays"
                      type="number"
                      placeholder="e.g., 3"
                      value={formData.installationDays}
                      onChange={(e) => setFormData({ ...formData, installationDays: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Technical Specifications</CardTitle>
                <CardDescription>Details about the solar equipment included</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="panelCount">Number of Panels</Label>
                    <Input
                      id="panelCount"
                      type="number"
                      placeholder="e.g., 12"
                      value={formData.panelCount}
                      onChange={(e) => setFormData({ ...formData, panelCount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Panel Type</Label>
                    <Select
                      value={formData.panelType}
                      onValueChange={(value) => setFormData({ ...formData, panelType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monocrystalline">Monocrystalline</SelectItem>
                        <SelectItem value="polycrystalline">Polycrystalline</SelectItem>
                        <SelectItem value="thin_film">Thin Film</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="panelBrand">Panel Brand</Label>
                    <Input
                      id="panelBrand"
                      placeholder="e.g., JA Solar"
                      value={formData.panelBrand}
                      onChange={(e) => setFormData({ ...formData, panelBrand: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Inverter Type</Label>
                    <Select
                      value={formData.inverterType}
                      onValueChange={(value) => setFormData({ ...formData, inverterType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String Inverter</SelectItem>
                        <SelectItem value="micro">Microinverter</SelectItem>
                        <SelectItem value="hybrid">Hybrid Inverter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inverterBrand">Inverter Brand</Label>
                    <Input
                      id="inverterBrand"
                      placeholder="e.g., Huawei"
                      value={formData.inverterBrand}
                      onChange={(e) => setFormData({ ...formData, inverterBrand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warrantyYears">Warranty (years)</Label>
                    <Input
                      id="warrantyYears"
                      type="number"
                      placeholder="e.g., 10"
                      value={formData.warrantyYears}
                      onChange={(e) => setFormData({ ...formData, warrantyYears: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Package Features</CardTitle>
                <CardDescription>Select or add features included in this package</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {commonFeatures.map((feature) => (
                    <div key={feature} className="flex items-center space-x-2">
                      <Checkbox
                        id={feature}
                        checked={selectedFeatures.has(feature)}
                        onCheckedChange={() => handleFeatureToggle(feature)}
                      />
                      <label htmlFor={feature} className="text-sm text-foreground cursor-pointer">
                        {feature}
                      </label>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom feature..."
                    value={customFeature}
                    onChange={(e) => setCustomFeature(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomFeature())}
                  />
                  <Button type="button" variant="outline" onClick={addCustomFeature} className="bg-transparent">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {formData.features.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-sm"
                      >
                        {feature}
                        <button type="button" onClick={() => removeFeature(feature)} className="hover:text-amber-700">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Link href="/installer/packages">
                <Button variant="outline" className="bg-transparent">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ProfileUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  address?: string | null
  profileImageUrl?: string | null
  role: string
}

export function ProfileSettings() {
  const [user, setUser] = useState<ProfileUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [photoSaving, setPhotoSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const avatarPreview = useMemo(() => {
    if (!avatarFile) return null
    return URL.createObjectURL(avatarFile)
  }, [avatarFile])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" })
        if (!res.ok) throw new Error("Unable to load profile")
        const data = await res.json()
        if (!active) return
        setUser(data.user)
        setName(data.user.name ?? "")
        setEmail(data.user.email ?? "")
        setPhone(data.user.phone ?? "")
        setAddress(data.user.address ?? "")
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load profile")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const resetMessages = () => {
    setError(null)
    setSuccess(null)
  }

  async function handleSaveProfile() {
    resetMessages()
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, address }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to update profile")
      }
      setUser(data.user)
      setSuccess("Profile updated")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile")
    } finally {
      setSaving(false)
    }
  }

  async function handleUploadPhoto() {
    if (!avatarFile) return
    resetMessages()
    setPhotoSaving(true)
    try {
      const formData = new FormData()
      formData.append("avatar", avatarFile)
      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to upload photo")
      }
      setUser(data.user)
      setAvatarFile(null)
      setSuccess("Profile photo updated")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload photo")
    } finally {
      setPhotoSaving(false)
    }
  }

  async function handleChangePassword() {
    resetMessages()
    if (!currentPassword || !newPassword) {
      setError("Please enter your current and new password")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match")
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Unable to change password")
      }
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setSuccess("Password updated")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password")
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) {
    return <div className="py-10 text-muted-foreground">Loading profile…</div>
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/10 text-emerald-700 text-sm px-3 py-2">{success}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>Upload a new profile image</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={avatarPreview ?? user?.profileImageUrl ?? undefined} alt={user?.name ?? "Profile"} />
            <AvatarFallback>{user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              className="bg-transparent"
              disabled={!avatarFile || photoSaving}
              onClick={handleUploadPhoto}
            >
              {photoSaving ? "Uploading..." : "Upload photo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>Update your contact information</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 w-fit" onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use a strong password for your account</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 w-fit"
            onClick={handleChangePassword}
            disabled={passwordSaving}
          >
            {passwordSaving ? "Updating..." : "Update password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

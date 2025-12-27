"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ProfileSettings } from "@/components/profile-settings"

export default function CustomerSettingsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and security</p>
        </div>
        <ProfileSettings />
      </div>
    </DashboardLayout>
  )
}

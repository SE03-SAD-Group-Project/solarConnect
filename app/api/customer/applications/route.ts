import { NextResponse } from "next/server"

import { getDemoApplications } from "@/lib/data"

export async function GET() {
  const applications = getDemoApplications()
  return NextResponse.json({ applications })
}

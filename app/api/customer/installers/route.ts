import { NextResponse } from "next/server"

import { getVerifiedInstallers } from "@/lib/data"

export async function GET() {
  const installers = getVerifiedInstallers()
  return NextResponse.json({ installers })
}

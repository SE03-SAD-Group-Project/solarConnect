import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { currentUser } from "@/lib/services/auth"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "installer" || !user.organization) {
    return NextResponse.json(
      { error: "Only installers can update packages" },
      { status: 403 },
    )
  }

  const { id } = await context.params
  const existing = await prisma.installerPackage.findFirst({
    where: { id, organizationId: user.organization.id },
  })

  if (!existing) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 })
  }

  const body = await request.json()

  try {
    const updated = await prisma.installerPackage.update({
      where: { id },
      data: {
        name: body.name,
        capacity: body.capacity,
        panelCount: body.panelCount,
        panelType: body.panelType,
        inverterBrand: body.inverterBrand,
        warranty: body.warranty,
        price: body.price,
        features: body.features || [],
      },
    })

    return NextResponse.json({ package: updated })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update package"

    return NextResponse.json({ error: message }, { status: 400 })
  }
}

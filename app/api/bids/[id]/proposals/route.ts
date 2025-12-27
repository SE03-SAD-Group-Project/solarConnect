import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { currentUser } from "@/lib/services/auth"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "installer") {
    return NextResponse.json({ error: "Only installers can submit bids" }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const { price, proposal, warranty, estimatedDays, message } = body

  if (!price || !proposal || !warranty || !estimatedDays) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const session = await prisma.bidSession.findUnique({
    where: { id },
  })

  if (!session) {
    return NextResponse.json({ error: "Bid session not found" }, { status: 404 })
  }

  const bid = await prisma.bid.create({
    data: {
      applicationId: session.applicationId,
      bidSessionId: session.id,
      installerId: user.id,
      organizationId: user.organization?.id,
      price: Number(price),
      proposal: message ? `${proposal}\n\n${message}` : proposal,
      warranty,
      estimatedDays: Number(estimatedDays),
      status: "pending",
    },
  })

  return NextResponse.json({ bid }, { status: 201 })
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { currentUser } from "@/lib/services/auth"
import { sendBidAcceptedNotification } from "@/lib/notifications"

function mapBid(bid: any, applicationReference: string) {
  return {
    id: bid.id,
    applicationId: applicationReference,
    installerId: bid.organizationId || bid.installerId,
    installerName: bid.organization?.name || bid.installer?.name || "Installer",
    packageName: bid.package?.name,
    contact: {
      email: bid.installer?.email,
      phone: bid.installer?.phone || bid.organization?.phone,
    },
    installerRating: bid.organization?.rating,
    completedProjects: bid.organization?.completedInstallations,
    price: bid.price,
    proposal: bid.proposal,
    warranty: bid.warranty,
    estimatedDays: bid.estimatedDays,
    createdAt: bid.createdAt,
    status: bid.status,
  }
}

function mapSession(session: any) {
  const details = session.application?.technicalDetails || {}
  const acceptedBid = session.bids.find((bid: any) => bid.status === "accepted")
  const selectedPackage =
    session.selectedPackage ?? session.application?.selectedPackage ?? null
  return {
    id: session.id,
    applicationId: session.application.reference,
    customerId: session.customerId,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    status: session.status,
    bidType: session.bidType ?? "open",
    requirements: session.requirements ?? null,
    maxBudget: session.maxBudget ?? null,
    selectedBidId: acceptedBid?.id,
    applicationDetails: {
      address:
        details.siteAddress ||
        details.address ||
        session.application.customer?.address ||
        "Address not provided",
      capacity:
        details.desiredCapacity ||
        details.systemCapacity ||
        details.capacity ||
        "Capacity TBD",
      customerPhone: session.application.customer?.phone,
      customerEmail: session.application.customer?.email,
      selectedPackageName: selectedPackage?.name,
      selectedPackagePrice: selectedPackage?.price,
    },
    bids: session.bids.map((bid: any) =>
      mapBid(bid, session.application.reference),
    ),
  }
}

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const session = await prisma.bidSession.findUnique({
    where: { id },
    include: {
      application: { include: { customer: true, selectedPackage: true } },
      selectedPackage: true,
      bids: { include: { installer: true, organization: true, package: true } },
    },
  })

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (user.role === "customer" && session.customerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(mapSession(session))
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const action = body?.action as "accept" | "reject" | undefined

  if (action) {
    const bidId = body?.bidId as string | undefined
    if (!bidId) {
      return NextResponse.json({ error: "bidId is required" }, { status: 400 })
    }

    const session = await prisma.bidSession.findUnique({
      where: { id },
      include: {
        application: { include: { customer: true, selectedPackage: true } },
        selectedPackage: true,
        bids: { include: { installer: true, organization: true, package: true } },
      },
    })

    if (!session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    if (user.role === "customer" && session.customerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const selectedBid = session.bids.find((bid) => bid.id === bidId)
    if (!selectedBid) {
      return NextResponse.json({ error: "Bid not found" }, { status: 404 })
    }

    if (action === "accept") {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)

      let invoice
      try {
        invoice = await prisma.$transaction(async (tx) => {
          await tx.bid.update({
            where: { id: bidId },
            data: { status: "accepted" },
          })
          await tx.bid.updateMany({
            where: { bidSessionId: session.id, id: { not: bidId } },
            data: { status: "rejected" },
          })
          await tx.bidSession.update({
            where: { id: session.id },
            data: { status: "closed" },
          })
          await tx.application.update({
            where: { id: session.applicationId },
            data: {
              status: "payment_pending",
              installerOrganizationId: selectedBid.organizationId ?? null,
              selectedPackageId: selectedBid.packageId ?? null,
            },
          })
          return tx.invoice.create({
            data: {
              applicationId: session.applicationId,
              customerId: session.customerId,
              amount: selectedBid.price,
              description: "Installer payment",
              dueDate,
              status: "pending",
              type: "installation",
            },
          })
        })
      } catch (error) {
        console.error("[bids] accept failed", error)
        return NextResponse.json(
          { error: "Unable to accept bid. Please try again." },
          { status: 500 },
        )
      }

      if (selectedBid.installerId) {
        try {
          await sendBidAcceptedNotification(
            session.customerId,
            selectedBid.installerId,
            selectedBid.price,
          )
        } catch (error) {
          console.warn("[bids] notification failed", error)
        }
      }

      const refreshed = await prisma.bidSession.findUnique({
        where: { id: session.id },
        include: {
          application: { include: { customer: true, selectedPackage: true } },
          selectedPackage: true,
          bids: { include: { installer: true, organization: true, package: true } },
        },
      })

      return NextResponse.json({
        session: refreshed ? mapSession(refreshed) : mapSession(session),
        invoiceId: invoice?.id,
      })
    }

    if (action === "reject") {
      await prisma.bid.update({
        where: { id: bidId },
        data: { status: "rejected" },
      })
      const refreshed = await prisma.bidSession.findUnique({
        where: { id: session.id },
        include: {
          application: { include: { customer: true, selectedPackage: true } },
          selectedPackage: true,
          bids: { include: { installer: true, organization: true, package: true } },
        },
      })
      return NextResponse.json({
        session: refreshed ? mapSession(refreshed) : mapSession(session),
      })
    }
  }

  const bid = await prisma.bid.findUnique({
    where: { id },
    include: {
      application: true,
      installer: true,
      organization: true,
      package: true,
    },
  })

  if (!bid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (user.role === "customer" && bid.application.customerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.bid.update({
    where: { id },
    data: {
      status: body.status ?? bid.status,
    },
    include: {
      application: true,
      installer: true,
      organization: true,
      package: true,
    },
  })

  return NextResponse.json({
    bid: {
      id: updated.id,
      applicationId: updated.application.reference,
      installerId:
        updated.organizationId || updated.installerId || "",
      installerName:
        updated.organization?.name ||
        updated.installer?.name ||
        "Installer",
      price: updated.price,
      proposal: updated.proposal,
      warranty: updated.warranty,
      estimatedDays: updated.estimatedDays,
      createdAt: updated.createdAt,
      status: updated.status,
    },
  })
}

import { addHours } from "date-fns"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { currentUser } from "@/lib/services/auth"

function mapBid(bid: any, applicationReference: string) {
  return {
    id: bid.id,
    applicationId: applicationReference,
    installerId: bid.organizationId,
    installerName: bid.organization?.name || "Installer",
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

export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessions = await prisma.bidSession.findMany({
    where:
      user.role === "customer"
        ? { customerId: user.id }
        : user.role === "installer" && user.organization
        ? {
            OR: [
              { status: "open" },
              { bids: { some: { organizationId: user.organization.id } } },
            ],
          }
        : undefined,
    include: {
      application: { include: { customer: true, selectedPackage: true } },
      selectedPackage: true,
      bids: {
        include: {
          installer: true,
          organization: true,
          package: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  })

  return NextResponse.json({
    bidSessions: sessions.map(mapSession),
  })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const application = await prisma.application.findFirst({
    where: { reference: body.applicationId },
  })

  if (!application) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 },
    )
  }

  // Customer opens or extends a bid session
  if (user.role === "customer") {
    const existing = await prisma.bidSession.findFirst({
      where: { applicationId: application.id },
      include: {
        application: { include: { customer: true, selectedPackage: true } },
        selectedPackage: true,
        bids: {
          include: {
            installer: true,
            organization: true,
            package: true,
          },
        },
      },
    })

    const session = existing
      ? await prisma.bidSession.update({
          where: { id: existing.id },
          data: {
            status: "open",
            bidType: body.bidType ?? existing.bidType,
            requirements: body.requirements ?? existing.requirements,
            maxBudget: body.maxBudget ?? existing.maxBudget,
            selectedPackageId: body.selectedPackageId ?? existing.selectedPackageId,
            expiresAt: addHours(
              new Date(),
              Number(body.expiresInDays || 2) * 24,
            ),
          },
          include: {
            application: { include: { customer: true, selectedPackage: true } },
            selectedPackage: true,
            bids: {
              include: {
                installer: true,
                organization: true,
                package: true,
              },
            },
          },
        })
      : await prisma.bidSession.create({
          data: {
            applicationId: application.id,
            customerId: application.customerId,
            status: "open",
            bidType: body.bidType ?? "open",
            requirements: body.requirements ?? null,
            maxBudget: body.maxBudget ?? null,
            selectedPackageId: body.selectedPackageId ?? null,
            startedAt: new Date(),
            expiresAt: addHours(
              new Date(),
              Number(body.expiresInDays || 2) * 24,
            ),
          },
          include: {
            application: { include: { customer: true, selectedPackage: true } },
            selectedPackage: true,
            bids: {
              include: {
                installer: true,
                organization: true,
                package: true,
              },
            },
          },
        })

    return NextResponse.json(
      { bidSession: mapSession(session) },
      { status: 201 },
    )
  }

  // Installer submits a bid
  if (user.role !== "installer" || !user.organization) {
    return NextResponse.json(
      { error: "Only installers can submit bids" },
      { status: 403 },
    )
  }

  const session =
    (body.bidSessionId &&
      (await prisma.bidSession.findUnique({
        where: { id: body.bidSessionId },
        include: { application: true, selectedPackage: true },
      }))) ||
    (await prisma.bidSession.findFirst({
      where: { applicationId: application.id },
      include: { application: true, selectedPackage: true },
    })) ||
    (await prisma.bidSession.create({
      data: {
        applicationId: application.id,
        customerId: application.customerId,
        status: "open",
        bidType: body.bidType ?? "open",
        requirements: body.requirements ?? null,
        maxBudget: body.maxBudget ?? null,
        selectedPackageId: body.selectedPackageId ?? null,
        startedAt: new Date(),
        expiresAt: addHours(new Date(), 48),
      },
      include: { application: true, selectedPackage: true },
    }))

  const bid = await prisma.bid.create({
    data: {
      applicationId: application.id,
      bidSessionId: session.id,
      installerId: user.id,
      organizationId: user.organization.id,
      packageId: body.packageId,
      price: body.price,
      proposal: body.proposal || "Installer proposal",
      warranty: body.warranty || "Standard warranty",
      estimatedDays: body.estimatedDays || 7,
      status: "pending",
    },
    include: {
      installer: true,
      organization: true,
      package: true,
    },
  })

  return NextResponse.json(
    { bid: mapBid(bid, application.reference) },
    { status: 201 },
  )
}

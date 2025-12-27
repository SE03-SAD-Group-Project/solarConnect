import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { currentUser } from "@/lib/services/auth"
import { getFees } from "@/lib/fees"

function mapApplication(application: any) {
  const siteVisitInvoice = application.invoices?.find(
    (invoice: any) =>
      invoice.type === "authority_fee" &&
      invoice.description === "Site visit fee",
  )
  const siteVisitFeePaid = siteVisitInvoice?.status === "paid"
  const normalizedStatus =
    siteVisitFeePaid && application.status === "pre_visit_approved"
      ? "site_visit_payment_completed"
      : application.status

  return {
    id: application.reference,
    reference: application.reference,
    status: normalizedStatus,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    customerId: application.customerId,
    customerName: application.customer.name,
    email: application.customer.email,
    phone: application.customer.phone,
    address: application.customer.address,
    documents: application.documents,
    technicalDetails: application.technicalDetails,
    siteVisitDate: application.siteVisitDate,
    rejectionReason: application.rejectionReason,
    siteVisitFeePaid,
    selectedInstaller: application.installerOrganization
      ? {
          id: application.installerOrganization.id,
          name: application.installerOrganization.name,
          phone: application.installerOrganization.phone,
          address: application.installerOrganization.address,
          packageName: application.selectedPackage?.name,
          price: application.selectedPackage?.price,
        }
      : undefined,
    bidId: application.bids[0]?.id,
    invoices: application.invoices,
  }
}

export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const applications = await prisma.application.findMany({
    where:
      user.role === "customer"
        ? { customerId: user.id }
        : user.role === "installer" && user.organization
        ? { installerOrganizationId: user.organization.id }
        : undefined,
    include: {
      customer: true,
      installerOrganization: true,
      selectedPackage: true,
      bids: true,
      invoices: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    applications: applications.map(mapApplication),
  })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "customer") {
    return NextResponse.json(
      { error: "Only customers can create applications" },
      { status: 403 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const metaRaw = formData.get("meta")
  if (!metaRaw || typeof metaRaw !== "string") {
    return NextResponse.json({ error: "Missing application details" }, { status: 400 })
  }

  const meta = JSON.parse(metaRaw) as {
    siteAddress?: string
    systemCapacity?: string
    connectionPhase?: string
    technicalDetails?: Record<string, unknown>
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await fs.mkdir(uploadsDir, { recursive: true })

  async function persistFile(field: string) {
    const file = formData.get(field)
    if (!file || typeof file === "string") return undefined

    const arrayBuffer = await file.arrayBuffer()
    const ext = path.extname(file.name || "") || ".bin"
    const storedName = `${randomUUID()}${ext}`
    const storedPath = path.join(uploadsDir, storedName)
    await fs.writeFile(storedPath, Buffer.from(arrayBuffer))

    return {
      fileName: file.name,
      url: `/uploads/${storedName}`,
      uploadedAt: new Date().toISOString(),
    }
  }

  const documents = {
    nic: await persistFile("nicDocument"),
    bankDetails: await persistFile("bankDetails"),
    electricityBill: await persistFile("electricityBill"),
    propertyDocument: await persistFile("propertyDocument"),
  }
  const filteredDocuments = Object.fromEntries(
    Object.entries(documents).filter(([, value]) => value),
  )

  const reference = `APP-${randomUUID().slice(0, 8).toUpperCase()}`

  const paidFee = await prisma.invoice.findFirst({
    where: {
      customerId: user.id,
      type: "authority_fee",
      description: "Site visit fee",
      status: "paid",
    },
    orderBy: { createdAt: "desc" },
  })

  const mode = new URL(request.url).searchParams.get("mode")
  const include = {
    customer: true,
    installerOrganization: true,
    selectedPackage: true,
    bids: true,
    invoices: true,
  }

  const technicalDetails = {
    ...(meta.technicalDetails ?? {}),
    siteAddress: meta.siteAddress ?? undefined,
    systemCapacity: meta.systemCapacity ?? undefined,
    connectionPhase: meta.connectionPhase ?? undefined,
  } as Prisma.InputJsonValue

  const documentsPayload =
    Object.keys(filteredDocuments).length > 0
      ? (filteredDocuments as Prisma.InputJsonValue)
      : undefined

  if (!paidFee) {
    let pendingApp = await prisma.application.findFirst({
      where: { customerId: user.id, status: "pending", siteVisitDate: null },
      orderBy: { createdAt: "desc" },
      include,
    })

    if (pendingApp) {
      const updateData: Prisma.ApplicationUpdateInput = {
        technicalDetails,
        ...(documentsPayload ? { documents: documentsPayload } : {}),
      }
      pendingApp = await prisma.application.update({
        where: { id: pendingApp.id },
        data: updateData,
        include,
      })
    } else {
      pendingApp = await prisma.application.create({
        data: {
          reference,
          customerId: user.id,
          status: "pending",
          documents: documentsPayload ?? ({} as Prisma.InputJsonValue),
          technicalDetails,
        },
        include,
      })
    }

    if (mode === "fee") {
      const fees = await getFees()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      const invoice = await prisma.invoice.create({
        data: {
          applicationId: pendingApp.id,
          customerId: user.id,
          amount: fees.siteVisitFee,
          description: "Site visit fee",
          dueDate,
          status: "pending",
          type: "authority_fee",
        },
      })

      return NextResponse.json(
        {
          error: "Payment required",
          invoiceId: invoice.id,
          applicationId: pendingApp.reference,
          paymentRequired: true,
        },
        { status: 402 },
      )
    }

    return NextResponse.json(
      {
        application: mapApplication(pendingApp),
        paymentRequired: false,
      },
      { status: 201 },
    )
  }

  const application = await prisma.application.create({
    data: {
      reference,
      customerId: user.id,
      status: "pending",
      documents: documentsPayload ?? ({} as Prisma.InputJsonValue),
      technicalDetails,
    },
    include,
  })

  return NextResponse.json({ application: mapApplication(application) }, { status: 201 })
}

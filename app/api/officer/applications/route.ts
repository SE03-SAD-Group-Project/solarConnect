import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { currentUser } from "@/lib/services/auth"
import { getFees } from "@/lib/fees"
import {
  sendApplicationDecisionNotification,
  sendPreVisitApprovalNotification,
  sendSiteVisitScheduledNotification,
} from "@/lib/notifications"
import { ApplicationStatus } from "@prisma/client"

function mapApplication(application: any) {
  const siteVisitInvoice = application.invoices?.find(
    (invoice: any) =>
      invoice.type === "authority_fee" &&
      invoice.description === "Site visit fee",
  )

  return {
    id: application.reference,
    reference: application.reference,
    status: application.status,
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
    siteVisitFeePaid: siteVisitInvoice?.status === "paid",
  }
}

export async function GET() {
  const user = await currentUser()
  if (!user || user.role !== "officer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const applications = await prisma.application.findMany({
    include: {
      customer: true,
      invoices: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ applications: applications.map(mapApplication) })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user || user.role !== "officer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const { applicationId, status, rejectionReason, siteVisitDate } = body || {}

  if (!applicationId || !status) {
    return NextResponse.json({ error: "applicationId and status are required" }, { status: 400 })
  }

  if (!Object.values(ApplicationStatus).includes(status)) {
    return NextResponse.json(
      { error: `Invalid status: ${status}` },
      { status: 400 },
    )
  }

  const application = await prisma.application.findFirst({
    where: { reference: applicationId },
    include: { customer: true, invoices: true },
  })

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  if (status === "approved" && application.status !== "site_visit_scheduled") {
    return NextResponse.json(
      { error: "Site visit must be completed before final approval." },
      { status: 400 },
    )
  }

  if (status === "site_visit_scheduled") {
    if (
      application.status !== "site_visit_payment_completed" &&
      application.status !== "site_visit_scheduled"
    ) {
      return NextResponse.json(
        { error: "Site visit payment must be completed before scheduling." },
        { status: 400 },
      )
    }
    const fees = await getFees()
    if (fees.siteVisitFee > 0) {
      const paidFee = await prisma.invoice.findFirst({
        where: {
          applicationId: application.id,
          type: "authority_fee",
          description: "Site visit fee",
          status: "paid",
        },
      })
      if (!paidFee) {
        return NextResponse.json(
          { error: "Site visit fee must be paid before scheduling." },
          { status: 400 },
        )
      }
    }
  }

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      status,
      rejectionReason: rejectionReason ?? application.rejectionReason,
      siteVisitDate: siteVisitDate ? new Date(siteVisitDate) : application.siteVisitDate,
    },
    include: { customer: true, invoices: true },
  })

  if (status === "pre_visit_approved") {
    const fees = await getFees()
    if (fees.siteVisitFee > 0) {
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          applicationId: application.id,
          type: "authority_fee",
          description: "Site visit fee",
        },
        orderBy: { createdAt: "desc" },
      })

      if (!existingInvoice) {
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + 7)
        await prisma.invoice.create({
          data: {
            applicationId: application.id,
            customerId: application.customerId,
            amount: fees.siteVisitFee,
            description: "Site visit fee",
            dueDate,
            status: "pending",
            type: "authority_fee",
          },
        })
      }
    }
  }

  if (status === "site_visit_scheduled" && updated.siteVisitDate) {
    await sendSiteVisitScheduledNotification(
      updated.customerId,
      updated.siteVisitDate,
      updated.customer.address ?? null,
    )
  }

  if (status === "pre_visit_approved") {
    await sendPreVisitApprovalNotification(updated.customerId)
  }

  if (status === "approved" || status === "rejected") {
    await sendApplicationDecisionNotification(
      updated.customerId,
      status,
      updated.rejectionReason ?? null,
    )
  }

  return NextResponse.json({ application: mapApplication(updated) })
}

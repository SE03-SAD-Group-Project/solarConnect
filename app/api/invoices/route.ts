import { NextRequest, NextResponse } from "next/server"
import { UserRole, InvoiceType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getSessionUser, requireRole } from "@/lib/auth-server"
import { buildReportPdf, writePdfToPublic } from "@/lib/pdf"

export const dynamic = "force-dynamic"

/* ------------------------------------------------------------------ */
/* GET /api/payments                                                   */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const includeMonthly = searchParams.get("includeMonthly") === "true"

  let invoices = []

  if (user.role === UserRole.customer) {
    invoices = await prisma.invoice.findMany({
      where: { customerId: user.id },
    })
  } else if (user.role === UserRole.installer) {
    if (!user.organizationId) {
      return NextResponse.json({ invoices: [], monthlyBills: [] })
    }
    invoices = await prisma.invoice.findMany({
      where: { application: { installerOrganizationId: user.organizationId } },
      include: { application: true },
    })
  } else {
    const forbidden = requireRole(user.role, [UserRole.officer])
    if (forbidden) return forbidden

    invoices = await prisma.invoice.findMany({
      include: { application: true },
    })
  }

  const monthlyBills: any[] = includeMonthly ? [] : []

  return NextResponse.json({ invoices, monthlyBills })
}

/* ------------------------------------------------------------------ */
/* POST /api/payments                                                  */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const forbidden = requireRole(user.role, [UserRole.officer])
  if (forbidden) return forbidden

  const body = await req.json()
  const {
    applicationId,
    customerId,
    type,
    amount,
    dueDate,
    description,
  }: {
    applicationId?: string | null
    customerId?: string
    type?: InvoiceType
    amount?: number
    dueDate?: string
    description?: string
  } = body

  if (!applicationId || !type || !amount || !dueDate || !description) {
    return NextResponse.json(
      { error: "applicationId, type, amount, dueDate, and description are required" },
      { status: 400 },
    )
  }

  const application = await prisma.application.findFirst({
    where: { OR: [{ id: applicationId }, { reference: applicationId }] },
  })

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  const resolvedCustomerId = customerId ?? application.customerId

  const invoice = await prisma.invoice.create({
    data: {
      applicationId: application.id,
      customerId: resolvedCustomerId,
      type,
      amount,
      description,
      status: "pending",
      dueDate: new Date(dueDate),
      paidAt: null,
    },
  })

  const pdfBuffer = buildReportPdf({
    title: "SolarConnect Invoice",
    subtitle: `Invoice ${invoice.id}`,
    sections: [
      {
        title: "Invoice Details",
        lines: [
          { label: "Application", value: application.reference },
          { label: "Type", value: type.replace("_", " ") },
          { label: "Description", value: description },
          { label: "Amount", value: `LKR ${Number(amount).toLocaleString()}` },
          { label: "Status", value: "pending" },
          { label: "Due Date", value: new Date(dueDate).toLocaleDateString() },
        ],
      },
    ],
    footer: "SolarConnect - Generated electronically.",
  })
  const pdfUrl = await writePdfToPublic({
    filename: `invoice-${invoice.id}.pdf`,
    buffer: pdfBuffer,
  })

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl },
  })

  return NextResponse.json({ invoice: updated }, { status: 201 })
}

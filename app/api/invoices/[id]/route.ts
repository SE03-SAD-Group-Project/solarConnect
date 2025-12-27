import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { application: { select: { status: true } } },
  })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const payments: unknown[] = []
  let monthlyBill: {
    month: number
    year: number
    kwhGenerated: number
    kwhExported: number
    kwhImported: number
  } | null = null

  if (invoice.type === "monthly_bill") {
    const month = invoice.dueDate.getMonth() + 1
    const year = invoice.dueDate.getFullYear()
    const reading = await prisma.meterReading.findFirst({
      where: { applicationId: invoice.applicationId, month, year },
    })
    monthlyBill = {
      month,
      year,
      kwhGenerated: reading?.kwhGenerated ?? 0,
      kwhExported: reading?.kwhExported ?? 0,
      kwhImported: reading?.kwhImported ?? 0,
    }
  }

  return NextResponse.json({
    invoice: { ...invoice, pdfUrl: invoice.pdfUrl ?? `/api/invoices/${invoice.id}/pdf` },
    payments,
    monthlyBill,
  })
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const body = await req.json()
  const { status, paidAt } = body as { status?: string; paidAt?: string }
  const nextStatus =
    status && ["pending", "paid", "overdue"].includes(status)
      ? (status as InvoiceStatus)
      : invoice.status

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: nextStatus,
      paidAt: paidAt ?? invoice.paidAt,
    },
  })

  return NextResponse.json({ invoice: updated })
}

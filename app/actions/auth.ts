"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { UserRole } from "@prisma/client"
import { randomUUID } from "crypto"
import { SignJWT } from "jose"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/auth-server"

const SESSION_COOKIE = "session_token"
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("Missing JWT_SECRET")
  }
  return new TextEncoder().encode(secret)
}

export async function loginAction(_: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const redirectTo = (formData.get("redirect") as string) || "/"

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { error: "Invalid credentials" }
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return { error: "Invalid credentials" }
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  })

  const jwt = await new SignJWT({ token, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })

  cookieStore.set("last_login_email", email, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  })

  const roleRedirect =
    user.role === "officer"
      ? "/officer/dashboard"
      : user.role === "installer"
      ? "/installer/dashboard"
      : "/customer/dashboard"

  const finalRedirect =
    redirectTo === "/" || redirectTo === "/customer/dashboard"
      ? roleRedirect
      : redirectTo

  redirect(finalRedirect)
}

export async function registerAction(_: unknown, formData: FormData) {
  const role = (formData.get("role") as string) || "customer"
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" }
  }

  if (!Object.values(UserRole).includes(role as UserRole)) {
    return { error: "Invalid role" }
  }

  const email = formData.get("email") as string
  const name = formData.get("name") as string

  if (!email || !name || !password) {
    return { error: "Missing required fields" }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { error: "Email already registered" }
  }

  const passwordHash = await hashPassword(password)

  let organizationId: string | undefined

  if (role === "installer") {
    const org = await prisma.organization.create({
      data: {
        name:
          (formData.get("companyName") as string) || name,
        registrationNumber: formData.get(
          "registrationNumber",
        ) as string,
        description: formData.get("description") as string,
        phone: formData.get("phone") as string,
        address: formData.get("address") as string,
        verified: false,
      },
    })

    organizationId = org.id
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role as UserRole,
      phone: formData.get("phone") as string,
      address: formData.get("address") as string,
      organizationId,
      verified: role !== "installer",
    },
  })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  })

  const jwt = await new SignJWT({ token, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  })

  redirect(
    role === "installer"
      ? "/installer/dashboard"
      : "/customer/dashboard",
  )
}

// src/app/api/employees/[id]/access/route.ts
// Allows admins to grant/revoke login access for employees via ACOMS.Auth

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

// POST — Grant login access to an employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, identityId: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  if (employee.identityId) {
    return NextResponse.json({ error: "Employee already has login access" }, { status: 409 });
  }

  const body = await request.json();
  const { email, password, role } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  // Call ACOMS.Auth service API to create the identity
  const authResponse = await fetch(
    `${process.env.ACOMS_AUTH_URL}/api/admin/identities`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({
        email,
        name: `${employee.firstName} ${employee.lastName}`,
        password,
        portalRoles: [
          { clientId: process.env.ACOMS_AUTH_CLIENT_ID, role: role || "STAFF" },
        ],
      }),
    }
  );

  if (!authResponse.ok) {
    const error = await authResponse.json();
    return NextResponse.json(
      { error: error.error || "Failed to create identity" },
      { status: authResponse.status }
    );
  }

  const identity = await authResponse.json();

  // Link the identity to the employee in ACOMS.OS database
  await prisma.employee.update({
    where: { id },
    data: { identityId: identity.id },
  });

  return NextResponse.json(
    { identityId: identity.id, email },
    { status: 201 }
  );
}

// DELETE — Revoke login access for an employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { identityId: true },
  });

  if (!employee?.identityId) {
    return NextResponse.json({ error: "No access to revoke" }, { status: 404 });
  }

  // Deactivate in ACOMS.Auth
  await fetch(
    `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${employee.identityId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ isActive: false }),
    }
  );

  return NextResponse.json({ success: true });
}

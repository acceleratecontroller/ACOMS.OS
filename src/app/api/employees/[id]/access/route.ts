// src/app/api/employees/[id]/access/route.ts
// Allows admins to grant/revoke/manage login access for employees via ACOMS.Auth

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/shared/auth/auth";
import { prisma } from "@/shared/database/client";

// GET — Fetch the identity's portal roles from ACOMS.Auth
export async function GET(
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
    return NextResponse.json({ roles: [] });
  }

  try {
    const response = await fetch(
      `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${employee.identityId}/roles`,
      {
        headers: {
          Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ roles: [] });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ roles: [] });
  }
}

// POST — Grant login access to an employee (create identity + assign portal roles)
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
  const { email, password, portalRoles } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  if (!portalRoles || portalRoles.length === 0) {
    return NextResponse.json({ error: "At least one portal must be selected" }, { status: 400 });
  }

  // Call ACOMS.Auth service API to create the identity with portal roles
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
        portalRoles,
      }),
    }
  );

  let identityId: string;

  if (authResponse.status === 409) {
    // Identity already exists — reactivate it, update password, and assign roles
    const data = await authResponse.json();
    const existingId = data.existingIdentity?.id;
    if (!existingId) {
      return NextResponse.json({ error: "Identity exists but could not retrieve ID" }, { status: 500 });
    }

    // Reactivate and update password
    const reactivateRes = await fetch(
      `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${existingId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
        },
        body: JSON.stringify({ isActive: true, password }),
      }
    );

    if (!reactivateRes.ok) {
      const err = await reactivateRes.json();
      return NextResponse.json(
        { error: err.error || "Failed to reactivate identity" },
        { status: reactivateRes.status }
      );
    }

    // Assign portal roles
    for (const pr of portalRoles) {
      await fetch(
        `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${existingId}/roles`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
          },
          body: JSON.stringify({ clientId: pr.clientId, role: pr.role }),
        }
      );
    }

    identityId = existingId;
  } else if (!authResponse.ok) {
    const error = await authResponse.json();
    return NextResponse.json(
      { error: `[v2] ${error.error || "Failed to create identity"}` },
      { status: authResponse.status }
    );
  } else {
    const identity = await authResponse.json();
    identityId = identity.id;
  }

  // Link the identity to the employee in ACOMS.OS database
  await prisma.employee.update({
    where: { id },
    data: { identityId },
  });

  return NextResponse.json(
    { identityId, email },
    { status: 201 }
  );
}

// PUT — Update portal roles for an existing identity
export async function PUT(
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
    return NextResponse.json({ error: "Employee does not have login access" }, { status: 404 });
  }

  const body = await request.json();
  const { portalRoles } = body as { portalRoles: { clientId: string; role: string }[] };

  if (!portalRoles) {
    return NextResponse.json({ error: "portalRoles is required" }, { status: 400 });
  }

  // Get current roles from Auth
  const currentRes = await fetch(
    `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${employee.identityId}/roles`,
    {
      headers: {
        Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
      },
    }
  );

  const currentData = currentRes.ok ? await currentRes.json() : { roles: [] };
  const currentRoles: { clientId: string; role: string }[] = currentData.roles || [];

  // Determine roles to add/update and roles to remove
  const desiredClientIds = new Set(portalRoles.map((pr) => pr.clientId));
  const currentClientIds = new Set(currentRoles.map((r) => r.clientId));

  // Add or update roles
  for (const pr of portalRoles) {
    await fetch(
      `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${employee.identityId}/roles`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
        },
        body: JSON.stringify({ clientId: pr.clientId, role: pr.role }),
      }
    );
  }

  // Remove roles that are no longer selected
  for (const clientId of currentClientIds) {
    if (!desiredClientIds.has(clientId)) {
      await fetch(
        `${process.env.ACOMS_AUTH_URL}/api/admin/identities/${employee.identityId}/roles?clientId=${clientId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.ACOMS_AUTH_SERVICE_TOKEN}`,
          },
        }
      );
    }
  }

  return NextResponse.json({ success: true });
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

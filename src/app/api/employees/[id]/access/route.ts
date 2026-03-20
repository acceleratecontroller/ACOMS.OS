import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";
import { audit } from "@/shared/audit/log";
import { withPrismaError } from "@/shared/api/helpers";

// GET /api/employees/[id]/access — Check if employee has login access
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      userId: true,
      user: { select: { id: true, email: true, role: true, isActive: true } },
    },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json({ access: employee.user ?? null });
}

// POST /api/employees/[id]/access — Grant login access to an employee
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
    select: { id: true, firstName: true, lastName: true, employeeNumber: true, userId: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (employee.userId) {
    return NextResponse.json({ error: "Employee already has login access" }, { status: 409 });
  }

  let body: { email?: string; password?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, password, role } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const validRole = role === "ADMIN" ? "ADMIN" : "STAFF";

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hash(password, 12);

  const { result: user, error } = await withPrismaError("Failed to create user", () =>
    prisma.user.create({
      data: {
        email,
        passwordHash,
        name: `${employee.firstName} ${employee.lastName}`,
        role: validRole,
        isActive: true,
      },
    }),
  );
  if (error) return error;

  await prisma.employee.update({
    where: { id },
    data: { userId: user.id },
  });

  audit({
    entityType: "Employee",
    entityId: id,
    action: "UPDATE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.id,
    changes: { loginAccess: { from: null, to: email } },
  });

  return NextResponse.json(
    { id: user.id, email: user.email, role: user.role, isActive: user.isActive },
    { status: 201 },
  );
}

// PUT /api/employees/[id]/access — Update login access (role, password, active status)
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
    select: { userId: true, firstName: true, lastName: true, employeeNumber: true },
  });

  if (!employee || !employee.userId) {
    return NextResponse.json({ error: "Employee does not have login access" }, { status: 404 });
  }

  let body: { role?: string; password?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: {
    role?: "ADMIN" | "STAFF";
    passwordHash?: string;
    isActive?: boolean;
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string | null;
    twoFactorPending?: boolean;
  } = {};

  if (body.role !== undefined) {
    updateData.role = body.role === "ADMIN" ? "ADMIN" : "STAFF";
  }

  if (body.password !== undefined) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    updateData.passwordHash = await hash(body.password, 12);
  }

  if (body.isActive !== undefined) {
    updateData.isActive = body.isActive;
    // When reinstating a user, clear 2FA so they must set it up fresh
    if (body.isActive === true) {
      updateData.twoFactorEnabled = false;
      updateData.twoFactorSecret = null;
      updateData.twoFactorPending = false;
    }
  }

  const { result: user, error } = await withPrismaError("Failed to update user", () =>
    prisma.user.update({
      where: { id: employee.userId! },
      data: updateData,
    }),
  );
  if (error) return error;

  // When reinstating, also delete backup codes so 2FA starts fresh
  if (body.isActive === true) {
    await prisma.backupCode.deleteMany({
      where: { userId: employee.userId! },
    });
  }

  audit({
    entityType: "Employee",
    entityId: id,
    action: "UPDATE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.id,
    changes: {
      ...(body.role !== undefined && { loginRole: { from: null, to: body.role } }),
      ...(body.isActive !== undefined && { loginActive: { from: null, to: body.isActive } }),
      ...(body.password !== undefined && { loginPassword: { from: null, to: "(changed)" } }),
    },
  });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role, isActive: user.isActive });
}

// DELETE /api/employees/[id]/access — Revoke login access (deactivate user)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { userId: true, firstName: true, lastName: true, employeeNumber: true },
  });

  if (!employee || !employee.userId) {
    return NextResponse.json({ error: "Employee does not have login access" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: employee.userId },
    data: {
      isActive: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPending: false,
      twoFactorVerifiedAt: null,
    },
  });

  // Delete all backup codes for this user
  await prisma.backupCode.deleteMany({
    where: { userId: employee.userId },
  });

  audit({
    entityType: "Employee",
    entityId: id,
    action: "UPDATE",
    entityLabel: `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`,
    performedById: session.user.id,
    changes: { loginAccess: { from: "active", to: "revoked" } },
  });

  return NextResponse.json({ success: true });
}

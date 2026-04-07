import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";
import { auth } from "@/shared/auth/auth";

// GET /api/search?q=searchterm — Search across employees, assets, and plant (admin only)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const term = q.toLowerCase();
  const archived = request.nextUrl.searchParams.get("archived") === "true";
  const isAdmin = session.user.role === "ADMIN";

  // STAFF: restrict employee search to own record only
  const employeePromise = isAdmin
    ? prisma.employee.findMany({
        where: {
          isArchived: archived,
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { employeeNumber: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            { phone: { contains: term, mode: "insensitive" } },
          ],
        },
        take: 5,
        orderBy: { firstName: "asc" },
      })
    : session.user.employeeId
      ? prisma.employee.findMany({
          where: {
            id: session.user.employeeId,
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { employeeNumber: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
          take: 1,
        })
      : Promise.resolve([]);

  const [employees, assets, plant] = await Promise.all([
    employeePromise,
    prisma.asset.findMany({
      where: {
        isArchived: archived,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { assetNumber: { contains: term, mode: "insensitive" } },
          { category: { contains: term, mode: "insensitive" } },
          { make: { contains: term, mode: "insensitive" } },
          { model: { contains: term, mode: "insensitive" } },
          { serialNumber: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { name: "asc" },
    }),
    prisma.plant.findMany({
      where: {
        isArchived: archived,
        OR: [
          { plantNumber: { contains: term, mode: "insensitive" } },
          { category: { contains: term, mode: "insensitive" } },
          { make: { contains: term, mode: "insensitive" } },
          { model: { contains: term, mode: "insensitive" } },
          { registrationNumber: { contains: term, mode: "insensitive" } },
          { vinNumber: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { plantNumber: "asc" },
    }),
  ]);

  const results = [
    ...employees.map((e) => ({
      id: e.id,
      type: "employee" as const,
      title: `${e.firstName} ${e.lastName}`,
      subtitle: e.employeeNumber,
      href: `/employees?open=${e.id}`,
    })),
    ...assets.map((a) => ({
      id: a.id,
      type: "asset" as const,
      title: a.name,
      subtitle: a.assetNumber,
      href: `/assets?open=${a.id}`,
    })),
    ...plant.map((p) => ({
      id: p.id,
      type: "plant" as const,
      title: p.plantNumber,
      subtitle: [p.make, p.model].filter(Boolean).join(" ") || p.category,
      href: `/plant?open=${p.id}`,
    })),
  ];

  return NextResponse.json(results);
}

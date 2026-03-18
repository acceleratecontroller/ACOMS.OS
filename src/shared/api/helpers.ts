import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/database/client";

/**
 * Safely parse JSON from a request body.
 * Returns { data, error } — if error is set, return it as the response.
 */
export async function parseBody<T = unknown>(
  request: NextRequest,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const data = await request.json();
    return { data: data as T };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      ),
    };
  }
}

/**
 * Validate that a referenced employee ID exists.
 * Returns null if valid or not provided, or a NextResponse error.
 */
export async function validateEmployeeRef(
  id: string | null | undefined,
  fieldName: string,
): Promise<NextResponse | null> {
  if (!id) return null;
  const exists = await prisma.employee.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json(
      { error: `${fieldName} references a non-existent employee` },
      { status: 400 },
    );
  }
  return null;
}

/**
 * Wrap a Prisma operation with consistent error handling.
 * Returns the result or a formatted error response.
 */
export async function withPrismaError<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; error?: never } | { result?: never; error: NextResponse }> {
  try {
    const result = await fn();
    return { result };
  } catch (err) {
    console.error(`${label}:`, err);
    const message = err instanceof Error ? err.message : "Unknown error";

    // Handle Prisma-specific errors
    if (typeof err === "object" && err !== null && "code" in err) {
      const prismaErr = err as { code: string };
      if (prismaErr.code === "P2025") {
        return {
          error: NextResponse.json(
            { error: "Record not found" },
            { status: 404 },
          ),
        };
      }
      if (prismaErr.code === "P2003") {
        return {
          error: NextResponse.json(
            { error: "Referenced record does not exist" },
            { status: 400 },
          ),
        };
      }
      if (prismaErr.code === "P2002") {
        return {
          error: NextResponse.json(
            { error: "A record with that unique value already exists" },
            { status: 409 },
          ),
        };
      }
    }

    return {
      error: NextResponse.json(
        { error: `${label}: ${message}` },
        { status: 500 },
      ),
    };
  }
}

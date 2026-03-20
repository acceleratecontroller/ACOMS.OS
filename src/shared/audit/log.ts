import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/database/client";

type AuditAction = "CREATE" | "UPDATE" | "ARCHIVE" | "RESTORE" | "DELETE";

interface AuditEntry {
  entityType: string;
  entityId: string;
  action: AuditAction;
  entityLabel: string;
  performedById: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

/**
 * Log an audit entry for a create, update, archive, or restore action.
 * Runs fire-and-forget so it never blocks the API response.
 */
export function audit(entry: AuditEntry) {
  prisma.auditLog
    .create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        entityLabel: entry.entityLabel,
        changes: entry.changes ? (entry.changes as Prisma.InputJsonValue) : Prisma.JsonNull,
        performedById: entry.performedById,
      },
    })
    .catch((err) => {
      console.error("[audit] Failed to write audit log:", err);
    });
}

/**
 * Compare two records and return only the fields that changed.
 * Skips internal fields like updatedAt.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  skip: string[] = ["updatedAt", "archivedAt", "archivedById", "isArchived"],
): Record<string, { from: unknown; to: unknown }> | null {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const key of Object.keys(after)) {
    if (skip.includes(key)) continue;
    const oldVal = before[key];
    const newVal = after[key];

    // Normalise dates and Decimals to strings for comparison
    const a = normalise(oldVal);
    const b = normalise(newVal);

    if (a !== b) {
      changes[key] = { from: oldVal, to: newVal };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

function normalise(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null && "toFixed" in v) return String(v); // Decimal
  return String(v);
}

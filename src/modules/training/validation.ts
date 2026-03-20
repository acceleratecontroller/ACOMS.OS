import { z } from "zod/v4";

const optionalString = z.string().optional().or(z.literal("")).or(z.null());

// ─── Roles ──────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: optionalString,
  category: z.enum(["OFFICE", "FIELD"]),
});

export const updateRoleSchema = createRoleSchema.partial();

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ─── Skills ─────────────────────────────────────────────

export const createSkillSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: optionalString,
});

export const updateSkillSchema = createSkillSchema.partial();

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;

// ─── Accreditations ─────────────────────────────────────

export const createAccreditationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: optionalString,
  description: optionalString,
  expires: z.boolean().default(false),
  renewalMonths: z.number().int().positive().optional().or(z.null()),
  renewalNotes: optionalString,
});

export const updateAccreditationSchema = createAccreditationSchema.partial();

export type CreateAccreditationInput = z.infer<typeof createAccreditationSchema>;
export type UpdateAccreditationInput = z.infer<typeof updateAccreditationSchema>;

// ─── Employee Accreditation Assignment ──────────────────

export const assignEmployeeAccreditationSchema = z.object({
  accreditationId: z.string().min(1, "Accreditation is required"),
  status: z.enum(["PENDING", "VERIFIED", "EXPIRED", "EXEMPT"]).default("PENDING"),
  issueDate: optionalString,
  expiryDate: optionalString,
  certificateNumber: optionalString,
  notes: optionalString,
  evidenceNotes: optionalString,
});

export const updateEmployeeAccreditationSchema = assignEmployeeAccreditationSchema
  .omit({ accreditationId: true })
  .partial();

export type AssignEmployeeAccreditationInput = z.infer<typeof assignEmployeeAccreditationSchema>;
export type UpdateEmployeeAccreditationInput = z.infer<typeof updateEmployeeAccreditationSchema>;

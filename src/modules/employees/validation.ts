import { z } from "zod/v4";

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  roleType: z.enum(["OFFICE", "FIELD"]),
  employmentType: z.enum(["FULL_TIME", "TRAINEE", "CASUAL", "ABN"]),
  location: z.enum(["BRISBANE", "BUNDABERG", "HERVEY_BAY", "MACKAY", "OTHER"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().or(z.literal("")),
  probationDate: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).default("ACTIVE"),
  notes: z.string().optional().or(z.literal("")),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

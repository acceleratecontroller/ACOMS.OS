import { z } from "zod/v4";

// Helper: accept string, empty string, null, or undefined — all treated as "no value"
const optionalString = z.string().optional().or(z.literal("")).or(z.null());
const optionalEmail = z.string().email().optional().or(z.literal("")).or(z.null());

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: optionalEmail,
  personalEmail: optionalEmail,
  phone: optionalString,
  address: optionalString,
  dateOfBirth: optionalString,
  shirtSize: optionalString,
  pantsSize: optionalString,
  roleIds: z.array(z.string().min(1)).optional().default([]),
  employmentType: z.enum(["FULL_TIME", "TRAINEE", "CASUAL", "ABN"]),
  location: z.enum(["BRISBANE", "BUNDABERG", "HERVEY_BAY", "MACKAY", "OTHER"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: optionalString,
  probationDate: optionalString,
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).default("ACTIVE"),
  notes: optionalString,
  // Emergency contact
  emergencyFirstName: optionalString,
  emergencyLastName: optionalString,
  emergencyRelation: optionalString,
  emergencyPhone: optionalString,
  emergencyPhoneAlt: optionalString,
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

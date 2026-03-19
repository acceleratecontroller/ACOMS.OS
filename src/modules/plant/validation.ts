import { z } from "zod/v4";

const optionalString = z.string().optional().or(z.literal("")).or(z.null());

/**
 * Transform a string to a number, returning null for empty/invalid values.
 * Used for optional numeric fields sent as strings from HTML forms.
 */
const optionalNumericString = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") return val;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  });

/**
 * Transform a string to an integer, returning null for empty/invalid values.
 */
const optionalIntString = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number") return Math.floor(val);
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  });

export const createPlantSchema = z.object({
  category: z.string().min(1, "Category is required"),
  stateRegistered: optionalString,
  registrationNumber: optionalString,
  vinNumber: optionalString,
  year: optionalIntString,
  make: optionalString,
  model: optionalString,
  licenceType: optionalString,
  regionAssigned: z.enum(["BRISBANE", "BUNDABERG", "HERVEY_BAY", "MACKAY", "OTHER"]).optional().or(z.literal("")).or(z.null()),
  location: z.enum(["BRISBANE", "BUNDABERG", "HERVEY_BAY", "MACKAY", "OTHER"]).optional().or(z.literal("")).or(z.null()),
  assignedToId: optionalString,
  ampolCardNumber: optionalString,
  ampolCardExpiry: optionalString,
  linktTagNumber: optionalString,
  fleetDynamicsSerialNumber: optionalString,
  coiExpirationDate: optionalString,
  purchaseDate: optionalString,
  purchasePrice: optionalNumericString,
  soldDate: optionalString,
  soldPrice: optionalNumericString,
  comments: optionalString,
  lastServiceDate: optionalString,
  nextServiceDue: optionalString,
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "DECOMMISSIONED", "STANDBY"]).default("OPERATIONAL"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]).optional(),
});

export const updatePlantSchema = createPlantSchema.partial();

export type CreatePlantInput = z.infer<typeof createPlantSchema>;
export type UpdatePlantInput = z.infer<typeof updatePlantSchema>;

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

export const createAssetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  make: optionalString,
  model: optionalString,
  serialNumber: optionalString,
  purchaseDate: optionalString,
  purchaseCost: optionalNumericString,
  location: z.enum(["BRISBANE", "BUNDABERG", "HERVEY_BAY", "MACKAY", "OTHER"]).optional().or(z.literal("")).or(z.null()),
  assignedToId: optionalString,
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED", "EXPIRED"]).default("AVAILABLE"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]).optional(),
  notes: optionalString,
  expires: z.union([z.boolean(), z.string()]).optional().transform((val) => {
    if (typeof val === "string") return val === "true" || val === "on";
    return val ?? false;
  }),
  expirationDate: optionalString,
});

export const updateAssetSchema = createAssetSchema.partial();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

import { z } from "zod/v4";

export const createAssetSchema = z.object({
  assetNumber: z.string().min(1, "Asset number is required"),
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  make: z.string().optional().or(z.literal("")),
  model: z.string().optional().or(z.literal("")),
  serialNumber: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  purchaseCost: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "RETIRED"]).default("AVAILABLE"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

export const updateAssetSchema = createAssetSchema.partial();

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

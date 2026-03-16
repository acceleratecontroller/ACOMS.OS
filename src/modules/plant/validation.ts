import { z } from "zod/v4";

export const createPlantSchema = z.object({
  plantNumber: z.string().min(1, "Plant number is required"),
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  make: z.string().optional().or(z.literal("")),
  model: z.string().optional().or(z.literal("")),
  serialNumber: z.string().optional().or(z.literal("")),
  yearOfManufacture: z.string().optional().or(z.literal("")),
  registrationNumber: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
  purchaseCost: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  assignedToId: z.string().optional().or(z.literal("")),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "DECOMMISSIONED", "STANDBY"]).default("OPERATIONAL"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]).optional(),
  lastServiceDate: z.string().optional().or(z.literal("")),
  nextServiceDue: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const updatePlantSchema = createPlantSchema.partial();

export type CreatePlantInput = z.infer<typeof createPlantSchema>;
export type UpdatePlantInput = z.infer<typeof updatePlantSchema>;

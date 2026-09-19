import { z } from "zod";

export const analyticsQuerySchema = z.object({
  districtId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

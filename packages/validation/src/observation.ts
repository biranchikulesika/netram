import { z } from "zod";

export const observationSchema = z.object({
  id: z.string().uuid(),
  inspectionId: z.string().uuid(),
  userId: z.string().uuid(),
  text: z.string(),
  createdAt: z.string().datetime(),
});

export const observationListSchema = z.array(observationSchema);

export const createObservationSchema = z
  .object({
    text: z.string().min(1).max(4000),
  })
  .strict();

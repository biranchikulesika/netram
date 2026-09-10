import { z } from "zod";

export const devLoginSchema = z
  .object({
    email: z.email(),
  })
  .strict();

export const realtimeAuthorizeSchema = z
  .object({
    topics: z.array(z.string().min(1).max(100)).max(50).min(1),
  })
  .strict();

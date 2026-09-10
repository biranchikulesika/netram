import { z } from "zod";
import { ERROR_CODES } from "@netram/types";

export const uuidSchema = z.string().uuid();

export const idParamsSchema = z.object({
  id: uuidSchema,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const errorBodySchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
});

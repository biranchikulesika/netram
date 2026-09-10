import { z } from "zod";
import { OFFLINE_OPERATION_TYPES } from "@netram/types";
import { uuidSchema } from "./common.js";

export const offlineOperationSchema = z
  .object({
    operationId: uuidSchema,
    inspectionId: uuidSchema,
    type: z.enum(OFFLINE_OPERATION_TYPES),
    timestamp: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export const syncBatchRequestSchema = z
  .object({
    operations: z.array(offlineOperationSchema).max(100),
  })
  .strict();

export type SyncBatchRequestInput = z.infer<typeof syncBatchRequestSchema>;

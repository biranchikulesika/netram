import { z } from "zod";
import { ACTION_INBOX_KINDS } from "@netram/types";
import { uuidSchema } from "./common.js";

/**
 * Runtime validation for the Action Inbox contract (AGENTS.md §19, §52).
 * The inbox is read-only: no request body schemas are required - the server
 * derives every section from the caller's permissions and jurisdiction.
 */
export const actionInboxActorSchema = z
  .object({
    id: uuidSchema.nullable(),
    name: z.string().max(300).nullable(),
  })
  .strict();

export const actionInboxItemSchema = z
  .object({
    id: uuidSchema,
    kind: z.enum(ACTION_INBOX_KINDS),
    title: z.string().max(200),
    summary: z.string().max(1000),
    actionType: z.enum(["approve", "review"]),
    project: z.object({
      id: uuidSchema.nullable(),
      code: z.string().max(50).nullable(),
      name: z.string().max(300).nullable(),
      districtId: uuidSchema.nullable(),
    }),
    queuedAt: z.string().datetime(),
    deadline: z.string().datetime().nullable(),
    severity: z.string().max(30).nullable(),
    amountInr: z.number().nullable(),
    actor: actionInboxActorSchema.nullable(),
    link: z.object({
      href: z.string().max(500),
      label: z.string().max(100),
    }),
    context: z.record(z.string(), z.unknown()),
  })
  .strict();

export const actionInboxSectionSchema = z.object({
  kind: z.enum(ACTION_INBOX_KINDS),
  title: z.string().max(100),
  gatedBy: z.string().max(60),
  items: z.array(actionInboxItemSchema),
  total: z.number().int().nonnegative(),
});

export const actionInboxResponseSchema = z.object({
  sections: z.array(actionInboxSectionSchema),
  total: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});

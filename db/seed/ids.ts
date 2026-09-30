import { v5 as uuidv5 } from "uuid";

/**
 * Deterministic namespace for every synthetic identifier the seed creates.
 *
 * Every generated id is UUIDv5 over a human-readable seed string, so a given
 * logical record ("project:vani", "finding:vani-2") always maps to the same
 * UUID. That is what makes the seed idempotent (every insert can use
 * `onConflictDoNothing`) and what lets a fresh reset reproduce byte-identical
 * ids - a hard requirement for deterministic development and demo data
 * (AGENTS.md §13), because mobile offline operations and audit rows reference
 * these ids across process restarts.
 *
 * Kept in its own module so both `index.ts` and the per-project data modules can
 * mint ids without importing each other.
 */
export const SEED_NS = "d3a5e19a-9a1e-4f0b-8f44-3b0b8f44b1a2";

export function did(seed: string): string {
  return uuidv5(seed, SEED_NS);
}

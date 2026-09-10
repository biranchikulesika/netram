import type { UUID, ISODateTime } from "./common.js";

/**
 * A field observation recorded by an assigned inspector during an active
 * inspection (§32). Observations are inspector-sourced records; findings are
 * the authority's later work product and may reference an observation.
 */
export interface Observation {
  id: UUID;
  inspectionId: UUID;
  userId: UUID;
  text: string;
  createdAt: ISODateTime;
}

import type { UUID } from "./common.js";

/**
 * A scheme component (docs/DoSJE.md §21): the operational subdivision of a
 * DoSJE scheme whose targets get audited. Examples (officially documented):
 * "Integrated Programme for Senior Citizens (IPSrC)" under AVYAY,
 * "Adarsh Gram" and "Babu Jagjivan Ram Chhatrawas Yojana (BJRC)" under PM-AJAY,
 * "IRCA" under NAPDDR, SHRESHTA Mode 1/Mode 2, "OBC Hostel" under PM-YASASVI.
 */
export interface SchemeComponent {
  id: UUID;
  programmeId: UUID;
  code: string;
  name: string;
  description: string | null;
  /** Typical auditable target kind this component produces. */
  targetKind: "institution" | "village" | "authority_project" | "other";
  createdAt: string;
}

export interface CreateSchemeComponentInput {
  code: string;
  name: string;
  description?: string | null;
  targetKind: SchemeComponent["targetKind"];
}

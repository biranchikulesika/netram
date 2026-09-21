import type { UUID, ISODateTime } from "./common.js";

/** A project's photo is a visual record tied to the project, not inspection evidence (§34/§14). */
export interface ProjectPhoto {
  id: UUID;
  projectId: UUID;
  uploadedBy: UUID | null;
  capturedAt: ISODateTime;
  caption: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  storageKey: string | null;
  createdAt: ISODateTime;
}

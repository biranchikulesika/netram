import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySqliteDatabase, setTestDatabase } from "./offline/db";
import { OfflineInspectionQueue } from "./offline/queue";
import { captureEvidenceOffline, computeSha256 } from "./offline/evidence";
import type { Inspection } from "@netram/types";

describe("Phase 4: Inspections List & Inspection Detail Specifications", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-p4-spec-001";

  const sampleInspection: Inspection = {
    id: inspectionId,
    projectId: "proj-p4-401",
    projectCode: "PRJ-SHELTER-09",
    projectName: "Sambalpur Senior Citizen Rehabilitation Shelter",
    districtName: "Sambalpur",
    type: "routine",
    trigger: "automatic",
    status: "assigned",
    districtId: "dist-sambalpur",
    templateId: null,
    disclosurePolicyId: null,
    disclosureRuleType: null,
    scheduledStart: "2026-09-28T09:00:00Z",
    scheduledEnd: "2026-09-28T17:00:00Z",
    startedAt: null,
    submittedAt: null,
    assignedUserIds: ["usr-insp-001"],
    createdAt: "2026-09-20T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
  };

  beforeEach(async () => {
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);
    await queue.cacheInspections([sampleInspection]);
  });

  describe("P4-01: Inspections List filtering & cache loading", () => {
    it("loads cached inspection record from local SQLite correctly", async () => {
      const list = await queue.getCachedInspections();
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(inspectionId);
      expect(list[0]?.project_code).toBe("PRJ-SHELTER-09");
      expect(list[0]?.project_name).toBe("Sambalpur Senior Citizen Rehabilitation Shelter");
      expect(list[0]?.status).toBe("assigned");
    });

    it("filters client-side by facility name and sanction code", async () => {
      const list = await queue.getCachedInspections();

      // Search by partial facility name
      const byName = list.filter((i) =>
        i.project_name.toLowerCase().includes("senior citizen".toLowerCase()),
      );
      expect(byName).toHaveLength(1);

      // Search by partial sanction code
      const byCode = list.filter((i) =>
        i.project_code.toLowerCase().includes("SHELTER".toLowerCase()),
      );
      expect(byCode).toHaveLength(1);

      // Search by non-matching query
      const byNonExistent = list.filter((i) =>
        i.project_name.toLowerCase().includes("nonexistent facility"),
      );
      expect(byNonExistent).toHaveLength(0);
    });

    it("filters correctly by ASSIGNED status tab by default", async () => {
      const list = await queue.getCachedInspections();
      const assignedItems = list.filter((i) => i.status === "assigned");
      expect(assignedItems).toHaveLength(1);

      const inProgressItems = list.filter((i) => i.status === "in_progress");
      expect(inProgressItems).toHaveLength(0);
    });
  });

  describe("P4-02: Detail Screen operations & 5-tab lifecycle", () => {
    it("transitions status from assigned to in_progress on start inspection", async () => {
      const startOp = await queue.startInspection(inspectionId);
      expect(startOp.type).toBe("start_inspection");

      const current = await queue.getCachedInspection(inspectionId);
      expect(current?.status).toBe("in_progress");
      expect(current?.started_at).toBeDefined();
    });

    it("records on-site observations with local status", async () => {
      await queue.startInspection(inspectionId);

      const obsOp = await queue.recordObservation(
        inspectionId,
        "Structural inspection completed: roofing integrity conforms to guidelines.",
      );
      expect(obsOp.type).toBe("record_observation");

      const observations = await queue.getCachedObservations(inspectionId);
      expect(observations).toHaveLength(1);
      expect(observations[0]?.text).toContain("Structural inspection completed");
      expect(observations[0]?.is_local).toBe(1);
    });

    it("captures photographic evidence with SHA-256 integrity hash", async () => {
      await queue.startInspection(inspectionId);

      const photoPayload = new TextEncoder().encode("binary-photo-evidence-payload-sample");
      const expectedHash = await computeSha256(photoPayload);

      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "site-exterior-01.jpg",
        fileBytes: photoPayload,
        localFileUri: "file:///data/evidence/photo-01.jpg",
      });

      expect(result.contentHash).toBe(expectedHash);
      expect(result.contentHash.startsWith("sha256:")).toBe(true);

      const cachedEvidence = await queue.getCachedEvidence(inspectionId);
      expect(cachedEvidence).toHaveLength(1);
      expect(cachedEvidence[0]?.content_hash).toBe(expectedHash);
      expect(cachedEvidence[0]?.upload_state).toBe("pending");
    });

    it("drafts and updates findings with severity levels", async () => {
      await queue.startInspection(inspectionId);

      await queue.saveFindingDraft(inspectionId, {
        severity: "high",
        description: "Emergency fire exit blocked with obsolete equipment.",
        remediation: "Clear corridor immediately and inspect emergency signage.",
      });

      const drafts = await queue.getCachedFindingDrafts(inspectionId);
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.severity).toBe("high");
      expect(drafts[0]?.description).toContain("Emergency fire exit blocked");
      expect(drafts[0]?.remediation).toContain("Clear corridor immediately");
      expect(drafts[0]?.sync_state).toBe("pending");
    });

    it("logs site worker headcount attendance operation", async () => {
      await queue.startInspection(inspectionId);

      const attOp = await queue.recordAttendance(
        inspectionId,
        32,
        "Afternoon roll-call at main administrative wing",
      );
      expect(attOp.type).toBe("record_attendance");

      const ops = await queue.getAllOperations(inspectionId);
      const attendanceOps = ops.filter((o) => o.operation_type === "record_attendance");
      expect(attendanceOps).toHaveLength(1);

      const payload = JSON.parse(attendanceOps[0]?.payload || "{}");
      expect(payload.workerCount).toBe(32);
      expect(payload.note).toBe("Afternoon roll-call at main administrative wing");
    });

    it("validates checklist requirements and finalizes inspection submission", async () => {
      await queue.startInspection(inspectionId);
      await queue.recordObservation(inspectionId, "Site visit checklist observation recorded.");
      await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "site-01.jpg",
        fileBytes: new TextEncoder().encode("photo-bytes"),
      });
      await queue.recordAttendance(inspectionId, 18, "Gate check");

      // Verify checklist conditions
      const obs = await queue.getCachedObservations(inspectionId);
      const ev = await queue.getCachedEvidence(inspectionId);
      const ops = await queue.getAllOperations(inspectionId);
      const attOps = ops.filter((o) => o.operation_type === "record_attendance");

      expect(obs.length).toBeGreaterThanOrEqual(1);
      expect(ev.length).toBeGreaterThanOrEqual(1);
      expect(attOps.length).toBeGreaterThanOrEqual(1);

      // Submit inspection
      await queue.submitInspection(inspectionId);

      const finalInspection = await queue.getCachedInspection(inspectionId);
      expect(finalInspection?.status).toBe("submitted");
      expect(finalInspection?.submitted_at).toBeDefined();

      const submitOps = ops.concat(await queue.getAllOperations(inspectionId)).filter(
        (o) => o.operation_type === "submit_inspection",
      );
      expect(submitOps.length).toBeGreaterThanOrEqual(1);
    });
  });
});

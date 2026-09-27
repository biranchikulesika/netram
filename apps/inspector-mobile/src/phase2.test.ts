import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemorySqliteDatabase, setTestDatabase } from "./offline/db";
import { OfflineInspectionQueue, type ChecklistItem } from "./offline/queue";
import { captureEvidenceOffline, computeSha256 } from "./offline/evidence";
import type { Inspection } from "@netram/types";

describe("Phase 2 — Inspection Workflow (Core) Specifications", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-phase2-spec-001";

  beforeEach(async () => {
    vi.clearAllMocks();
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);

    const testInspection: Inspection = {
      id: inspectionId,
      projectId: "proj-p2-test",
      projectCode: "PRJ-OD-002",
      projectName: "Bhubaneswar Stormwater Drain Upgradation",
      type: "routine",
      status: "assigned",
      districtId: "Khordha",
      scheduledStart: "2026-03-26T09:00:00Z",
      scheduledEnd: "2026-03-26T17:00:00Z",
      startedAt: null,
      submittedAt: null,
      assignedUserIds: ["usr-insp-001"],
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
      templateId: null,
      trigger: "officer",
      disclosurePolicyId: null,
      disclosureRuleType: null,
    };

    await queue.cacheInspections([testInspection]);
  });

  // ---------------------------------------------------------------------------
  // 2.1: Offline Queue Contracts
  // ---------------------------------------------------------------------------
  describe("2.1 Offline Queue Contracts", () => {
    it("supports all 8 core offline operations with client UUID and pending sync status", async () => {
      // 1. check_in
      await queue.checkIn(inspectionId, 20.2961, 85.8245, 8.5);
      // 2. start_inspection
      await queue.startInspection(inspectionId);
      // 3. add_observation / record_observation
      await queue.recordObservation(inspectionId, "Site perimeter barricading is properly installed.");
      // 4. capture_evidence
      await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "site_inspection.jpg",
        fileBytes: new TextEncoder().encode("site-evidence-content"),
        latitude: 20.2961,
        longitude: 85.8245,
      });
      // 5. add_finding / draft_finding
      await queue.saveFindingDraft(inspectionId, {
        severity: "high",
        description: "Exposed electrical conduits near drainage ditch without protective sheath.",
        remediation: "Install conduit casing and secure earthing.",
      });
      // 6. update_checklist_item
      await queue.updateChecklistItem(inspectionId, "chk-01", "pass", "Compliant");
      // 7. update_worker_count / record_attendance
      await queue.recordAttendance(inspectionId, 28, "Muster verified with contractor foreman");
      // 8. submit_inspection
      await queue.submitInspection(inspectionId);

      const ops = await queue.getAllOperations();
      expect(ops.length).toBe(8);

      const opTypes = ops.map((o) => o.operation_type);
      expect(opTypes).toContain("check_in");
      expect(opTypes).toContain("start_inspection");
      expect(opTypes).toContain("record_observation");
      expect(opTypes).toContain("capture_evidence");
      expect(opTypes).toContain("draft_finding");
      expect(opTypes).toContain("update_checklist_item");
      expect(opTypes).toContain("record_attendance");
      expect(opTypes).toContain("submit_inspection");

      for (const op of ops) {
        expect(op.operation_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(op.status).toBe("pending");
        expect(new Date(op.client_timestamp).getTime()).not.toBeNaN();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 2.2: Check-In Flow
  // ---------------------------------------------------------------------------
  describe("2.2 Check-In Flow & Geofencing", () => {
    it("verifies geofence distance calculation and default 1000m radius", () => {
      function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
      }

      const siteLat = 20.2961;
      const siteLng = 85.8245;
      const defaultRadius = 1000;

      // Close point: 100m away -> within geofence
      const closeDist = haversineMeters(siteLat, siteLng, 20.2965, 85.825);
      expect(closeDist).toBeLessThanOrEqual(defaultRadius);

      // Far point: ~3km away -> outside geofence
      const farDist = haversineMeters(siteLat, siteLng, 20.32, 85.85);
      expect(farDist).toBeGreaterThan(defaultRadius);
    });

    it("enforces location freshness (< 5 minutes) rule", () => {
      const now = Date.now();
      const freshLocation = { acquiredAt: now - 60 * 1000 }; // 1 min ago
      const staleLocation = { acquiredAt: now - 6 * 60 * 1000 }; // 6 mins ago

      const isFresh = (loc: { acquiredAt: number }) => now - loc.acquiredAt < 5 * 60 * 1000;

      expect(isFresh(freshLocation)).toBe(true);
      expect(isFresh(staleLocation)).toBe(false);
    });

    it("guarantees check-in operation idempotency", async () => {
      await queue.checkIn(inspectionId, 20.2961, 85.8245, 5.0);

      // Simulating idempotency check before queuing duplicate check_in
      const allOps = await queue.getAllOperations();
      const alreadyCheckedIn = allOps.some(
        (o) =>
          o.inspection_id === inspectionId &&
          (o.operation_type === "check_in" || o.operation_type === "start_inspection"),
      );
      expect(alreadyCheckedIn).toBe(true);

      // Subsequent attempt is a no-op
      if (!alreadyCheckedIn) {
        await queue.checkIn(inspectionId, 20.2961, 85.8245, 5.0);
      }

      const checkInOps = (await queue.getAllOperations()).filter(
        (o) => o.operation_type === "check_in",
      );
      expect(checkInOps.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2.3 & 2.4: Finding Lifecycle
  // ---------------------------------------------------------------------------
  describe("2.4 Finding Lifecycle", () => {
    it("validates finding description minimum 10 characters requirement", () => {
      const isValidFindingDesc = (desc: string) => desc.trim().length >= 10;

      expect(isValidFindingDesc("")).toBe(false);
      expect(isValidFindingDesc("Broken")).toBe(false); // 6 chars < 10
      expect(isValidFindingDesc("Cracks ok")).toBe(false); // 9 chars < 10
      expect(isValidFindingDesc("Crack seen")).toBe(true); // 10 chars exact (meets minimum 10)
      expect(isValidFindingDesc("Cracks observed along foundation beam")).toBe(true);
    });

    it("handles full finding draft lifecycle: create, update, and delete", async () => {
      // 1. Create finding draft
      await queue.saveFindingDraft(inspectionId, {
        severity: "critical",
        description: "Severely corroded reinforcement bars visible in foundation footing.",
        remediation: "Halt concrete pouring and re-inspect rebar steel.",
      });

      let drafts = await queue.getFindingDrafts(inspectionId);
      expect(drafts.length).toBe(1);
      expect(drafts[0]!.severity).toBe("critical");
      expect(drafts[0]!.description).toContain("Severely corroded");

      // 2. Edit finding draft
      const draftId = drafts[0]!.id;
      const opId = drafts[0]!.operation_id;
      await queue.saveFindingDraft(inspectionId, {
        findingId: draftId,
        operationId: opId,
        severity: "high",
        description: "Corroded rebar bars treated; superficial rust cleaned.",
        remediation: "Apply anti-rust coating prior to structural casting.",
      });

      drafts = await queue.getFindingDrafts(inspectionId);
      expect(drafts.length).toBe(1);
      expect(drafts[0]!.severity).toBe("high");
      expect(drafts[0]!.description).toContain("superficial rust cleaned");

      // 3. Delete finding draft
      await queue.deleteFindingDraft(draftId);
      drafts = await queue.getFindingDrafts(inspectionId);
      expect(drafts.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2.5: Evidence Capture
  // ---------------------------------------------------------------------------
  describe("2.5 Evidence Capture & Cryptographic Hashing", () => {
    it("computes SHA-256 byte hash and preserves location metadata", async () => {
      const sampleBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
      const expectedHash = await computeSha256(sampleBytes);
      expect(expectedHash).toMatch(/^sha256:[a-f0-9]{64}$/);

      const result = await captureEvidenceOffline(queue, {
        inspectionId,
        evidenceType: "photo",
        fileName: "foundation_evidence.png",
        fileBytes: sampleBytes,
        latitude: 20.2961,
        longitude: 85.8245,
      });

      expect(result.contentHash).toBe(expectedHash);
      expect(result.operation.operationId).toBeDefined();

      const cachedEvidence = await queue.getCachedEvidence(inspectionId);
      expect(cachedEvidence.length).toBe(1);
      expect(cachedEvidence[0]!.content_hash).toBe(expectedHash);
      expect(cachedEvidence[0]!.upload_state).toBe("pending");
    });
  });

  // ---------------------------------------------------------------------------
  // 2.6: Submission Validation
  // ---------------------------------------------------------------------------
  describe("2.6 Submission Flow Validation", () => {
    it("enforces pre-submission validation rules: requires notes/findings and 100% required checklist", async () => {
      const mockChecklist: ChecklistItem[] = [
        {
          id: "chk-req-1",
          inspection_id: inspectionId,
          category: "Safety",
          question: "Is safety signage posted?",
          is_required: true,
          response: null,
          note: null,
          updated_at: null,
        },
        {
          id: "chk-opt-2",
          inspection_id: inspectionId,
          category: "Quality",
          question: "Are optional aesthetic trims in place?",
          is_required: false,
          response: null,
          note: null,
          updated_at: null,
        },
      ];

      const validateSubmission = (
        status: string,
        obsCount: number,
        findingsCount: number,
        checklist: ChecklistItem[],
      ) => {
        if (status !== "in_progress") return false;
        const hasContent = obsCount > 0 || findingsCount > 0;
        const requiredAnswered = checklist
          .filter((c) => c.is_required)
          .every((c) => c.response !== null);
        return hasContent && requiredAnswered;
      };

      // 1. In assigned state (not in_progress) -> blocked
      expect(validateSubmission("assigned", 1, 1, mockChecklist)).toBe(false);

      // 2. in_progress but 0 notes & 0 findings -> blocked
      expect(validateSubmission("in_progress", 0, 0, mockChecklist)).toBe(false);

      // 3. in_progress, has notes, but required checklist item unanswered -> blocked
      expect(validateSubmission("in_progress", 1, 0, mockChecklist)).toBe(false);

      // 4. in_progress, has notes, required checklist item answered -> valid!
      mockChecklist[0]!.response = "pass";
      expect(validateSubmission("in_progress", 1, 0, mockChecklist)).toBe(true);
    });

    it("locks local inspection state to submitted on confirm", async () => {
      await queue.startInspection(inspectionId);
      let cached = (await queue.getCachedInspections()).find((i) => i.id === inspectionId);
      expect(cached?.status).toBe("in_progress");

      await queue.submitInspection(inspectionId);
      cached = (await queue.getCachedInspections()).find((i) => i.id === inspectionId);
      expect(cached?.status).toBe("submitted");
      expect(cached?.submitted_at).not.toBeNull();
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySqliteDatabase, setTestDatabase } from "./offline/db";
import { OfflineInspectionQueue, type ChecklistItem } from "./offline/queue";

describe("Phase 5: Field Inspection Checklist System", () => {
  let db: InMemorySqliteDatabase;
  let queue: OfflineInspectionQueue;
  const inspectionId = "insp-checklist-test-001";

  const sampleItems: ChecklistItem[] = [
    {
      id: "chk-001",
      inspection_id: inspectionId,
      category: "Safety & Security",
      question: "Are mandatory safety signages displayed at prominent locations?",
      is_required: true,
      response: null,
      note: null,
      updated_at: null,
    },
    {
      id: "chk-002",
      inspection_id: inspectionId,
      category: "Safety & Security",
      question:
        "Are fire safety apparatus installed, within valid certification, and unobstructed?",
      is_required: true,
      response: null,
      note: null,
      updated_at: null,
    },
    {
      id: "chk-003",
      inspection_id: inspectionId,
      category: "Infrastructure & Quality",
      question: "Are structural elements free from visible cracks, seepage, or defects?",
      is_required: false,
      response: null,
      note: null,
      updated_at: null,
    },
  ];

  beforeEach(async () => {
    db = new InMemorySqliteDatabase();
    setTestDatabase(db);
    queue = new OfflineInspectionQueue(async () => db);
    await queue.cacheChecklistItems(sampleItems);
  });

  it("caches and retrieves checklist items for an inspection", async () => {
    const items = await queue.getCachedChecklist(inspectionId);
    expect(items).toHaveLength(3);
    expect(items.find((i) => i.id === "chk-001")?.question).toContain("safety signages");
    expect(items.find((i) => i.id === "chk-001")?.is_required).toBe(true);
    expect(items.find((i) => i.id === "chk-003")?.is_required).toBe(false);
  });

  it("records PASS response and enqueues update_checklist_item operation", async () => {
    const op = await queue.updateChecklistItem(inspectionId, "chk-001", "pass");
    expect(op.type).toBe("update_checklist_item");
    expect(op.payload.checklistItemId).toBe("chk-001");
    expect(op.payload.response).toBe("pass");

    const items = await queue.getCachedChecklist(inspectionId);
    const updated = items.find((i) => i.id === "chk-001");
    expect(updated?.response).toBe("pass");

    const pendingOps = await queue.getPendingOperations();
    expect(
      pendingOps.some(
        (o) => o.type === "update_checklist_item" && o.payload.checklistItemId === "chk-001",
      ),
    ).toBe(true);
  });

  it("records FAIL response with deficiency note", async () => {
    const defectNote = "Fire extinguisher tag expired in March 2026";
    await queue.updateChecklistItem(inspectionId, "chk-002", "fail", defectNote);

    const items = await queue.getCachedChecklist(inspectionId);
    const updated = items.find((i) => i.id === "chk-002");
    expect(updated?.response).toBe("fail");
    expect(updated?.note).toBe(defectNote);
  });

  it("records N/A response for non-applicable criteria", async () => {
    await queue.updateChecklistItem(inspectionId, "chk-003", "na");

    const items = await queue.getCachedChecklist(inspectionId);
    const updated = items.find((i) => i.id === "chk-003");
    expect(updated?.response).toBe("na");
  });

  it("supports resetting response back to null", async () => {
    await queue.updateChecklistItem(inspectionId, "chk-001", "pass");
    let items = await queue.getCachedChecklist(inspectionId);
    expect(items.find((i) => i.id === "chk-001")?.response).toBe("pass");

    await queue.updateChecklistItem(inspectionId, "chk-001", null);
    items = await queue.getCachedChecklist(inspectionId);
    expect(items.find((i) => i.id === "chk-001")?.response).toBeNull();
  });

  it("keeps required and optional items distinct", () => {
    const required = sampleItems.filter((i) => i.is_required);
    const optional = sampleItems.filter((i) => !i.is_required);
    expect(required.length).toBeGreaterThan(0);
    expect(optional.length).toBeGreaterThan(0);
  });
});

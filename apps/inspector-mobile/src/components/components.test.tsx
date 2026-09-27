import { describe, expect, it, vi } from "vitest";
import React from "react";
// @ts-expect-error react-dom/server declarations are omitted in React Native environment
import { renderToStaticMarkup } from "react-dom/server";
import { NetramBadge } from "./ui/NetramBadge";
import { NetramButton } from "./ui/NetramButton";
import { InspectionCard } from "./InspectionCard";
import type { CachedInspectionRecord } from "../offline/queue";

describe("UI Components Render Tests (P14-04)", () => {
  describe("NetramBadge", () => {
    it("renders label text correctly", () => {
      const html = renderToStaticMarkup(<NetramBadge label="ACTIVE" variant="status" status="in_progress" />);
      expect(html).toContain("ACTIVE");
    });

    it("renders correct styles for severity critical and high", () => {
      const htmlCritical = renderToStaticMarkup(
        <NetramBadge label="CRITICAL" variant="severity" severity="critical" />,
      );
      expect(htmlCritical).toContain("CRITICAL");

      const htmlHigh = renderToStaticMarkup(
        <NetramBadge label="HIGH" variant="severity" severity="high" />,
      );
      expect(htmlHigh).toContain("HIGH");
    });

    it("renders id variant correctly", () => {
      const htmlId = renderToStaticMarkup(<NetramBadge label="PRJ-101" variant="id" />);
      expect(htmlId).toContain("PRJ-101");
    });
  });

  describe("NetramButton", () => {
    it("renders label when not loading", () => {
      const html = renderToStaticMarkup(
        <NetramButton label="Start Inspection" onPress={vi.fn()} variant="primary" />,
      );
      expect(html).toContain("Start Inspection");
    });

    it("shows ActivityIndicator and hides label when loading", () => {
      const html = renderToStaticMarkup(
        <NetramButton label="Submitting..." onPress={vi.fn()} loading={true} />,
      );
      // In loading state, label is not rendered, ActivityIndicator is rendered
      expect(html).not.toContain("Submitting...");
    });
  });

  describe("InspectionCard", () => {
    const baseInspection: CachedInspectionRecord = {
      id: "insp-001",
      project_id: "proj-101",
      project_name: "Community Sanitation Center",
      project_code: "PRJ-SAN-01",
      type: "routine",
      status: "assigned",
      district_id: "dist-01",
      scheduled_start: "2026-03-15T09:00:00Z",
      scheduled_end: "2026-03-15T17:00:00Z",
      started_at: null,
      submitted_at: null,
      cached_at: "2026-03-01T00:00:00Z",
    };

    it("renders correctly for assigned status", () => {
      const html = renderToStaticMarkup(
        <InspectionCard inspection={baseInspection} onPress={vi.fn()} />,
      );
      expect(html).toContain("Community Sanitation Center");
      expect(html).toContain("PRJ-SAN-01");
      expect(html).toContain("assigned");
      expect(html).toContain("ROUTINE INSPECTION");
    });

    it("renders correctly for in_progress status", () => {
      const inProgressInsp = { ...baseInspection, status: "in_progress" };
      const html = renderToStaticMarkup(
        <InspectionCard inspection={inProgressInsp} onPress={vi.fn()} />,
      );
      expect(html).toContain("in progress");
    });

    it("renders correctly for submitted status", () => {
      const submittedInsp = { ...baseInspection, status: "submitted" };
      const html = renderToStaticMarkup(
        <InspectionCard inspection={submittedInsp} onPress={vi.fn()} />,
      );
      expect(html).toContain("submitted");
    });

    it("renders correctly for closed status", () => {
      const closedInsp = { ...baseInspection, status: "closed" };
      const html = renderToStaticMarkup(
        <InspectionCard inspection={closedInsp} onPress={vi.fn()} />,
      );
      expect(html).toContain("closed");
    });

    it("masks facility name when isUnlocked is false", () => {
      const html = renderToStaticMarkup(
        <InspectionCard
          inspection={baseInspection}
          isUnlocked={false}
          onPress={vi.fn()}
        />,
      );
      expect(html).not.toContain("Community Sanitation Center");
      expect(html).toContain("Assigned Facility (Locked)");
      expect(html).toContain("CHECK IN ON MAP TO UNLOCK");
    });
  });
});

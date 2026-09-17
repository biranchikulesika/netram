"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ScheduleInspectionModal } from "../../../inspections/schedule-inspection-modal";

interface ScheduleFacilityInspectionButtonProps {
  project: { id: string; name: string; code: string; districtId: string | null };
}

export function ScheduleFacilityInspectionButton({ project }: ScheduleFacilityInspectionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.82rem",
          padding: "0.35rem 0.75rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span>+ Schedule Inspection</span>
      </button>

      {open && (
        <ScheduleInspectionModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onSuccess={() => router.refresh()}
          availableProjects={[project]}
          preselectedProjectId={project.id}
        />
      )}
    </>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GenerateReportModal } from "../../../reports/generate-report-modal";

interface CompileFacilityReportButtonProps {
  availableInspections: Array<{
    id: string;
    projectCode: string;
    projectName: string;
    type: string;
    status: string;
  }>;
}

export function CompileFacilityReportButton({
  availableInspections,
}: CompileFacilityReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.82rem",
          padding: "0.4rem 0.85rem",
          fontWeight: 600,
          background: "var(--color-navy-brand)",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        <span>+ Compile Official Report</span>
      </button>

      {open && (
        <GenerateReportModal
          isOpen={open}
          onClose={() => setOpen(false)}
          onSuccess={() => router.refresh()}
          availableInspections={availableInspections}
        />
      )}
    </>
  );
}

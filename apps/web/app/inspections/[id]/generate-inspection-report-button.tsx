"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GenerateReportModal } from "../../reports/generate-report-modal";

interface GenerateInspectionReportButtonProps {
  inspectionId: string;
  hasExistingReport: boolean;
  existingReportId?: string;
}

export function GenerateInspectionReportButton({
  inspectionId,
  hasExistingReport,
  existingReportId,
}: GenerateInspectionReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (hasExistingReport && existingReportId) {
    return (
      <Link
        href={`/reports/${existingReportId}`}
        className="btn-secondary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontSize: "0.82rem",
          padding: "0.4rem 0.8rem",
          textDecoration: "none",
          fontWeight: 600,
          background: "var(--bg-surface)",
        }}
      >
        <span>📄 View Official Report</span>
      </Link>
    );
  }

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
          padding: "0.4rem 0.8rem",
          fontWeight: 600,
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
          preselectedInspectionId={inspectionId}
        />
      )}
    </>
  );
}

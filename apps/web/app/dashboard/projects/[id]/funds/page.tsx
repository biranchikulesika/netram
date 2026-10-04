import { notFound } from "next/navigation";
import { getFacility, getFacilityFunds } from "../../../../../lib/facility";
import { getSessionUser } from "../../../../../lib/api";
import { ProjectFundsClient } from "./project-funds-client";
import type { ProjectFundOverview } from "@netram/types";

export const dynamic = "force-dynamic";

export default async function FacilityFundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getFacility(id);
  if (!project) {
    notFound();
  }

  const session = await getSessionUser();
  const permissions = Array.isArray(session?.permissions) ? session.permissions : [];
  const canSubmitExpense = permissions.includes("expense:submit") || permissions.includes("*");
  const canVerifyExpense = permissions.includes("expense:verify") || permissions.includes("*");
  const canAllocate = permissions.includes("fund:allocate") || permissions.includes("*");
  const canInspect = permissions.includes("inspection:create") || permissions.includes("*");
  const canViewFlags =
    permissions.includes("financial_risk:read") ||
    permissions.includes("project_risk:read") ||
    permissions.includes("*");

  const rawOverview = await getFacilityFunds(project.id);
  const overview: ProjectFundOverview = rawOverview ?? {
    summary: {
      totalAllocated: "0.00",
      totalReleased: "0.00",
      totalExpenditure: "0.00",
      pendingReleases: "0.00",
      utilizationRate: 0,
      activeAllocationsCount: 0,
      expensesCount: 0,
      flaggedExpensesCount: 0,
    },
    allocations: [],
    recentExpenses: [],
    recentRiskEvents: [],
    activeFlags: [],
  };

  return (
    <ProjectFundsClient
      project={project}
      initialOverview={overview}
      canSubmitExpense={canSubmitExpense}
      canVerifyExpense={canVerifyExpense}
      canAllocate={canAllocate}
      canViewFlags={canViewFlags}
      canInspect={canInspect}
    />
  );
}

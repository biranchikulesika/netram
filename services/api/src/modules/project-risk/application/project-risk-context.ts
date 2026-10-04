export interface ProjectRiskEvaluationContext {
  project: {
    id: string;
    code: string;
    name: string;
    status: string;
    districtId: string | null;
    organisationId: string | null;
    createdAt: string;
  };
  financial: {
    totalScore: number;
    riskLevel: string;
    triggeredRules: Array<{
      ruleId?: string;
      ruleCode: string;
      ruleName: string;
      scoreContribution: number;
      detail?: Record<string, unknown>;
    }>;
    maxPossibleRawScore: number;
    allocationsCount: number;
    expensesCount: number;
    flagId: string | null;
  };
  inspections: {
    inspections: Array<{
      id: string;
      status: string;
      scheduledStart?: string | null;
      startedAt?: string | null;
      submittedAt?: string | null;
      createdAt: string;
    }>;
    findings: Array<{
      id: string;
      inspectionId: string;
      severity: string;
      status: string;
    }>;
    correctiveActions: Array<{
      id: string;
      findingId: string;
      status: string;
      deadline: string | null;
    }>;
  };
  attendance: {
    anomalies: Array<{
      id: string;
      anomalyType: string;
      severity: string;
      state: string;
      operationalDate: string | null;
    }>;
  };
  complaints: {
    complaints: Array<{
      id: string;
      status: string;
      receivedAt: string;
    }>;
  };
  aiAnomalies: {
    anomalies: Array<{
      id: string;
      type: string;
      severity: string;
      status: string;
      confidence: number;
      createdAt: string;
    }>;
  };
}

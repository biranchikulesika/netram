import type {
  EvidenceRef,
  InspectionFlagRiskLevel,
} from "@netram/types";
import type { RuleEvaluationResult } from "./rule-evaluator.js";

export interface ScoredRiskOutput {
  totalScore: number;
  riskLevel: InspectionFlagRiskLevel;
  explanation: string;
  evidenceRefs: EvidenceRef[];
  triggeredResults: RuleEvaluationResult[];
}

export function scoreRiskResults(results: RuleEvaluationResult[]): ScoredRiskOutput {
  const triggered = results.filter((r) => r.triggered);

  if (triggered.length === 0) {
    return {
      totalScore: 0,
      riskLevel: "low",
      explanation: "No financial risk indicators detected.",
      evidenceRefs: [],
      triggeredResults: [],
    };
  }

  // Calculate composite score
  const totalScore = triggered.reduce((sum, r) => sum + r.scoreContribution, 0);

  // Map to risk level
  let riskLevel: InspectionFlagRiskLevel = "low";
  if (totalScore >= 76) {
    riskLevel = "critical";
  } else if (totalScore >= 51) {
    riskLevel = "high";
  } else if (totalScore >= 26) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  // Build non-defamatory, explainable summary
  const summaryLines: string[] = [
    `Automated review identified ${triggered.length} risk indicator${triggered.length > 1 ? "s" : ""} (Composite Score: ${totalScore}, Level: ${riskLevel.toUpperCase()}):`,
  ];

  for (let i = 0; i < triggered.length; i++) {
    const r = triggered[i]!;
    summaryLines.push(`${i + 1}. [${r.ruleCode}] ${r.explanation}`);
  }

  const explanation = summaryLines.join("\n");

  // Build evidenceRefs
  const evidenceRefs: EvidenceRef[] = [];
  const seenKeys = new Set<string>();

  for (const r of triggered) {
    if (r.expenseId) {
      const key = `expense:${r.expenseId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        evidenceRefs.push({
          type: "expense",
          id: r.expenseId,
          label: `Expense record (Rule ${r.ruleCode})`,
        });
      }
    }

    if (r.documentId) {
      const key = `document:${r.documentId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        evidenceRefs.push({
          type: "document",
          id: r.documentId,
          label: `Financial document (Rule ${r.ruleCode})`,
        });
      }
    }

    if (r.allocationId) {
      const key = `allocation:${r.allocationId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        evidenceRefs.push({
          type: "allocation",
          id: r.allocationId,
          label: `Fund allocation (Rule ${r.ruleCode})`,
        });
      }
    }

    // Check detail object for additional references (e.g. duplicateExpenseIds, documentIds)
    if (Array.isArray(r.detail?.duplicateExpenseIds)) {
      for (const expId of r.detail.duplicateExpenseIds as string[]) {
        const key = `expense:${expId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          evidenceRefs.push({
            type: "expense",
            id: expId,
            label: `Duplicate invoice expense claim (${r.ruleCode})`,
          });
        }
      }
    }

    if (Array.isArray(r.detail?.documentIds)) {
      for (const docId of r.detail.documentIds as string[]) {
        const key = `document:${docId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          evidenceRefs.push({
            type: "document",
            id: docId,
            label: `Duplicate hash document (${r.ruleCode})`,
          });
        }
      }
    }
  }

  return {
    totalScore,
    riskLevel,
    explanation,
    evidenceRefs,
    triggeredResults: triggered,
  };
}

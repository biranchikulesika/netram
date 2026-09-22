import type {
  CompositeRiskScore,
  CompositeRiskLevel,
  RiskContributor,
  DimensionResult,
} from "@netram/types";
import type { ProjectRiskEvaluationContext } from "../application/project-risk-context.js";
import {
  DEFAULT_RISK_WEIGHTS,
  DEFAULT_RISK_THRESHOLDS,
  SCORING_VERSION,
  type RiskDimensionWeights,
  type RiskThresholds,
  validateRiskWeights,
} from "../config/risk-config.js";
import { FinancialDimensionCalculator } from "./dimensions/financial-dimension.js";
import { InspectionQualityDimensionCalculator } from "./dimensions/inspection-quality-dimension.js";
import { AttendanceAnomalyDimensionCalculator } from "./dimensions/attendance-anomaly-dimension.js";
import { ComplaintDensityDimensionCalculator } from "./dimensions/complaint-density-dimension.js";
import { AiAnomalyDimensionCalculator } from "./dimensions/ai-anomaly-dimension.js";

export class CompositeRiskScorer {
  private readonly financialCalc = new FinancialDimensionCalculator();
  private readonly inspectionQualityCalc = new InspectionQualityDimensionCalculator();
  private readonly attendanceAnomalyCalc = new AttendanceAnomalyDimensionCalculator();
  private readonly complaintDensityCalc = new ComplaintDensityDimensionCalculator();
  private readonly aiAnomalyCalc = new AiAnomalyDimensionCalculator();

  constructor(
    private readonly weights: RiskDimensionWeights = DEFAULT_RISK_WEIGHTS,
    private readonly thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
    private readonly scoringVersion: string = SCORING_VERSION,
  ) {
    validateRiskWeights(this.weights);
  }

  calculateScore(ctx: ProjectRiskEvaluationContext): CompositeRiskScore {
    const financialDim = this.financialCalc.calculate(ctx, this.weights.financial);
    const inspectionDim = this.inspectionQualityCalc.calculate(ctx, this.weights.inspectionQuality);
    const attendanceDim = this.attendanceAnomalyCalc.calculate(ctx, this.weights.attendanceAnomaly);
    const complaintDim = this.complaintDensityCalc.calculate(ctx, this.weights.complaintDensity);
    const aiDim = this.aiAnomalyCalc.calculate(ctx, this.weights.aiAnomaly);

    const rawTotal =
      financialDim.weightedContribution +
      inspectionDim.weightedContribution +
      attendanceDim.weightedContribution +
      complaintDim.weightedContribution +
      aiDim.weightedContribution;

    // Multi-Vector Compound Synergy:
    // In administrative risk modeling, concurrent high-severity vectors (e.g. financial + ghost attendance)
    // indicate a statistically higher likelihood of deliberate evasion than isolated defects.
    const severeDimensions = [
      financialDim,
      inspectionDim,
      attendanceDim,
      complaintDim,
      aiDim,
    ].filter((d) => d.normalizedScore >= 60);

    let compoundBonus = 0;
    if (severeDimensions.length >= 3) {
      compoundBonus = 10;
    } else if (severeDimensions.length === 2) {
      compoundBonus = 5;
    } else if (financialDim.normalizedScore >= 50 && attendanceDim.normalizedScore >= 50) {
      compoundBonus = 5;
    }

    const totalScore = Math.min(100, Math.max(0, Math.round(rawTotal + compoundBonus)));

    let riskLevel: CompositeRiskLevel = "low";
    if (totalScore >= this.thresholds.criticalMin) {
      riskLevel = "critical";
    } else if (totalScore > this.thresholds.mediumMax) {
      riskLevel = "high";
    } else if (totalScore > this.thresholds.lowMax) {
      riskLevel = "medium";
    }

    const dimensionList: DimensionResult[] = [
      financialDim,
      inspectionDim,
      attendanceDim,
      complaintDim,
      aiDim,
    ];

    // Sort dimensions by contribution descending
    const sortedDims = [...dimensionList].sort(
      (a, b) => b.weightedContribution - a.weightedContribution,
    );

    const topContributors: RiskContributor[] = sortedDims
      .filter((d) => d.weightedContribution > 0)
      .map((d) => ({
        dimension: d.dimension,
        contribution: d.weightedContribution,
        percentage: totalScore > 0 ? Math.round((d.weightedContribution / totalScore) * 100) : 0,
        explanation: d.explanation,
      }));

    // Generate actionable directives for the field inspection team based on detected signals
    const actionableDirectives = this.generateActionableDirectives(
      financialDim,
      inspectionDim,
      attendanceDim,
      complaintDim,
      aiDim,
    );

    return {
      totalScore,
      riskLevel,
      dimensions: {
        financial: financialDim,
        inspection_quality: inspectionDim,
        attendance_anomaly: attendanceDim,
        complaint_density: complaintDim,
        ai_anomaly: aiDim,
      },
      topContributors,
      compoundBonus: compoundBonus > 0 ? compoundBonus : undefined,
      actionableDirectives,
      calculatedAt: new Date().toISOString(),
      scoringVersion: this.scoringVersion,
    };
  }

  private generateActionableDirectives(
    financialDim: DimensionResult,
    inspectionDim: DimensionResult,
    attendanceDim: DimensionResult,
    complaintDim: DimensionResult,
    aiDim: DimensionResult,
  ): string[] {
    const directives: string[] = [];

    // Cross-dimensional multi-vector warning
    if (financialDim.normalizedScore >= 50 && attendanceDim.normalizedScore >= 50) {
      directives.push(
        "PRIORITY AUDIT: Correlate stipend/wage disallowances against biometric logs to investigate ghost beneficiary payroll siphonage.",
      );
    }

    if (financialDim.normalizedScore >= 40) {
      directives.push(
        "Audit high-value expenditure vouchers against approved budget lines; sample receipts issued within 14 days of reporting periods.",
      );
    }

    if (inspectionDim.normalizedScore >= 40) {
      directives.push(
        "Perform physical verification of overdue corrective actions and re-inspect previously cited safety/sanitation defects.",
      );
    }

    if (attendanceDim.normalizedScore >= 40) {
      directives.push(
        "Conduct an unannounced physical headcount verification against the biometric attendance register to detect headcount mismatch.",
      );
    }

    if (complaintDim.normalizedScore >= 40) {
      directives.push(
        "Conduct confidential beneficiary interviews regarding unresolved grievance reports and food/living standard issues.",
      );
    }

    if (aiDim.normalizedScore >= 40) {
      directives.push(
        "Inspect CCTV camera positioning, lens cleanliness, and network connectivity to investigate potential physical obstruction or camera tampering.",
      );
    }

    return directives;
  }
}

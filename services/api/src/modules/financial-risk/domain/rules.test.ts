import { describe, expect, it } from "vitest";
import { createDefaultRuleEvaluators } from "./rules/index.js";
import type { FinancialRiskRule, Expense, FinancialDocument, FundAllocation, FundRelease } from "@netram/types";
import type { RiskEvaluationContext } from "./rule-evaluator.js";

function makeRule(code: string, weight = 10, severity: "low" | "medium" | "high" | "critical" = "medium"): FinancialRiskRule {
  return {
    id: `rule-${code}`,
    code,
    name: `Rule ${code}`,
    category: "TEST",
    description: "Test rule",
    conditionConfig: {},
    weight,
    severity,
    enabled: true,
    createdById: null,
    updatedById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeExpense(partial: Partial<Expense>): Expense {
  return {
    id: partial.id ?? "exp-1",
    projectId: partial.projectId ?? "proj-1",
    organisationId: null,
    allocationId: partial.allocationId ?? null,
    category: partial.category ?? "Materials",
    description: partial.description ?? "Sample expense",
    amount: partial.amount ?? "1000.00",
    transactionDate: partial.transactionDate ?? new Date().toISOString(),
    vendorName: partial.vendorName ?? "Vendor A",
    vendorGstin: partial.vendorGstin ?? "21AAACG0000A1Z5",
    invoiceNumber: partial.invoiceNumber ?? "INV-001",
    invoiceDate: partial.invoiceDate ?? null,
    paymentReference: partial.paymentReference ?? null,
    paymentMethod: partial.paymentMethod ?? null,
    status: partial.status ?? "submitted",
    submittedById: null,
    submittedAt: null,
    verifiedById: null,
    verifiedAt: null,
    voidReason: null,
    voidedById: null,
    voidedAt: null,
    createdById: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const evaluators = createDefaultRuleEvaluators();

describe("Financial Risk Engine - Detection Rules", () => {
  const baseContext: RiskEvaluationContext = {
    projectId: "proj-1",
    organisationId: null,
    project: {
      id: "proj-1",
      name: "Test Facility",
      code: "PRJ-001",
      status: "active",
      organisationId: null,
      districtId: "dist-1",
      totalInspections: 1,
      completedInspections: 1,
      openFindings: 0,
      resolvedFindings: 0,
    },
    allocations: [],
    releases: [],
    expenses: [],
    documents: [],
    existingEvents: [],
  };

  it("EXP-001: detects when expenses exceed total sanctioned allocation", async () => {
    const evaluator = evaluators.get("EXP-001")!;
    const rule = makeRule("EXP-001", 25, "critical");

    const allocation: FundAllocation = {
      id: "alloc-1",
      projectId: "proj-1",
      programmeId: null,
      organisationId: null,
      allocatedAmount: "100000.00",
      fiscalYear: "2024-2025",
      currency: "INR",
      sanctionedById: null,
      sanctionedAt: null,
      status: "active",
      scheme: null,
      description: null,
      notes: null,
      createdById: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const expense = makeExpense({ amount: "120000.00" });

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        allocations: [allocation],
        expenses: [expense],
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.ruleCode).toBe("EXP-001");
  });

  it("EXP-002: detects when expenses exceed disbursed releases", async () => {
    const evaluator = evaluators.get("EXP-002")!;
    const rule = makeRule("EXP-002", 20, "high");

    const release: FundRelease = {
      id: "rel-1",
      allocationId: "alloc-1",
      releasedAmount: "50000.00",
      releaseDate: new Date().toISOString(),
      referenceNumber: "REL-01",
      releasedById: null,
      remarks: null,
      status: "released",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const expense = makeExpense({ amount: "65000.00" });

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        releases: [release],
        expenses: [expense],
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.ruleCode).toBe("EXP-002");
  });

  it("EXP-005: detects duplicate invoice numbers within a facility", async () => {
    const evaluator = evaluators.get("EXP-005")!;
    const rule = makeRule("EXP-005", 25, "critical");

    const exp1 = makeExpense({ id: "e1", invoiceNumber: "INV-DUP-99" });
    const exp2 = makeExpense({ id: "e2", invoiceNumber: "INV-DUP-99" });
    const exp3 = makeExpense({ id: "e3", invoiceNumber: "INV-UNIQUE-1" });

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        expenses: [exp1, exp2, exp3],
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.ruleCode).toBe("EXP-005");
  });

  it("EXP-006: evaluates Benford's Law distribution compliance", async () => {
    const evaluator = evaluators.get("EXP-006")!;
    const rule = makeRule("EXP-006", 15, "medium");

    // Highly anomalous: 30 numbers all starting with digit 9
    const abnormalExpenses = Array.from({ length: 30 }, (_, i) =>
      makeExpense({ id: `e-${i}`, amount: `9${i + 1}00.00` }),
    );

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        expenses: abnormalExpenses,
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.ruleCode).toBe("EXP-006");
  });

  it("EXP-008: detects clusters of round numbers", async () => {
    const evaluator = evaluators.get("EXP-008")!;
    const rule = {
      ...makeRule("EXP-008", 10, "medium"),
      conditionConfig: { minExpensesCount: 3, minAmount: 10000 },
    };

    const roundExpenses = [
      makeExpense({ id: "e1", amount: "50000.00" }),
      makeExpense({ id: "e2", amount: "20000.00" }),
      makeExpense({ id: "e3", amount: "100000.00" }),
      makeExpense({ id: "e4", amount: "75000.00" }),
    ];

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        expenses: roundExpenses,
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.ruleCode).toBe("EXP-008");
  });

  it("EXP-009: flags verified or submitted expenses lacking documents", async () => {
    const evaluator = evaluators.get("EXP-009")!;
    const rule = makeRule("EXP-009", 15, "high");

    const expWithDoc = makeExpense({ id: "e1", amount: "80000.00", status: "submitted" });
    const expWithoutDoc = makeExpense({ id: "e2", amount: "95000.00", status: "submitted" });

    const doc: FinancialDocument = {
      id: "d1",
      expenseId: "e1",
      projectId: "proj-1",
      documentType: "invoice",
      fileName: "bill.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      sha256Hash: "hash1",
      storageKey: "key1",
      verificationStatus: "verified",
      uploadedById: null,
      uploadedAt: new Date().toISOString(),
      verifiedById: null,
      verifiedAt: null,
      rejectionReason: null,
      duplicateOfId: null,
      createdAt: new Date().toISOString(),
    };

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        expenses: [expWithDoc, expWithoutDoc],
        documents: [doc],
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.expenseId).toBe("e2");
  });

  it("EXP-010: flags duplicate document content hashes across expenses", async () => {
    const evaluator = evaluators.get("EXP-010")!;
    const rule = makeRule("EXP-010", 25, "critical");

    const docs: FinancialDocument[] = [
      {
        id: "d1",
        expenseId: "e1",
        projectId: "proj-1",
        documentType: "invoice",
        fileName: "doc1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
        sha256Hash: "same-sha256-hash-xyz",
        storageKey: "k1",
        verificationStatus: "verified",
        uploadedById: null,
        uploadedAt: new Date().toISOString(),
        verifiedById: null,
        verifiedAt: null,
        rejectionReason: null,
        duplicateOfId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "d2",
        expenseId: "e2",
        projectId: "proj-1",
        documentType: "invoice",
        fileName: "doc2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1000,
        sha256Hash: "same-sha256-hash-xyz",
        storageKey: "k2",
        verificationStatus: "verified",
        uploadedById: null,
        uploadedAt: new Date().toISOString(),
        verifiedById: null,
        verifiedAt: null,
        rejectionReason: null,
        duplicateOfId: null,
        createdAt: new Date().toISOString(),
      },
    ];

    const results = await evaluator.evaluate(
      {
        ...baseContext,
        documents: docs,
      },
      rule,
    );

    expect(results.length).toBe(1);
    expect(results[0]?.triggered).toBe(true);
    expect(results[0]?.ruleCode).toBe("EXP-010");
  });
});

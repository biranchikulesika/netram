import { describe, expect, it } from "vitest";
import { formatCurrencyString } from "./currency";

describe("formatCurrencyString", () => {
  it("formats standard amounts using Indian currency numbering without float arithmetic", () => {
    expect(formatCurrencyString("15000000.00")).toBe("₹1,50,00,000.00");
    expect(formatCurrencyString("250000")).toBe("₹2,50,000.00");
    expect(formatCurrencyString("1234567.89")).toBe("₹12,34,567.89");
    expect(formatCurrencyString("500")).toBe("₹500.00");
    expect(formatCurrencyString("50")).toBe("₹50.00");
    expect(formatCurrencyString("0")).toBe("₹0.00");
  });

  it("handles null, undefined, empty, and negative strings gracefully", () => {
    expect(formatCurrencyString(null)).toBe("₹0.00");
    expect(formatCurrencyString(undefined)).toBe("₹0.00");
    expect(formatCurrencyString("")).toBe("₹0.00");
    expect(formatCurrencyString("-50000.50")).toBe("-₹50,000.50");
  });
});

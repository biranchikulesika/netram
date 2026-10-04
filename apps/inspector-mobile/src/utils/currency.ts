const inrFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a monetary string or number into an Indian Rupee string (₹).
 */
export function formatCurrencyString(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "₹0.00";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (Number.isNaN(num)) return "₹0.00";
  return inrFormat.format(num);
}

/**
 * Formats a monetary string or number into an Indian Rupee string (₹).
 * Follows P11-01 constraint: purely string-based manipulation without JavaScript float arithmetic.
 */
export function formatCurrencyString(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "₹0.00";
  const rawStr = String(val).trim();
  if (!rawStr) return "₹0.00";

  // Split into sign, integer, and decimal parts
  const isNegative = rawStr.startsWith("-");
  const cleanStr = isNegative ? rawStr.slice(1) : rawStr;
  const parts = cleanStr.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = parts[1] ? parts[1].slice(0, 2).padEnd(2, "0") : "00";

  // Indian numbering system: last 3 digits, then groups of 2
  if (integerPart.length <= 3) {
    return `${isNegative ? "-" : ""}₹${integerPart}.${decimalPart}`;
  }

  const lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const formatted = `${formattedOther},${lastThree}.${decimalPart}`;

  return `${isNegative ? "-" : ""}₹${formatted}`;
}

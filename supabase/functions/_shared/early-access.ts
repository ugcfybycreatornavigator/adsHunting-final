export const EARLY_ACCESS = {
  paymentType: "early_access",
  name: "Early Access",
  basePriceInr: "499.00",
  gstAmountInr: "89.82",
  totalAmountInr: "588.82",
  basePricePaise: 49_900,
  gstRate: 0.18,
  gstPaise: 8_982,
  totalPaise: 58_882,
  currency: "INR",
  credits: 3_000,
} as const;

export function inrAmountToPaise(value: string | number) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const whole = Number.parseInt(match[1], 10);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return whole * 100 + Number.parseInt(fraction || "0", 10);
}

export function formatPaise(amountPaise: number) {
  return `₹${(amountPaise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

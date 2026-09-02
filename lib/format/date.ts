export const billingDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatBillingDate(value: string | Date | number): string {
  return billingDateFormatter.format(new Date(value));
}

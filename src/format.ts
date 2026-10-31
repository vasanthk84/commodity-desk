export const fmt = (value: number, digits = 1) =>
  value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
export const signed = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value, digits)}`;

function parseDate(value: string): Date {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : value.replace(" ", "T") + "+05:30";
  return new Date(normalized);
}

export function quoteAgeMinutes(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const stamp = parseDate(value).getTime();
  return Number.isFinite(stamp)
    ? Math.max(0, (Date.now() - stamp) / 60000)
    : null;
}

export function timeIST(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return (
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date) + " IST"
  );
}

export function dayIST(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export const fmt = (value: number, digits = 1) =>
  value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
export const signed = (value: number | null | undefined, digits = 1) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${fmt(value, digits)}`;

export function timeIST(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = value.includes("T")
    ? value
    : value.replace(" ", "T") + "+05:30";
  const date = new Date(normalized);
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

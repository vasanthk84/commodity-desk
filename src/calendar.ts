const GAS_EXCEPTIONS: Record<string, [string, number, number]> = {
  "2026-11-12": ["2026-11-13", 10, 30],
  "2026-11-26": ["2026-11-25", 12, 0],
};
const CRUDE_EXCEPTIONS: Record<string, [string, number, number]> = {
  "2026-11-11": ["2026-11-12", 12, 0],
};

function etRelease(day: string, hour: number, minute: number): Date {
  const [year, month, date] = day.split("-").map(Number);
  const noon = new Date(Date.UTC(year, month - 1, date, 16));
  const name =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "shortOffset",
    })
      .formatToParts(noon)
      .find((part) => part.type === "timeZoneName")?.value || "GMT-5";
  const offset = Number(name.match(/GMT([+-]\d+)/)?.[1] || -5);
  return new Date(Date.UTC(year, month - 1, date, hour - offset, minute));
}

export function nextReport(kind: "gas" | "crude", now = new Date()) {
  const targetDay = kind === "gas" ? 4 : 3;
  const exceptions = kind === "gas" ? GAS_EXCEPTIONS : CRUDE_EXCEPTIONS;
  for (let delta = -1; delta <= 14; delta++) {
    const day = new Date(now);
    day.setUTCHours(12, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() + delta);
    if (day.getUTCDay() !== targetDay) continue;
    const key = day.toISOString().slice(0, 10);
    const [releaseDay, hour, minute] = exceptions[key] || [key, 10, 30];
    const release = etRelease(releaseDay, hour, minute);
    if (release > now)
      return {
        when: release.toISOString(),
        provisional: !exceptions[key],
        source:
          kind === "gas"
            ? "https://ir.eia.gov/ngs/schedule.html"
            : "https://www.eia.gov/petroleum/supply/weekly/schedule.php",
      };
  }
  return null;
}

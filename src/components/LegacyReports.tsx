interface Props { logs: Record<string, Record<string, unknown>>; }

export function LegacyReports({ logs }: Props) {
  const rows = Object.entries(logs).filter(([id]) => id.startsWith("NG-") || id.startsWith("CRUDE-")).sort(([a], [b]) => b.localeCompare(a));
  if (!rows.length) return null;
  return <section className="panel legacy-panel"><div className="panel-head"><div><div className="eyebrow">IMPORTED REPORT HISTORY</div><h2>Earlier event notes</h2></div><span className="pill">{rows.length}</span></div>
    <p className="muted">Read-only notes from the previous HTML desk. Their forecasts are preserved with their original reports.</p>
    <div className="table-scroll"><table><thead><tr><th>Release</th><th>Actual</th><th>Forecast</th><th>Previous</th><th>Reaction / notes</th></tr></thead><tbody>{rows.map(([id, log]) => <tr key={id}><td>{id.replace("NG-", "Gas ").replace("CRUDE-", "Crude ")}</td><td>{String(log.actual ?? "—")}</td><td>{String(log.forecast ?? "—")}</td><td>{String(log.previous ?? "—")}</td><td>{[log.reaction15, log.reaction60, log.reactionDay, log.notes].filter(Boolean).map(String).join(" · ") || "—"}</td></tr>)}</tbody></table></div>
  </section>;
}

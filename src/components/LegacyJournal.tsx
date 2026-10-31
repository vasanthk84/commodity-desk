import { fmt } from "../format";

export function LegacyJournal({
  trades,
}: {
  trades: Record<string, unknown>[];
}) {
  if (!trades.length) return null;
  return (
    <section className="panel legacy-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">IMPORTED HISTORY</div>
          <h2>Earlier long-option paper trades</h2>
        </div>
        <span className="pill">{trades.length}</span>
      </div>
      <p className="muted">
        Read-only records imported from the previous HTML app. They are kept
        separate from short spread plans.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>Contract</th>
              <th>Lots</th>
              <th>Entry premium</th>
              <th>Exit premium</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, index) => (
              <tr key={String(trade.id || index)}>
                <td>{String(trade.instrument || "—")}</td>
                <td>
                  {String(trade.optionType || "—")}{" "}
                  {String(trade.strike || "—")} · {String(trade.expiry || "—")}
                </td>
                <td>{String(trade.lots || "—")}</td>
                <td>
                  {typeof trade.entryPremium === "number"
                    ? `₹${fmt(trade.entryPremium, 2)}`
                    : "—"}
                </td>
                <td>
                  {typeof trade.exitPremium === "number"
                    ? `₹${fmt(trade.exitPremium, 2)}`
                    : "—"}
                </td>
                <td>{String(trade.reason || "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

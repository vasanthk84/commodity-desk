import type { Overview } from "../types";
import { fmt, signed, timeIST } from "../format";

export function ReadPanel({ overview }: { overview: Overview | null }) {
  const market = overview?.market;
  const read = market?.future.read;
  const setup = overview?.setup;
  return (
    <section className="panel read-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">CONDITIONAL READ</div>
          <h2>Price + open interest</h2>
        </div>
        <span className={`pill ${read?.fresh ? "good" : "warn"}`}>
          {read?.fresh ? "FRESH QUOTE" : "STALE / NO QUOTE"}
        </span>
      </div>
      <div className="read-grid">
        <div className="stat">
          <span>FUTURE PRICE</span>
          <strong className="mono">
            {market ? `₹${fmt(market.future.last_price, 2)}` : "—"}
          </strong>
          <small>{market?.future.symbol || "Kite not connected"}</small>
        </div>
        <div className="stat">
          <span>PRICE VS PRIOR CLOSE</span>
          <strong className="mono">{read?.price_change_pct == null ? "—" : `${signed(read.price_change_pct)}%`}</strong>
          <small>Quote OHLC baseline</small>
        </div>
        <div className="stat">
          <span>FUTURES OI CHANGE</span>
          <strong className="mono">{read?.oi_change_pct == null ? "—" : `${signed(read.oi_change_pct)}%`}</strong>
          <small>Vs last completed daily candle</small>
        </div>
        <div className="stat">
          <span>OPTION PCR</span>
          <strong className="mono">{market?.options.pcr ?? "—"}</strong>
          <small>Selected strike window only</small>
        </div>
      </div>
      <div className="pattern">
        <b>{read?.pattern || "Awaiting MCX data"}</b>
        <span>
          {market?.future.quote_at
            ? `Quote ${timeIST(market.future.quote_at)}`
            : ""}
        </span>
      </div>
      <div
        className={`setup ${setup?.option_selling_side ? "aligned" : "wait"}`}
      >
        <div>
          <span className="eyebrow">{setup?.stance || "WAIT / REVIEW"}</span>
          <h3>
            {setup?.option_selling_side || "No option-selling side selected"}
          </h3>
        </div>
        <ul>
          {(
            setup?.reasons || ["Connect Kite to see the contract and OI read."]
          ).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <p>
          {setup?.risk ||
            "Use a defined-risk paper plan after checking margin and expiry."}
        </p>
      </div>
      {overview?.market_error && (
        <p className="error">{overview.market_error}</p>
      )}
    </section>
  );
}

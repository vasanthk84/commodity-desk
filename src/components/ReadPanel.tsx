import type { Overview } from "../types";
import { timeIST } from "../format";

export function ReadPanel({
  overview,
  onPlan,
}: {
  overview: Overview | null;
  onPlan: () => void;
}) {
  const setup = overview?.setup;
  const read = overview?.market?.future.read;
  const reasons = setup?.reasons || [
    "Kite futures and option OI are unavailable.",
  ];
  return (
    <section className="panel read-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">DECISION SUPPORT</div>
          <h2>Trade review</h2>
        </div>
        <span className="read-time">
          {overview?.market?.future.quote_at
            ? `Quote ${timeIST(overview.market.future.quote_at)}`
            : "No fresh quote"}
        </span>
      </div>
      <div
        className={`review-status ${setup?.option_selling_side ? "aligned" : "wait"}`}
      >
        <span className="review-symbol" aria-hidden="true">
          {setup?.option_selling_side ? "✓" : "!"}
        </span>
        <div>
          <span className="eyebrow">{setup?.stance || "WAIT / REVIEW"}</span>
          <h3>
            {setup?.option_selling_side || "No option-selling side selected"}
          </h3>
          <p>
            {read?.fresh
              ? read.pattern
              : "Last available quote; wait for an updated market quote."}
          </p>
        </div>
      </div>
      <div className="review-evidence">
        <h3>Evidence to check</h3>
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      {setup?.risk && <p className="review-risk">{setup.risk}</p>}
      {overview?.market_error && (
        <p className="error">{overview.market_error}</p>
      )}
      <button className="plan-link" onClick={onPlan}>
        Create a paper plan <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

import { fmt, signed } from "../format";
import type { Overview } from "../types";

interface Point {
  date: string;
  value: number;
}

function TrendLine({
  points,
  tone,
}: {
  points: Point[];
  tone: "price" | "oi";
}) {
  if (points.length < 2) {
    return (
      <div className="trend-empty">Trend appears after Kite history loads.</div>
    );
  }
  const values = points.map((item) => item.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || 1;
  const coords = points.map((item, index) => {
    const x = 12 + (index / (points.length - 1)) * 576;
    const y = 94 - ((item.value - low) / spread) * 72;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div className={`trend-line ${tone}`}>
      <svg
        viewBox="0 0 600 108"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${tone} trend across recent sessions`}
      >
        <path className="trend-guide" d="M12 22H588 M12 58H588 M12 94H588" />
        <polyline
          points={coords.join(" ")}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="trend-axis">
        <span>{points[0].date}</span>
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

export function TrendPanel({ overview }: { overview: Overview | null }) {
  const market = overview?.market;
  const history = market?.history || [];
  const prices = history
    .filter((row) => Number.isFinite(row.close) && row.close > 0)
    .map((row) => ({ date: row.date, value: row.close }));
  const oi = history
    .filter((row) => Number.isFinite(row.oi) && row.oi > 0)
    .map((row) => ({ date: row.date, value: row.oi }));
  return (
    <section className="panel trend-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">MARKET PARTICIPATION</div>
          <h2>Price and open interest</h2>
        </div>
        <span className="pill">RECENT SESSIONS</span>
      </div>
      {market ? (
        <div className="trend-content">
          <div className="trend-heading">
            <span>Latest futures price</span>
            <b className="mono">₹{fmt(market.future.last_price, 2)}</b>
          </div>
          <TrendLine points={prices} tone="price" />
          <div className="trend-heading">
            <span>Futures OI</span>
            <b className="mono">
              {market.future.oi == null ? "—" : fmt(market.future.oi, 0)}
            </b>
          </div>
          <TrendLine points={oi} tone="oi" />
          <div className="trend-metrics">
            <div>
              <span>Price change</span>
              <b className="mono">
                {market.future.read.price_change_pct == null
                  ? "—"
                  : `${signed(market.future.read.price_change_pct, 2)}%`}
              </b>
            </div>
            <div>
              <span>OI change</span>
              <b className="mono">
                {market.future.read.oi_change_pct == null
                  ? "—"
                  : `${signed(market.future.read.oi_change_pct, 2)}%`}
              </b>
            </div>
            <div>
              <span>Put / call OI</span>
              <b className="mono">{market.options.pcr ?? "—"}</b>
            </div>
          </div>
          <p className="fineprint">
            Daily Kite history. OI change compares with the last completed
            candle; PCR covers only displayed option strikes.
          </p>
        </div>
      ) : (
        <div className="trend-unavailable" role="status">
          <strong>Market trend unavailable</strong>
          <p>
            {overview?.market_error ||
              "Waiting for Kite futures history and option OI."}
          </p>
          <small>EIA figures can still load independently.</small>
        </div>
      )}
    </section>
  );
}

import type { Overview, Product } from "../types";
import { fmt, signed } from "../format";

interface Props {
  overview: Overview | null;
  product: Product;
  forecast: string;
  onForecast: (value: string) => void;
  onRefresh: () => void;
}

export function ReportPanel({
  overview,
  product,
  forecast,
  onForecast,
  onRefresh,
}: Props) {
  const eia = overview?.eia;
  const gold = product.startsWith("GOLD");
  const unit = eia?.unit || (product.startsWith("NG") ? "Bcf" : "million bbl");
  const actual = eia?.actual;
  const prior = eia?.previous;
  const surprise =
    actual != null && forecast !== "" && Number.isFinite(Number(forecast))
      ? actual - Number(forecast)
      : null;
  return (
    <section className="panel report-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">SUPPLY / DEMAND CONTEXT</div>
          <h2>
            {gold
              ? "Gold macro context"
              : product.startsWith("NG")
                ? "EIA natural gas storage"
                : "EIA commercial crude stocks"}
          </h2>
        </div>
        <button className="ghost small" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {gold ? (
        <div className="notice">
          EIA gas and crude stock changes do not describe gold demand. Review
          real yields, USD, Fed events and gold-specific supply before forming a
          view. The OI panel still shows gold contract participation.
        </div>
      ) : (
        <>
          <div className="report-cells">
            <div>
              <span>
                ACTUAL <em>EIA</em>
              </span>
              <strong className="mono">
                {actual != null ? signed(actual, 3) : "—"}
              </strong>
              <small>{unit}</small>
            </div>
            <div className="forecast-cell">
              <label htmlFor="forecast">
                FORECAST <em>Calendar</em>
              </label>
              <input
                id="forecast"
                className="mono"
                type="number"
                step="any"
                placeholder="Enter"
                value={forecast}
                onChange={(event) => onForecast(event.target.value)}
                onBlur={onRefresh}
              />
              <small>Consensus estimate</small>
            </div>
            <div>
              <span>
                PREVIOUS <em>EIA</em>
              </span>
              <strong className="mono">
                {prior != null ? signed(prior, 3) : "—"}
              </strong>
              <small>{unit}</small>
            </div>
          </div>
          <p className="report-meaning">
            {surprise == null
              ? "Enter the calendar forecast to compare it with the released number."
              : `Actual is ${fmt(Math.abs(surprise), 3)} ${unit} ${surprise < 0 ? "below" : surprise > 0 ? "above" : "equal to"} forecast.`}
          </p>
          <p className="muted">
            {eia?.week_ending ? `Week ending ${eia.week_ending}. ` : ""}Stock
            change is a balance proxy, not direct demand. EIA API may lag the
            release by up to two hours.
          </p>
          {overview?.eia_error && <p className="error">{overview.eia_error}</p>}
          {eia?.status !== "ok" && (
            <p className="notice">
              {eia?.message || "Official report not loaded."}
            </p>
          )}
          <div className="links">
            <a
              href={
                eia?.schedule ||
                (product.startsWith("NG")
                  ? "https://ir.eia.gov/ngs/schedule.html"
                  : "https://www.eia.gov/petroleum/supply/weekly/schedule.php")
              }
              target="_blank"
              rel="noreferrer"
            >
              Official schedule ↗
            </a>
            <a
              href="https://www.forexfactory.com/calendar"
              target="_blank"
              rel="noreferrer"
            >
              Check consensus on Forex Factory ↗
            </a>
          </div>
        </>
      )}
    </section>
  );
}

import type { Overview, OptionRow } from "../types";
import { fmt, signed, timeIST } from "../format";

interface Props {
  overview: Overview | null;
  expiry: string;
  onExpiry: (value: string) => void;
}

function rowCell(row: OptionRow | undefined) {
  if (!row)
    return (
      <td colSpan={4} className="muted">
        —
      </td>
    );
  return (
    <>
      <td className="mono">{row.oi == null ? "—" : fmt(row.oi, 0)}</td>
      <td className="mono">{signed(row.oi_change, 0)}</td>
      <td className="mono">
        {row.last_price == null ? "—" : fmt(row.last_price, 2)}
      </td>
      <td className="mono">
        {row.bid && row.ask ? `${fmt(row.bid, 2)} / ${fmt(row.ask, 2)}` : "—"}
      </td>
    </>
  );
}

export function ChainPanel({ overview, expiry, onExpiry }: Props) {
  const market = overview?.market;
  const strikes = [
    ...new Set(market?.chain.map((row) => row.strike) || []),
  ].sort((a, b) => a - b);
  return (
    <section className="panel chain-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">SELECTED CONTRACT</div>
          <h2>MCX option OI window</h2>
        </div>
        <label className="expiry-select">
          Expiry{" "}
          <select
            value={expiry || market?.selected_expiry || ""}
            onChange={(event) => onExpiry(event.target.value)}
          >
            {(market?.option_expiries || []).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="summary-strip">
        <span>
          CE OI{" "}
          <b className="mono">
            {market ? fmt(market.options.call_oi, 0) : "—"}
          </b>
        </span>
        <span>
          PE OI{" "}
          <b className="mono">{market ? fmt(market.options.put_oi, 0) : "—"}</b>
        </span>
        <span>
          CE wall <b className="mono">{market?.options.call_wall ?? "—"}</b>
        </span>
        <span>
          PE wall <b className="mono">{market?.options.put_wall ?? "—"}</b>
        </span>
        <span>
          ATM <b className="mono">{market?.atm ?? "—"}</b>
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th colSpan={4}>CALL / CE</th>
              <th>Strike</th>
              <th colSpan={4}>PUT / PE</th>
            </tr>
            <tr>
              <th>OI</th>
              <th>Δ OI*</th>
              <th>LTP</th>
              <th>Bid / Ask</th>
              <th></th>
              <th>OI</th>
              <th>Δ OI*</th>
              <th>LTP</th>
              <th>Bid / Ask</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike) => (
              <tr
                key={strike}
                className={strike === market?.atm ? "atm-row" : ""}
              >
                {rowCell(
                  market?.chain.find(
                    (row) => row.strike === strike && row.type === "CE",
                  ),
                )}
                <td className="strike mono">{fmt(strike, 0)}</td>
                {rowCell(
                  market?.chain.find(
                    (row) => row.strike === strike && row.type === "PE",
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!strikes.length && (
          <div className="empty">
            No option quotes yet. Check Kite connection, commodity symbol and
            expiry.
          </div>
        )}
      </div>
      <p className="fineprint">
        * Option OI change is since this app’s previous refresh for that
        contract. The first refresh establishes a baseline. OI walls and PCR
        cover only the displayed strikes. Quote time:{" "}
        {timeIST(market?.future.quote_at)}.
      </p>
    </section>
  );
}

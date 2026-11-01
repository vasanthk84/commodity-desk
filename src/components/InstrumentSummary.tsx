import { fmt, signed, timeIST } from "../format";
import {
  PRODUCTS,
  type Overview,
  type Product,
  type StripItem,
} from "../types";

interface Props {
  product: Product;
  overview: Overview | null;
  stripItem?: StripItem;
}

export function InstrumentSummary({ product, overview, stripItem }: Props) {
  const label = PRODUCTS.find((item) => item.id === product)?.label || product;
  const future = overview?.product === product ? overview.market?.future : null;
  const change = future?.read.price_change_pct;
  const price = future?.last_price ?? stripItem?.price;
  const oi = future?.oi ?? stripItem?.oi;
  const quoteAt = future?.quote_at || stripItem?.quote_at;
  return (
    <section
      className="instrument-summary"
      aria-label={`${label} contract summary`}
    >
      <div className="instrument-identity">
        <span className="eyebrow">SELECTED MARKET · MCX</span>
        <h1>{label}</h1>
        <p>
          {future?.symbol ||
            stripItem?.symbol ||
            "Futures contract unavailable"}
          {future?.expiry || stripItem?.expiry
            ? ` · Expires ${future?.expiry || stripItem?.expiry}`
            : ""}
          {quoteAt ? ` · Last quote ${timeIST(quoteAt)}` : ""}
        </p>
      </div>
      <div className="instrument-stats">
        <div className="instrument-stat primary-stat">
          <span>Last price</span>
          <strong className="mono">
            {price == null ? "—" : `₹${fmt(price, 2)}`}
          </strong>
          <small className={change == null ? "" : change >= 0 ? "up" : "down"}>
            {change == null
              ? "Change unavailable"
              : `${signed(change, 2)}% vs prior close`}
          </small>
        </div>
        <div className="instrument-stat">
          <span>Futures OI</span>
          <strong className="mono">{oi == null ? "—" : fmt(oi, 0)}</strong>
          <small>
            {future?.read.fresh ? "Current quote" : "Last available quote"}
          </small>
        </div>
        <div className="instrument-stat">
          <span>OI change</span>
          <strong className="mono">
            {future?.read.oi_change_pct == null
              ? "—"
              : `${signed(future.read.oi_change_pct, 2)}%`}
          </strong>
          <small>Vs previous daily candle</small>
        </div>
      </div>
    </section>
  );
}

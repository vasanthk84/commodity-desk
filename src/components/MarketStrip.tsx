import {
  PRODUCTS,
  type Overview,
  type Product,
  type StripItem,
} from "../types";
import { fmt, quoteAgeMinutes, signed, timeIST } from "../format";

interface Props {
  items: StripItem[];
  selected: Product;
  onSelect: (product: Product) => void;
  error: string;
  overview: Overview | null;
  forecast: string;
}

export function MarketStrip({
  items,
  selected,
  onSelect,
  error,
  overview,
  forecast,
}: Props) {
  return (
    <section className="market-grid" aria-label="MCX commodities">
      {PRODUCTS.map((product) => {
        const item = items.find((row) => row.product === product.id);
        const age = quoteAgeMinutes(item?.quote_at);
        const stale = age !== null && age > 15;
        return (
          <button
            key={product.id}
            className={`market-card ${selected === product.id ? "selected" : ""}`}
            onClick={() => onSelect(product.id)}
            aria-pressed={selected === product.id}
          >
            <span className="market-card-head">
              <span className="market-symbol">{product.short}</span>
              <span className="market-selector" aria-hidden="true">
                ↗
              </span>
            </span>
            <span className="market-label">{product.label}</span>
            <strong className="market-price mono">
              {item?.price != null ? `₹${fmt(item.price, 2)}` : "—"}
            </strong>
            <span className="market-card-divider" />
            <span className="market-meta">
              <span>Open interest</span>
              <b className="mono">{item?.oi != null ? fmt(item.oi, 0) : "—"}</b>
            </span>
            <span className="market-bottom">
              <span>{item?.expiry || "No contract"}</span>
              <span className={stale ? "stale" : ""}>
                {item?.quote_at
                  ? `${stale ? "Stale · " : ""}${timeIST(item.quote_at)}`
                  : error
                    ? "Feed unavailable"
                    : "Loading feed"}
              </span>
            </span>
            {selected === product.id &&
              overview?.product === product.id &&
              overview.eia?.status === "ok" && (
                <span className="market-report mono">
                  <span>EIA</span> A{" "}
                  {overview.eia.actual != null
                    ? signed(
                        overview.eia.actual,
                        product.id.startsWith("NG") ? 0 : 2,
                      )
                    : "—"}{" "}
                  · F {forecast || "—"} · P{" "}
                  {overview.eia.previous != null
                    ? signed(
                        overview.eia.previous,
                        product.id.startsWith("NG") ? 0 : 2,
                      )
                    : "—"}
                </span>
              )}
          </button>
        );
      })}
    </section>
  );
}

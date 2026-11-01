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
            <span className="market-name">{product.short}</span>
            <strong className="mono">
              {item?.price != null ? `₹${fmt(item.price, 2)}` : "—"}
            </strong>
            <span className="market-meta">
              OI {item?.oi != null ? fmt(item.oi, 0) : "—"} ·{" "}
              {item?.expiry || "No contract"}
            </span>
            <span className={`market-source ${stale ? "stale" : ""}`}>
              {item?.quote_at
                ? `${stale ? "Last quote" : "Kite"} ${timeIST(item.quote_at)}${stale ? " · stale" : ""}`
                : error
                  ? "Kite unavailable"
                  : "Waiting for Kite"}
            </span>
            {selected === product.id &&
              overview?.product === product.id &&
              overview.eia?.status === "ok" && (
                <span className="market-report mono">
                  A{" "}
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

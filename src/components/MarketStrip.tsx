import { PRODUCTS, type Product, type StripItem } from "../types";
import { fmt, quoteAgeMinutes, timeIST } from "../format";

interface Props {
  items: StripItem[];
  selected: Product;
  onSelect: (product: Product) => void;
  error: string;
}

export function MarketStrip({ items, selected, onSelect, error }: Props) {
  return (
    <section className="market-grid" aria-label="MCX commodities">
      {PRODUCTS.map((product) => {
        const item = items.find((row) => row.product === product.id);
        const age = quoteAgeMinutes(item?.quote_at);
        const older = age !== null && age > 15;
        const ageText =
          age === null
            ? ""
            : age < 60
              ? `${Math.floor(age)}m old`
              : age < 1440
                ? `${Math.floor(age / 60)}h old`
                : `${Math.floor(age / 1440)}d old`;
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
            <span className={`market-source ${older ? "older" : ""}`}>
              {item?.quote_at
                ? `${older ? "Last quote" : "Kite quote"} ${timeIST(item.quote_at)}${older ? ` · ${ageText}` : ""}`
                : error
                  ? "Kite unavailable"
                  : "Waiting for Kite"}
            </span>
          </button>
        );
      })}
    </section>
  );
}

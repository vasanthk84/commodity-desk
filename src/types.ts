export const PRODUCTS = [
  { id: "NG", label: "Natural Gas", short: "NG" },
  { id: "NGM", label: "Natural Gas Mini", short: "NG Mini" },
  { id: "CRUDE", label: "Crude Oil", short: "Crude" },
  { id: "CRUDEM", label: "Crude Oil Mini", short: "Crude Mini" },
  { id: "GOLD", label: "Gold", short: "Gold" },
  { id: "GOLDM", label: "Gold Mini", short: "Gold Mini" },
] as const;

export type Product = (typeof PRODUCTS)[number]["id"];

export interface StripItem {
  product: Product;
  label: string;
  symbol: string | null;
  expiry: string | null;
  price: number | null;
  oi: number | null;
  quote_at: string;
  status: string;
}

export interface OiRead {
  price_change_pct: number | null;
  oi_change_pct: number | null;
  prior_oi: number | null;
  pattern: string;
  direction: "bullish" | "bearish" | "mixed";
  quote_age_minutes: number | null;
  fresh: boolean;
}

export interface OptionRow {
  symbol: string;
  strike: number;
  type: "CE" | "PE";
  oi: number | null;
  oi_change: number | null;
  baseline_at: string | null;
  last_price: number | null;
  volume: number | null;
  bid: number | null;
  ask: number | null;
  quote_at: string;
}

export interface Overview {
  product: Product;
  label: string;
  as_of: string;
  market_error: string | null;
  eia_error: string | null;
  eia: null | {
    status: string;
    message?: string;
    kind?: string;
    week_ending?: string;
    actual?: number;
    previous?: number | null;
    unit?: string;
    source?: string;
    schedule?: string;
    note?: string;
  };
  market: null | {
    future: {
      symbol: string;
      expiry: string;
      lot_size: number;
      last_price: number;
      oi: number | null;
      volume: number | null;
      quote_at: string;
      read: OiRead;
    };
    option_expiries: string[];
    selected_expiry: string;
    atm: number | null;
    chain: OptionRow[];
    options: {
      call_oi: number;
      put_oi: number;
      pcr: number | null;
      call_wall: number | null;
      put_wall: number | null;
      has_baseline: boolean;
      note: string;
    };
    history: { date: string; close: number; oi: number; volume: number }[];
    source: string;
  };
  setup: null | {
    stance: string;
    option_selling_side: string | null;
    reasons: string[];
    risk: string;
  };
}

export interface PaperPlan {
  id: string;
  created_at: string;
  product: Product;
  expiry: string;
  structure: "PUT_CREDIT" | "CALL_CREDIT";
  short_strike: number;
  long_strike: number;
  lots: number;
  lot_size: number;
  credit: number;
  max_profit: number;
  max_loss: number;
  capital: number;
  rationale: string;
  status: "OPEN" | "CLOSED";
  exit_debit?: number;
  closed_at?: string;
}

import { useState } from "react";
import type { Overview, PaperPlan, Product } from "../types";
import { fmt, timeIST } from "../format";

interface Props {
  product: Product;
  overview: Overview | null;
  capital: number;
  plans: PaperPlan[];
  onSave: (plan: PaperPlan) => void;
  onClose: (id: string, debit: number) => void;
}

export function PaperPlans({
  product,
  overview,
  capital,
  plans,
  onSave,
  onClose,
}: Props) {
  const market = overview?.market;
  const [structure, setStructure] = useState<"PUT_CREDIT" | "CALL_CREDIT">(
    "PUT_CREDIT",
  );
  const [shortStrike, setShortStrike] = useState("");
  const [longStrike, setLongStrike] = useState("");
  const [credit, setCredit] = useState("");
  const [lots, setLots] = useState("1");
  const [rationale, setRationale] = useState("");
  const [message, setMessage] = useState("");
  const width = Math.abs(Number(shortStrike) - Number(longStrike));
  const lotSize = market?.future.lot_size || 0;
  const maxLoss = (width - Number(credit)) * lotSize * Number(lots);
  const maxProfit = Number(credit) * lotSize * Number(lots);
  const riskPct = capital > 0 ? (maxLoss / capital) * 100 : 0;
  const validShape =
    structure === "PUT_CREDIT"
      ? Number(shortStrike) > Number(longStrike)
      : Number(shortStrike) < Number(longStrike);
  const strikes = [
    ...new Set(market?.chain.map((row) => row.strike) || []),
  ].sort((a, b) => a - b);
  const current = plans.filter((plan) => plan.status === "OPEN");
  const past = plans.filter((plan) => plan.status === "CLOSED");

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!market || !market.future.read.fresh)
      return setMessage(
        "Refresh a live MCX quote before saving a new paper plan.",
      );
    if (
      !strikes.includes(Number(shortStrike)) ||
      !strikes.includes(Number(longStrike)) ||
      !validShape ||
      !width ||
      !Number.isFinite(maxLoss) ||
      maxLoss <= 0 ||
      !Number.isInteger(Number(lots)) ||
      Number(lots) < 1 ||
      Number(credit) <= 0 ||
      Number(credit) >= width
    )
      return setMessage(
        "Check contract strikes, spread direction, width, credit and whole-number lots.",
      );
    if (riskPct > 2)
      return setMessage(
        "Max loss exceeds 2% of paper capital. Reduce width or lots.",
      );
    if (!rationale.trim())
      return setMessage("Write why this spread is being considered.");
    onSave({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      product,
      expiry: market.selected_expiry,
      structure,
      short_strike: Number(shortStrike),
      long_strike: Number(longStrike),
      lots: Number(lots),
      lot_size: lotSize,
      credit: Number(credit),
      max_profit: maxProfit,
      max_loss: maxLoss,
      capital,
      rationale: rationale.trim(),
      status: "OPEN",
    });
    setMessage("Paper plan saved. No order was sent to Kite.");
    setShortStrike("");
    setLongStrike("");
    setCredit("");
    setRationale("");
  }

  function close(plan: PaperPlan) {
    const answer = window.prompt(
      "Exit debit per unit of premium? Enter the fill you observed.",
    );
    if (answer === null) return;
    const debit = Number(answer);
    if (!Number.isFinite(debit) || debit < 0)
      return setMessage("Enter a valid exit debit.");
    onClose(plan.id, debit);
  }

  return (
    <div className="plans-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">PAPER ONLY</div>
            <h2>Defined-risk credit spread</h2>
          </div>
          <span className="pill warn">NO LIVE ORDERS</span>
        </div>
        <p className="muted">
          Use contract strikes to plan a small option-selling position. Credit
          is entered manually from observed quotes. Verify broker margin,
          bid/ask and exit liquidity separately.
        </p>
        <form onSubmit={save} className="plan-form">
          <label>
            Structure
            <select
              value={structure}
              onChange={(event) =>
                setStructure(event.target.value as typeof structure)
              }
            >
              <option value="PUT_CREDIT">Sell put + buy lower put</option>
              <option value="CALL_CREDIT">Sell call + buy higher call</option>
            </select>
          </label>
          <label>
            Short strike
            <select
              value={shortStrike}
              onChange={(event) => setShortStrike(event.target.value)}
            >
              <option value="">Choose</option>
              {strikes.map((strike) => (
                <option key={strike}>{strike}</option>
              ))}
            </select>
          </label>
          <label>
            Long strike
            <select
              value={longStrike}
              onChange={(event) => setLongStrike(event.target.value)}
            >
              <option value="">Choose</option>
              {strikes.map((strike) => (
                <option key={strike}>{strike}</option>
              ))}
            </select>
          </label>
          <label>
            Net credit / unit
            <input
              type="number"
              min="0"
              step="any"
              value={credit}
              onChange={(event) => setCredit(event.target.value)}
              placeholder="Short bid − long ask"
            />
          </label>
          <label>
            Lots
            <input
              type="number"
              min="1"
              step="1"
              value={lots}
              onChange={(event) => setLots(event.target.value)}
            />
          </label>
          <label className="full">
            Why this setup?
            <textarea
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              placeholder="EIA surprise, price/OI pattern, invalidation, event risk"
            />
          </label>
          <div className="plan-math full">
            <span>
              Max profit (gross){" "}
              <b>
                ₹
                {Number.isFinite(maxProfit)
                  ? fmt(Math.max(0, maxProfit), 0)
                  : "—"}
              </b>
            </span>
            <span>
              Max loss (gross){" "}
              <b>
                ₹{Number.isFinite(maxLoss) ? fmt(Math.max(0, maxLoss), 0) : "—"}
              </b>
            </span>
            <span>
              Capital at risk{" "}
              <b>
                {Number.isFinite(riskPct) ? fmt(Math.max(0, riskPct), 2) : "—"}%
              </b>
            </span>
          </div>
          <p className="fineprint full">
            Gross payoff excludes brokerage, taxes, slippage and margin.
            Expiry/exercise can create futures exposure; verify with your
            broker.
          </p>
          {message && (
            <p className="notice full" role="status">
              {message}
            </p>
          )}
          <button className="full" type="submit">
            Save paper plan
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">YOUR REVIEW</div>
            <h2>Spread journal</h2>
          </div>
          <span className="pill">{current.length} open</span>
        </div>
        {[...current, ...past].length ? (
          [...current, ...past].map((plan) => (
            <div className="plan-row" key={plan.id}>
              <div>
                <b>
                  {plan.product} ·{" "}
                  {plan.structure === "PUT_CREDIT" ? "Put" : "Call"} credit
                  spread
                </b>
                <small>
                  {plan.short_strike} / {plan.long_strike} · {plan.lots} lot ·{" "}
                  {plan.expiry} · {timeIST(plan.created_at)}
                </small>
                <p>{plan.rationale}</p>
                <small>
                  Credit {fmt(plan.credit, 2)} · Max loss ₹
                  {fmt(plan.max_loss, 0)}{" "}
                  {plan.status === "CLOSED" && plan.exit_debit != null
                    ? `· Exit debit ${fmt(plan.exit_debit, 2)} · Gross P&L ₹${fmt((plan.credit - plan.exit_debit) * plan.lot_size * plan.lots, 0)}`
                    : ""}
                </small>
              </div>
              {plan.status === "OPEN" ? (
                <button className="ghost small" onClick={() => close(plan)}>
                  Close paper plan
                </button>
              ) : (
                <span className="pill">CLOSED</span>
              )}
            </div>
          ))
        ) : (
          <div className="empty">No paper spread plans yet.</div>
        )}
      </section>
    </div>
  );
}

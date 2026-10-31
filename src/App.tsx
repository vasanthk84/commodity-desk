import { useCallback, useEffect, useState } from "react";
import { fetchOverview, fetchStrip } from "./api";
import { nextReport } from "./calendar";
import { ChainPanel } from "./components/ChainPanel";
import { LegacyJournal } from "./components/LegacyJournal";
import { LegacyReports } from "./components/LegacyReports";
import { MarketStrip } from "./components/MarketStrip";
import { PaperPlans } from "./components/PaperPlans";
import { ReadPanel } from "./components/ReadPanel";
import { ReportPanel } from "./components/ReportPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { timeIST } from "./format";
import { readLocal, reportId, writeLocal } from "./storage";
import type { Overview, PaperPlan, Product, StripItem } from "./types";

type Tab = "desk" | "chain" | "reports" | "plans" | "settings";
type ForecastEntry = { week: string; value: string };

export function App() {
  const [tab, setTab] = useState<Tab>("desk");
  const [product, setProduct] = useState<Product>("NG");
  const [expiry, setExpiry] = useState("");
  const [strip, setStrip] = useState<StripItem[]>([]);
  const [stripError, setStripError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const [eiaKey, setEiaKey] = useState(() => readLocal("eia-key", ""));
  const [capital, setCapital] = useState(() => readLocal("capital", 500000));
  const [plans, setPlans] = useState<PaperPlan[]>(() => readLocal("plans", []));
  const [legacyTrades, setLegacyTrades] = useState<Record<string, unknown>[]>(
    () => readLocal("legacy-trades", []),
  );
  const [legacyLogs, setLegacyLogs] = useState<
    Record<string, Record<string, unknown>>
  >(() => readLocal("legacy-logs", {}));
  const [forecasts, setForecasts] = useState<Record<string, ForecastEntry>>(
    () => readLocal("forecasts", {}),
  );
  const reportWeek =
    overview?.product === product ? overview.eia?.week_ending || "" : "";
  const forecastKey = reportWeek ? reportId(product, reportWeek) : "";
  const forecast = forecastKey ? forecasts[forecastKey]?.value || "" : "";

  const refresh = useCallback(() => setRefreshId((value) => value + 1), []);
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") refresh();
      },
      5 * 60 * 1000,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    writeLocal("eia-key", eiaKey);
  }, [eiaKey]);
  useEffect(() => {
    writeLocal("capital", capital);
  }, [capital]);
  useEffect(() => {
    writeLocal("plans", plans);
  }, [plans]);
  useEffect(() => {
    writeLocal("legacy-trades", legacyTrades);
  }, [legacyTrades]);
  useEffect(() => {
    writeLocal("legacy-logs", legacyLogs);
  }, [legacyLogs]);
  useEffect(() => {
    writeLocal("forecasts", forecasts);
  }, [forecasts]);
  useEffect(() => {
    let active = true;
    fetchStrip()
      .then((data) => {
        if (active) {
          setStrip(data.items);
          setStripError("");
        }
      })
      .catch((error) => {
        if (active) {
          setStrip([]);
          setStripError(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [refreshId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const prior = forecastKey ? forecasts[forecastKey] : undefined;
    fetchOverview(product, expiry, prior?.value || "", eiaKey)
      .then((data) => {
        if (active) {
          setOverview(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setOverview({
            product,
            label: product,
            as_of: new Date().toISOString(),
            market: null,
            market_error: error.message,
            eia: null,
            eia_error: null,
            setup: null,
          });
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // Forecast is committed when the user leaves its field; avoid a Kite request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, expiry, eiaKey, refreshId]);
  useEffect(() => {
    if (
      forecastKey &&
      forecast &&
      overview?.setup?.reasons.some((reason) =>
        reason.startsWith("Enter a market consensus"),
      )
    )
      refresh();
    // Apply a previously saved forecast once the EIA week is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastKey]);

  function chooseProduct(value: Product) {
    setProduct(value);
    setExpiry("");
    setTab("desk");
  }
  function chooseExpiry(value: string) {
    setExpiry(value);
    setTab("chain");
  }
  function changeForecast(value: string) {
    if (!forecastKey) return;
    setForecasts((previous) => ({
      ...previous,
      [forecastKey]: { week: reportWeek, value },
    }));
  }
  function savePlan(plan: PaperPlan) {
    setPlans((previous) => [plan, ...previous]);
  }
  function closePlan(id: string, debit: number) {
    setPlans((previous) =>
      previous.map((plan) =>
        plan.id === id
          ? {
              ...plan,
              status: "CLOSED",
              exit_debit: debit,
              closed_at: new Date().toISOString(),
            }
          : plan,
      ),
    );
  }
  function importBackup(value: unknown): string {
    if (!value || typeof value !== "object")
      throw new Error("Invalid JSON backup.");
    const data = value as Record<string, unknown>;
    if (
      data.version === 1 &&
      Array.isArray(data.trades) &&
      data.logs &&
      typeof data.logs === "object"
    ) {
      setLegacyTrades(data.trades as Record<string, unknown>[]);
      setLegacyLogs(data.logs as Record<string, Record<string, unknown>>);
      return `Imported ${data.trades.length} earlier paper trades and ${Object.keys(data.logs).length} report logs.`;
    }
    if (
      data.version === 2 &&
      Array.isArray(data.plans) &&
      Array.isArray(data.legacyTrades)
    ) {
      if (
        !window.confirm(
          "Replace current paper plans and imported history with this backup?",
        )
      )
        return "Import cancelled.";
      setPlans(data.plans as PaperPlan[]);
      setLegacyTrades(data.legacyTrades as Record<string, unknown>[]);
      setLegacyLogs(
        (data.legacyLogs && typeof data.legacyLogs === "object"
          ? data.legacyLogs
          : {}) as Record<string, Record<string, unknown>>,
      );
      setForecasts(
        (data.forecasts && typeof data.forecasts === "object"
          ? data.forecasts
          : {}) as Record<string, ForecastEntry>,
      );
      if (
        typeof data.capital === "number" &&
        Number.isFinite(data.capital) &&
        data.capital > 0
      )
        setCapital(data.capital);
      return "Commodity Desk backup restored. The EIA key remains local to this browser.";
    }
    throw new Error(
      "Choose a Commodity Desk JSON export or the earlier HTML desk export.",
    );
  }
  const gasNext = nextReport("gas");
  const crudeNext = nextReport("crude");
  const kiteError = overview?.market_error || stripError;
  const kiteLabel = overview?.market
    ? overview.market.future.read.fresh
      ? "KITE LIVE"
      : "KITE CONNECTED · QUOTE STALE"
    : /denied|permission|403/i.test(kiteError)
      ? "KITE ACCESS DENIED"
      : /expired|token/i.test(kiteError)
        ? "KITE TOKEN EXPIRED"
        : loading
          ? "KITE CHECKING"
          : "KITE UNAVAILABLE";

  return (
    <div className="app-shell">
      <div className="workspace-header">
        <div className="topbar">
          <div className="brand">
            <span className="brand-mark">CD</span>
            <div>
              <b>Commodity Desk</b>
              <small>MCX · Market & paper options</small>
            </div>
          </div>
          <div className="top-actions">
            <span
              className={`connection ${overview?.market?.future.read.fresh ? "on" : "off"}`}
            >
              {kiteLabel}
            </span>
            <button
              className="ghost"
              onClick={() => {
                const next =
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark";
                document.documentElement.dataset.theme = next;
                writeLocal("theme", next);
              }}
              aria-label="Toggle light and dark theme"
            >
              ◐
            </button>
          </div>
        </div>
        <nav className="workspace-nav" aria-label="Workspace sections">
          {(
            [
              ["desk", "Market desk"],
              ["chain", "Option OI"],
              ["reports", "EIA reports"],
              ["plans", "Paper plans"],
              ["settings", "Settings"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      <main className="content">
        <div className="page-head">
          <div>
            <span className="eyebrow">MCX / COMMODITY WORKSPACE</span>
            <h1>
              {tab === "desk"
                ? "Market desk"
                : tab === "chain"
                  ? "Option OI"
                  : tab === "reports"
                    ? "EIA report context"
                    : tab === "plans"
                      ? "Paper spread plans"
                      : "Settings & backup"}
            </h1>
            <p>
              {tab === "desk"
                ? "Read the contract, inventory release and OI pattern at a glance."
                : tab === "plans"
                  ? "Plan small defined-risk option sales without placing an order."
                  : "Review the evidence and its source before deciding."}
            </p>
          </div>
          <div className="page-actions">
            <span className="date-stamp">
              {timeIST(new Date().toISOString())}
            </span>
            <button onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "↻ Refresh data"}
            </button>
          </div>
        </div>
        {tab !== "settings" && (
          <MarketStrip
            items={strip}
            selected={product}
            onSelect={chooseProduct}
            error={stripError}
            overview={overview}
            forecast={forecast}
          />
        )}
        {stripError && tab !== "settings" && (
          <div className="notice warn-note">
            {stripError} The EIA panel can still load independently.
          </div>
        )}
        {tab === "desk" && (
          <>
            <div className="desk-grid">
              <ReportPanel
                overview={overview}
                product={product}
                forecast={forecast}
                onForecast={changeForecast}
                onRefresh={refresh}
              />
              <ReadPanel overview={overview} />
            </div>
            <section className="panel next-panel">
              <div className="panel-head">
                <div>
                  <div className="eyebrow">UPCOMING RELEASES</div>
                  <h2>Check official schedules</h2>
                </div>
              </div>
              <div className="next-grid">
                <div>
                  <b>Natural gas storage</b>
                  <span>{gasNext ? timeIST(gasNext.when) : "—"}</span>
                  <a href={gasNext?.source} target="_blank" rel="noreferrer">
                    Verify EIA schedule ↗
                  </a>
                </div>
                <div>
                  <b>Weekly petroleum</b>
                  <span>{crudeNext ? timeIST(crudeNext.when) : "—"}</span>
                  <a href={crudeNext?.source} target="_blank" rel="noreferrer">
                    Verify EIA schedule ↗
                  </a>
                </div>
              </div>
              <p className="fineprint">
                Times are converted from U.S. Eastern time to IST. Holiday
                changes may override the recurring time; use the linked official
                schedule.
              </p>
            </section>
          </>
        )}
        {tab === "chain" && (
          <ChainPanel
            overview={overview}
            expiry={expiry}
            onExpiry={chooseExpiry}
          />
        )}
        {tab === "reports" && (
          <>
            <div className="reports-grid">
              <ReportPanel
                overview={overview}
                product={product}
                forecast={forecast}
                onForecast={changeForecast}
                onRefresh={refresh}
              />
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">INTERPRETATION</div>
                    <h2>What the report can and cannot say</h2>
                  </div>
                </div>
                <p>
                  Positive stock change means an inventory build; negative
                  change means a draw. The surprise is Actual minus market
                  Forecast in the same units.
                </p>
                <p>
                  A build larger than forecast can pressure prices, but weather,
                  exports, production, positioning and MCX currency effects can
                  dominate the immediate move. Wait for the reaction in price
                  and OI.
                </p>
                <div className="notice">
                  EIA reports actual inventories. Its API does not provide Forex
                  Factory's consensus forecast. Enter that separately from the
                  calendar you use.
                </div>
              </section>
            </div>
            <LegacyReports logs={legacyLogs} />
          </>
        )}
        {tab === "plans" && (
          <>
            <PaperPlans
              product={product}
              overview={overview}
              capital={capital}
              plans={plans}
              onSave={savePlan}
              onClose={closePlan}
            />
            <LegacyJournal trades={legacyTrades} />
          </>
        )}
        {tab === "settings" && (
          <SettingsPanel
            eiaKey={eiaKey}
            setEiaKey={setEiaKey}
            capital={capital}
            setCapital={setCapital}
            plans={plans}
            legacyTrades={legacyTrades}
            legacyLogs={legacyLogs}
            forecasts={forecasts}
            onImport={importBackup}
          />
        )}
      </main>
      <footer>
        Read-only market research · Paper plans only · No live orders · Not
        financial advice
      </footer>
    </div>
  );
}

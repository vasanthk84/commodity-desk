import { useRef, useState } from "react";
import { downloadJson } from "../storage";
import type { PaperPlan } from "../types";

interface Props {
  eiaKey: string;
  setEiaKey: (key: string) => void;
  capital: number;
  setCapital: (value: number) => void;
  plans: PaperPlan[];
  legacyTrades: Record<string, unknown>[];
  legacyLogs: Record<string, Record<string, unknown>>;
  forecasts: Record<string, { week: string; value: string }>;
  onImport: (backup: unknown) => string;
}

export function SettingsPanel({
  eiaKey,
  setEiaKey,
  capital,
  setCapital,
  plans,
  legacyTrades,
  legacyLogs,
  forecasts,
  onImport,
}: Props) {
  const [draftKey, setDraftKey] = useState(eiaKey);
  const [draftCapital, setDraftCapital] = useState(String(capital));
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      setMessage(onImport(parsed));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    }
  }

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">DATA SOURCES</div>
            <h2>Connections</h2>
          </div>
        </div>
        <div className="settings-field">
          <label htmlFor="eia-key">EIA API key</label>
          <input
            id="eia-key"
            type="password"
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            autoComplete="off"
            placeholder="Paste your free key"
          />
          <small>
            Optional when the server has a private EIA key. A key entered here
            stays in this browser and is excluded from JSON exports.
          </small>
          <button
            onClick={() => {
              setEiaKey(draftKey.trim());
              setMessage("EIA key saved for this browser.");
            }}
          >
            Save EIA key
          </button>
        </div>
        <div className="notice">
          <b>Kite connection</b>
          <p>
            The backend uses Stock Basket's Kite API key and reads the refreshed
            access token from OI Analyzer's environment. Run Kite Token Refresh
            in OI Analyzer when the session expires. This app has no order endpoint.
          </p>
        </div>
        <div className="links">
          <a
            href="https://www.eia.gov/opendata/"
            target="_blank"
            rel="noreferrer"
          >
            EIA Open Data ↗
          </a>
          <a
            href="https://kite.trade/docs/connect/v3/"
            target="_blank"
            rel="noreferrer"
          >
            Kite Connect docs ↗
          </a>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">PAPER CAPITAL & DATA</div>
            <h2>Journal settings</h2>
          </div>
        </div>
        <div className="settings-field">
          <label htmlFor="capital">Paper capital ₹</label>
          <input
            id="capital"
            type="number"
            min="1"
            value={draftCapital}
            onChange={(event) => setDraftCapital(event.target.value)}
          />
          <small>
            Paper spread plans cannot exceed 2% of this value in calculated
            gross max loss.
          </small>
          <button
            onClick={() => {
              const value = Number(draftCapital);
              if (Number.isFinite(value) && value > 0) {
                setCapital(value);
                setMessage("Paper capital saved.");
              } else setMessage("Enter a valid amount.");
            }}
          >
            Save capital
          </button>
        </div>
        <div className="settings-field">
          <b>Backups</b>
          <div className="actions">
            <button
              className="ghost"
              onClick={() =>
                downloadJson(
                  `commodity-desk-${new Date().toISOString().slice(0, 10)}.json`,
                  { version: 2, plans, legacyTrades, legacyLogs, forecasts, capital },
                )
              }
            >
              Export JSON
            </button>
            <button className="ghost" onClick={() => input.current?.click()}>
              Import JSON
            </button>
            <input
              ref={input}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBackup(file);
                event.target.value = "";
              }}
            />
          </div>
          <small>
            Import a previous HTML journal or restore this app's JSON backup.
            The EIA key stays in browser storage and is never exported.
          </small>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}

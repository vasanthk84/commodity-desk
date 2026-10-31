# Commodity Desk

Local React + Flask workspace for reading MCX commodity contracts and planning paper option credit spreads. It follows the Stock Basket / OI Analyzer visual pattern and does not send orders.

## Start on this Windows machine

Double-click `start.bat` or run it from a terminal. It creates missing local dependencies, opens separate API and UI windows, and opens <http://127.0.0.1:4174/>. Close both service windows to stop the app.

To start the two services manually, open two PowerShell terminals in `D:\ReactApp\commodity-desk`:

```powershell
.\.venv\Scripts\python.exe -m backend.app
```

```powershell
npm run dev
```

Open <http://127.0.0.1:4174/>. The API uses `127.0.0.1:5004` and is proxied by Vite.

For a fresh checkout, run `py -3 -m venv .venv`, `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`, and `npm install` first.

## Deploy to the Stock Basket DigitalOcean server

The GitHub Actions workflow in `.github/workflows/deploy.yml` tests, builds and deploys every push to `main`; it can also be run manually from **Actions → Deploy Commodity Desk to DigitalOcean**. Its repository `SSH_PRIVATE_KEY` secret uses a dedicated deploy key authorized on the server. The server retains `/opt/commodity-desk/.env`, so the EIA key never enters GitHub Actions or the release archive. Wait for the workflow's production checks to pass before using the new URL.

`deploy.ps1` builds and tests locally, packages only the UI, Python API and deployment files, then deploys to `https://165.227.84.87/commodity-desk/`. It preserves server-side option OI snapshots. The release archive excludes secrets. On the first deployment, the script transfers the ignored local `.env` containing `EIA_API_KEY` over SSH into a private server file; later deployments preserve that server file. Browser data is never uploaded. Use `./deploy.ps1 -BuildOnly` to verify the release without contacting the server.

The first deployment needs these server prerequisites:

1. Stock Basket must already be installed at `/opt/stock-basket/.env`, with its `OI_ANALYZER_ENV_PATH` pointing to the OI Analyzer environment. On this server that source is `/opt/oi-analyzer/.env`. Commodity Desk reads Stock Basket's Kite API key and prefers OI Analyzer's refreshed access token, just as Stock Basket does. It validates that the API keys match and falls back to Stock Basket's token if needed. The API runs as root to read the private files.
2. Create `/etc/nginx/.commodity-desk.htpasswd` with a private HTTP Basic user and password, for example with `sudo htpasswd -c /etc/nginx/.commodity-desk.htpasswd vasanth`. Do not put the password in the project.
3. In the existing HTTPS server block at `/etc/nginx/sites-available/oi-analyzer-https`, add `include /etc/nginx/snippets/commodity-desk-api.conf;` and `include /etc/nginx/snippets/commodity-desk-ui.conf;`. Create empty files at those two snippet paths before adding the includes, then validate Nginx. The deploy script replaces the snippets with protected routes and checks Nginx again.

With SSH access to `root@165.227.84.87`, run `./deploy.ps1` from PowerShell. The script refuses to publish if the password file, server Kite environment or Nginx includes are missing. Both the UI and API require the same HTTP Basic login. The private server EIA key loads official reports automatically; a browser key entered in Settings can override it.

## Connections

- The backend reads the Kite API key from `D:\stock-basket\.env` locally and prefers the matching OI Analyzer token from `OI_ANALYZER_ENV_PATH` in that file. On DigitalOcean, the service points directly to `/opt/oi-analyzer/.env`. Set `KITE_SOURCE_ENV` and optionally `OI_ANALYZER_ENV_PATH` for another installation. Credentials are never placed in React source or browser storage.
- Kite access tokens expire daily. Run **Kite Token Refresh** in OI Analyzer and select **Refresh data** here. Commodity Desk reads the token file again on each request; it does not require a restart.
- The backend uses `EIA_API_KEY` from its ignored, private `.env` file, so reports load without entering a key in each browser. A key entered in **Settings** overrides it for that browser and is excluded from JSON backups. Neither key is bundled into the React build or release archive.
- Forex Factory consensus forecasts are entered manually. EIA supplies official inventory stock levels, not market consensus forecasts. The app calculates Actual and Previous weekly changes from those levels.

## How to read the desk

1. Select Natural Gas, Natural Gas Mini, Crude Oil, Crude Oil Mini, Gold or Gold Mini. The six top cards show the current Kite futures quote and total futures OI when connected.
2. The selected commodity shows the exact futures symbol, quote time, price change from prior close, and futures OI change from the last completed daily candle. The option chain shows a limited strike window around the futures price.
3. Option OI change uses the previous refresh saved by this app as its baseline. It is not yesterday's OI. Refresh again later to establish a meaningful comparison.
4. For gas and crude, enter a consensus forecast in the same unit as the EIA report. Inventory surprise is Actual minus Forecast. A larger stock build can indicate a looser balance, while a larger draw can indicate a tighter one; other factors can dominate price.
5. The conditional read offers a **defined-risk spread side to review** only when fresh price, futures OI, option liquidity, an OI baseline and inventory comparison align. It shows **Wait / Review** if required evidence is missing or conflicts. Gold stays in review because this app does not load the necessary rates and dollar context.
6. **Paper plans** records credit spreads with gross max profit and loss and a 2% paper-capital limit. You must check broker margin, costs, execution, contract specifications and expiry/exercise risk. No trade is sent to Kite.

The EIA API may update up to two hours after the 10:30 ET report release. The official schedule links should be checked for holiday changes. Kite's futures and option instruments come from its current MCX instrument master.

## Data and backups

Paper spread plans, forecasts and earlier imported journal records live in this browser. Export JSON from Settings regularly. The import accepts a previous single-file Commodity Paper Trading Desk backup and stores its bought-option trades and report notes as read-only history.

The backend stores option OI refresh baselines in `data/oi_snapshots.sqlite3`. This file is local, ignored by Git, and contains symbols, OI and timestamps only. It stores no credentials or account positions.

## Validation

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
npm run build
```

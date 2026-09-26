# Architect integration: observed data, paper decisions

Reviewed against Hummingbot commit `9af100d6822da7d2d0291a906c730ef172284ee2` (see `evidence/hummingbot-pin.json`).

The new `scripts/architect_compute_monitor.py` is a StrategyV2 script that declares `UNG-USD` on `architect_perpetual_sandbox` by default. `ArchitectMarketReader` calls that connector's `_api_get` with `/api/book`, native symbols and authentication enabled. This reuses the official connector's authentication and rate limiting rather than inventing an exchange credential format.

## Install in an existing Hummingbot environment

Copy these files to its `scripts/` directory:

- `architect_compute_monitor.py`
- `architect_market_reader.py`
- `energy_compute_core.py`

In Hummingbot:

```
connect architect_perpetual_sandbox
create --script-config architect_compute_monitor
start --script architect_compute_monitor.py --conf <the-generated-config.yml>
status
```

Use sandbox credentials for the sandbox connector. For an authorized production data session, use `connect architect_perpetual` and set `connector_name: architect_perpetual` in the generated config. Key management remains in Hummingbot. No keys go in this repository.

The script samples every 60 seconds after the connector is ready. It saves paired native book quotes to `data/architect-quotes.csv`, and displays paper model status. Import that file using the dashboard. The official connector may require account connectivity/readiness even though this script only reads books. Sandbox may not offer the compute symbol; missing books stop sampling rather than substitute prices. Existing CSV data is for analysis; the paper engine does not resume old positions after restart.

**Critical boundary:** the official symbol mapper accepts perpetuals and skips the dated GPU future. This monitor bypasses that mapper only for a native-symbol **read**. It does not extend perpetual execution to futures, validate margin, manage expiry or handle partial fills. No `buy`, `sell` or executor-creation call exists in this script. Do not rename a dated future to a perpetual.

The helper has asynchronous contract tests against a mocked connector, and the script has been syntax checked. Hummingbot is not installed in the development environment, so a full authenticated runtime smoke test remains outstanding. To validate it, run sandbox with appropriate credentials; inspect the saved timestamps, spreads, sizes and instrument identities; stop the script and confirm no orders were sent. Do not enable orders as part of that check.

## Node.js alternative

```
npm run collect -- --once
npm run collect
npm run replay -- output/architect-quotes.csv
```

`.env.local` supplies optional server-side credentials. The collector's auth request and book schema match the pinned Hummingbot connector. It uses polling, not websockets, has no order endpoints and records snapshots only. Ctrl+C stops it. Both replay engines produce equivalent decisions and P&L for all committed test scenarios.

## Before live execution

Dated-futures connector support must include expiry/settlement, margin checks, correct multipliers, partial-fill handling, position reconciliation, persistence, and a kill switch. Model validation must establish whether the pair is meaningful after actual costs. Neither is established by these demo tests.

Sources:
- https://hummingbot.org/exchanges/architect/
- https://github.com/hummingbot/hummingbot/tree/9af100d6822da7d2d0291a906c730ef172284ee2/hummingbot/connector/derivative/architect_perpetual

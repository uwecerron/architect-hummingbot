# Traders Guild: energy / compute research starter

An open research lab with a Vercel-ready interactive dashboard, equivalent Python and Node.js paper engines, and a read-only monitor using Hummingbot's official Architect connector. **No live orders or deposits.** This is an experiment in relative pricing, not a proven arbitrage or calibrated datacenter hedge.

[Open the demo](https://guild-compute-energy-lab.vercel.app/) · [Read the trade thesis](https://guild-compute-energy-lab.vercel.app/thesis.html)

## Dashboard and Node.js

```sh
npm ci
npm run dev
# http://127.0.0.1:4180
npm test
npm run build
npm run replay -- data/SYNTHETIC_demo.csv
```

The dashboard includes three clearly labeled synthetic scenarios, adjustable notional/beta/costs, replay scrubbing, signal and P&L charts, an event ledger, local CSV import/export, a read-only book snapshot API and a research thesis. No credentials are needed for the demo. It does not run an always-on trading process on Vercel.

- [Vercel and environment setup](docs/DEPLOYMENT.md)
- [Hummingbot and Node market-data collectors](docs/HUMMINGBOT.md)
- [Trade thesis and falsification criteria](public/thesis.md)

## Run the original Python replay

Python 3.10+; the standalone engine uses only the standard library.

```sh
cd /Users/uwecerron/architect_algorithmic
python3 make_demo.py
python3 replay.py data/SYNTHETIC_demo.csv
python3 -m unittest discover -s tests -v
```

`output/replay.csv` records each observation's signal, paper contracts, realized P&L and open liquidation P&L. The included demo is entirely synthetic and tests plumbing only. Do not publish its returns as strategy performance. No historical trading edge has been established.

## Trade hypothesis

Study whether GPU rental futures become unusually expensive or cheap relative to gas exposure, then test whether that deviation subsequently narrows. Energy price increases could pressure compute-provider margins, but gas and compute need not mean-revert. Power procurement, location, hardware supply and demand, GPU generation and financing can dominate.

The research residual is `log(compute price) - beta * log(energy price)`. Each observation is compared against the preceding 60 observations, excluding itself. With minute observations this is roughly one hour, NOT 60 days. Default beta=1 is an explicit starting assumption, not a regression result or physical conversion factor.

* z >= 2: paper short compute, long energy.
* z <= -2: paper long compute, short energy.
* Close near the mean (|z| <= 0.5) or when the residual crosses the mean.
* Close at |z| >= 4, after 24 hours, or when cumulative realized plus open liquidation P&L reaches a $500 loss.
* At least 5 minutes between closing and opening. Entries beyond the stop threshold are skipped.

Compute exposure targets $10,000 before integer contract rounding. The energy leg is sized against the rounded compute exposure times beta. Defaults assume USD quotes and no FX conversion. The 730-hour compute multiplier is applied to both sizing and P&L. Integer contract rounding can create residual exposure.

## What we actually verified on September 24, 2026

The public `https://gateway.architect.exchange/api/instruments` response lists:

| Candidate leg | Native symbol | Contract multiplier | Expiry / benchmark |
|---|---|---|---|
| Compute | NVDA-H100-2026-DEC | 730 GPU-hours | Dec 31, 2026 21:00 UTC; Compute Desk NVIDIA H100 GPU Index |
| Energy proxy | UNG-PERP | 1 ETF share | Perpetual; Arca Official Closing Price |

Both list minimum order size 1. Snapshot: `evidence/architect-instruments-2026-09-24.json`. Listing metadata does not establish live depth, tradability for a particular account, or available fills. An unauthenticated request to `/api/book?symbol=UNG-PERP` returned HTTP 401, so we have not measured executable prices or depth.

UNG tracks natural-gas futures through an ETF. It is neither physical electricity nor a direct Henry Hub contract. Its roll economics and the perp's funding matter. The compute contract references **Compute Desk**, not ORNN. ORNN's chart is context, not a valid substitute for executable quotes or this contract's settlement benchmark.

Hummingbot upstream commit reviewed: `9af100d6822da7d2d0291a906c730ef172284ee2`. The official `architect_perpetual` connector parses `*-PERP` symbols and skips the dated GPU symbol. A saved source excerpt is in `evidence/connector-review.txt`. Renaming the GPU contract would not fix funding, expiry, settlement or multiplier semantics. We deliberately do not claim live two-leg support.

## Original Hummingbot CSV replay adapter

For the new authenticated **market-data monitor**, see [HUMMINGBOT.md](docs/HUMMINGBOT.md). The instructions below describe the older CSV-only adapter.

The adapter follows the current `StrategyV2Base` / `StrategyV2ConfigBase` interface used by upstream `scripts/log_price_example.py`. In a compatible Hummingbot source installation:

1. Copy `scripts/energy_compute_core.py` and `scripts/energy_compute_hb.py` into Hummingbot's `scripts/` directory.
2. Copy a quote CSV into its `data/energy_compute.csv` (or set `csv_path`). For a demo, use the explicitly synthetic CSV.
3. In the Hummingbot client, create the script configuration with `create --script-config energy_compute_hb`, then start it with the generated configuration using your installed client's documented `start --script ... --conf ...` syntax.
4. Observe `status` and logs. It replays one CSV row per tick, using CSV timestamps for the model's elapsed time. It does not simulate wall-clock arrival latency.

No exchange connectors are requested by this adapter. It never calls buy/sell or creates order executors. The engine has been tested locally; the adapter is syntax-checked, but a full Hummingbot runtime integration has not been executed here.

CSV columns:

```
timestamp,compute_bid,compute_ask,energy_bid,energy_ask,compute_timestamp,energy_timestamp
```

Use epoch seconds and actual contemporaneous top-of-book quotes for the same two contracts throughout a run. Do not use settlement-index observations as executable bid/ask prices. Reject stale (>120 seconds), crossed, non-finite or overly wide (>50 bps) quotes. A data gap >180 seconds clears signal warmup; if a position is open, it halts and leaves exposure visible instead of inventing a fill through missing data. Resume requires review and a new run. State is not persisted across restarts.

## Simulation limitations

Fills cross bid/ask and add 3 bps of assumed slippage plus 5 bps fees on each leg at entry and exit. These are conservative placeholders to configure from actual account terms, not Architect's advertised fee schedule. Paper fills assume both legs fill fully together with unlimited depth. Open P&L includes estimated exit costs. Funding, financing, margin requirements, liquidation, impact and expiration settlement are not modeled. The loss threshold is a decision rule, not a guaranteed maximum loss. A price gap can exceed it.

The replay does not force-close at the last row: inspect open liquidation P&L as well as realized P&L. Baselines are research defaults, not optimized settings.

## Before adding exchange execution or publishing results

- Obtain permitted paired quote history, executable depth, trading calendar and account fee/funding data. Check quote synchronisation and missing intervals.
- Estimate beta only on training data, then freeze it for held-out tests. Compare against no-trade and single-leg baselines, and test whether apparent mean reversion survives fees, funding and different regimes.
- Add expiry/roll rules, margin budgeting and exchange contract-size validation. Never stitch different maturities without an explicit roll convention.
- Build and test dated-futures support, or use a separately validated Architect execution adapter. Track fills individually, cancel unfilled legs, cap unhedged time/exposure, and reconcile positions on restart.
- Test sandbox partial fills, rejections, disconnects, maintenance windows and kill switches before any separately authorized live deployment.
- For an eventual Guild weekly challenge, evaluate reproducibility, net performance after all costs, drawdown and retained participation. Do not reward raw self-traded volume.

## Sources

- Architect instruments API: https://gateway.architect.exchange/api/instruments
- Hummingbot connector: https://github.com/hummingbot/hummingbot/blob/9af100d6822da7d2d0291a906c730ef172284ee2/hummingbot/connector/derivative/architect_perpetual/architect_perpetual_derivative.py
- Hummingbot V2 example: https://github.com/hummingbot/hummingbot/blob/9af100d6822da7d2d0291a906c730ef172284ee2/scripts/log_price_example.py
- Economic framework: https://architect.co/insights/articles/intercommodity-spreads-crack-to-compute/

Contributed to the existing `uwecerron/architect-hummingbot` repository. No license grant has been added; the repository owner must choose a license before others can rely on reuse rights. The strategy is experimental and has no demonstrated trading edge.

### Lighter H100 comparison
The dashboard discovers the active H100 perpetual from Lighter’s public mainnet catalogue and reads its book and funding-rate feed through `/api/lighter`. No API key is needed. Results are cached for up to 30 seconds; receipt time is not an exchange event timestamp. Depth is limited to 100 returned orders per side, with a 1% midprice band. Funding is raw until its period is verified. The comparison does not treat Architect’s dated Compute Desk future and Lighter’s perpetual as interchangeable or calculate an arbitrage edge. Synthetic replay is unchanged.

## Bitget and Lighter compute collectors

Record H100/B200 market observations with `npm run collect:compute -- --once`, or use `scripts/compute_venues_hb.py` with the official Hummingbot Bitget/Lighter perpetual connectors. **Read-only research, not live execution.** Node public-API collection has been smoke-tested; full Hummingbot runtime validation remains outstanding. See [installation, sources, output schema and adoption notes](docs/COMPUTE_VENUES.md).

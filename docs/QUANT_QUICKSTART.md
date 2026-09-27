# Your first compute-market experiment

A practical tutorial from Traders Guild / Compute Pulse. The question: **does a compute trade survive execution costs at your size?**

You can run a paper strategy and collect market observations today. This repo does not execute live strategies. The paper engine uses a paired compute/energy CSV; the public collector saves separate venue snapshots. They are different workflows, not an automatic live trading pipeline.

## 1. Install and check the research environment

Requires Node.js 22, npm, Git, and Python 3.10+ for the cross-language tests.

```sh
git clone --branch feature/compute-energy-lab https://github.com/uwecerron/architect-hummingbot.git
cd architect-hummingbot
npm ci
npm test
python3 -m unittest discover -s tests -v
npm run dev
```

Open http://127.0.0.1:4180. The dashboard compares Architect, Bitget and Lighter. Public Bitget/Lighter prices are observed snapshots. Architect's authenticated quote feed is separate. The default compute/energy strategy charts are explicitly synthetic.

## 2. Run a paper strategy before connecting an account

```sh
npm run replay -- data/SYNTHETIC_demo.csv
```

Inspect `output/node-replay.csv` and the terminal summary. It records paper decisions, realized P&L, open exposure and drawdown. The synthetic file verifies the mechanics; its results are not historical performance.

The example strategy measures `log(compute price) - beta × log(energy price)`, compares it with the preceding 60 observations, and opens a paper position when the deviation reaches ±2 standard deviations. A high reading means paper short compute / long energy; a low reading reverses those legs. Default beta=1 is an assumption, not an estimated hedge ratio. Read `README.md` for complete exit rules and model limits.

In the dashboard, change notional, beta, fees and slippage. Run all three scenarios: convergence, relationship breakdown, and costs consuming the move. A useful first exercise is to find which assumptions turn apparent profit into a loss.

## 3. Collect actual compute-market observations

In a second terminal, from the repository directory:

```sh
npm run collect:compute -- --once
# Poll every 60 seconds; Ctrl+C stops:
npm run collect:compute
```

Records append to `output/compute-venues.jsonl`. No exchange keys are needed for this public collector. Inspect the last record:

```sh
node --input-type=module -e 'import fs from "node:fs"; const lines=fs.readFileSync("output/compute-venues.jsonl","utf8").trim().split("\n"); console.log(JSON.stringify(JSON.parse(lines.at(-1)),null,2));'
```

Bitget observations include H100/B200 book-sweep estimates at different notionals. Lighter observations include H100 quotes, sampled depth and raw funding. Inspect errors inside each venue and each Bitget market; a saved row is not proof every feed succeeded. Archive your own observations over time; one snapshot cannot establish a strategy.

Do not feed this JSONL into the paired CSV replay. It has no synchronized energy leg, uses different instruments, and does not establish equivalent benchmarks. Bitget quotes are USDT, Lighter USDC, and Architect's saved dated future has a 730 GPU-hour multiplier. The existing paired engine is configured for the Architect instruments, not interchangeable H100 perpetuals.

## 4. Start with a falsifiable research question

**Execution hypothesis:** a particular trade size can enter without consuming most of the expected gross move.

On [the execution-cost table](https://www.compute-pulse.xyz/#price-surface), compare buy and sell estimates at your size. Record the venue, contract, time and midpoint cost in bps. Compare that with your expected move, separately budgeting fees, funding and an adverse exit-liquidity scenario. Do not assume today's sell book represents tomorrow's exit.

**Illustrative budget, not measured performance:** a forecast 100-bp move minus 20-bp entry cost, an assumed 30-bp exit cost and 10-bp combined fees leaves 40 bps before funding and forecast error. At 100,000 quote-currency units of notional, that is 400 units. Leverage does not reduce notional execution costs.

**Relative-value hypothesis:** compute prices diverge from an energy proxy and subsequently converge. This requires contemporaneous paired history, contract multipliers, funding and carry, held-out evaluation, and a comparison against doing nothing and each individual leg. The current public collector alone cannot test it.

Reject the thesis if the relationship breaks out of sample, costs erase the effect, or required size cannot be filled. Price differences across exchanges may reflect different indices, funding or maturity rather than arbitrage.

## 5. Use Hummingbot for read-only observations

Follow [COMPUTE_VENUES.md](COMPUTE_VENUES.md) to copy `scripts/compute_venues_hb.py` and `scripts/compute_quote_core.py` into an existing compatible Hummingbot installation. It uses official `bitget_perpetual` and `lighter_perpetual` connectors. Configure those connectors through Hummingbot, then:

```text
create --script-config compute_venues_hb
start --script compute_venues_hb.py --conf <generated-config.yml>
status
```

This script records quotes only; it does not place orders or run the paper engine. Receipt timestamps do not independently verify exchange freshness. The adapter has been syntax checked, but full Hummingbot runtime validation remains outstanding. Architect's authenticated monitor has a separate [setup guide](HUMMINGBOT.md).

## 6. What contributors can help build

- Validate Bitget and Lighter market mapping in a real Hummingbot environment.
- Collect timestamped historical observations and document missing intervals.
- Normalize contract multipliers, collateral and funding with primary-source evidence.
- Add held-out strategy evaluation and realistic partial-fill accounting.

Live execution would additionally need margin checks, position reconciliation, stale-feed rejection, partial-fill handling and kill switches. None is supplied as a live strategy here.

The repository is public but currently lacks an explicit reuse license. Contributions are welcome for review; a license decision is still needed before describing the project as permissively licensed open source. Do not commit credentials or private account data.

## Sources and contact

- [Repository](https://github.com/uwecerron/architect-hummingbot/tree/feature/compute-energy-lab)
- [Compute Pulse](https://www.compute-pulse.xyz/)
- [Official Hummingbot Bitget connector documentation](https://hummingbot.org/exchanges/bitget/)
- [Official Hummingbot Lighter connector documentation](https://hummingbot.org/exchanges/lighter/)
- [Bitget depth API](https://www.bitget.com/api-doc/classic/contract/market/Get-Merge-Depth)
- [Lighter market API](https://apidocs.lighter.xyz/reference/orderbookdetails)
- [Talk to Uwe at Traders Guild](https://t.me/UweJensCerron)

Cite Traders Guild, Compute Pulse research tooling (2026), with the exact Git commit and collection timestamp. Exchange documentation is the source for API semantics; synthetic outputs are not market evidence.

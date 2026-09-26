# Compute-market research: Bitget + Lighter

## What this adds

Use the official Hummingbot `bitget_perpetual` and `lighter_perpetual` connectors to record compute quotes, or start a standalone public Node.js collector without exchange credentials. These are research adapters, not newly authored exchange connectors or an upstream Hummingbot contribution.

| Venue | Instrument | Hummingbot pair | Collector output |
|---|---|---|---|
| Bitget | H100 perpetual | H100-USDT | Book-sweep execution surface |
| Bitget | B200 perpetual | B200-USDT | Book-sweep execution surface |
| Lighter | H100 perpetual | H100-USDC | Bid/ask, observed depth, raw funding and market metadata |

The Hummingbot adapter records top-of-book quotes only for all three pairs. The Node collector has richer API observations as above. The dashboard also calculates a Lighter execution surface from up to 100 returned orders per side, with exchange freshness explicitly unknown. No cross-venue arbitrage signal is calculated. Architect's existing dated-future monitor remains separate.

## Fastest start: Node 22

```sh
git clone --branch feature/compute-energy-lab https://github.com/uwecerron/architect-hummingbot.git
cd architect-hummingbot
npm ci
npm run collect:compute -- --once
# Continuous, one sample per 60 seconds; stop with Ctrl+C:
npm run collect:compute
```

Output: `output/compute-venues.jsonl`, one JSON record per polling cycle. Records include schema version, venue, quote currency, receipt time, source request URLs and venue-specific observations. Failed sources are recorded as unavailable without suppressing the other venue. Bitget can have per-market errors inside an otherwise successful response. Inspect those before analysis. Do not mix this JSONL with the paired CSV engine input.

Bitget uses up to 50 levels per side and rejects books older than 120 seconds. Lighter discovers the active H100 market rather than hardcoding its ID, requests up to 100 orders per side and reports depth within 1% of the midpoint. Its returned saved bid/ask sample is truncated to eight orders per side, so do not reconstruct full depth from that sample. Lighter exchange-event freshness is unknown; receipt time is not event time.

## Hummingbot installation

Use a Hummingbot release containing both official perpetual connectors. Upstream source reviewed at `9af100d6822da7d2d0291a906c730ef172284ee2` on 2026-09-26. Copy these two files into your Hummingbot `scripts/` folder:

- `scripts/compute_venues_hb.py`
- `scripts/compute_quote_core.py`

In Hummingbot, configure the official connections according to their documentation, then:

```text
connect bitget_perpetual
connect lighter_perpetual
create --script-config compute_venues_hb
start --script compute_venues_hb.py --conf <generated-config.yml>
status
```

Credentials stay in Hummingbot, never this repository. Connector initialization can require account credentials even for this read-only script. Choose the public Node collector if you only need unauthenticated observations. Defaults monitor all three pairs; edit `markets_to_monitor` in the generated config to select a subset. A missing pair or unready connector creates an error record, never a substitute instrument.

Output defaults to `data/compute-venues.jsonl` within Hummingbot. Quotes have explicit currency and local receipt timestamps. Exchange timestamps are null and freshness is marked unverified because connector top-of-book getters do not establish freshness here. This output must not drive autonomous execution without a separate exchange-event freshness check.

This adapter never calls buy/sell and rejects trading controllers. No executors, cross-venue transfer, position sizing or automated arbitrage are enabled. Run in a dedicated research instance; it does not cancel positions or orders placed by other strategies.

## Validation and adoption boundaries

- Node public API collection successfully returned Bitget H100/B200 and Lighter H100 on 2026-09-26.
- Python quote normalization tests and existing Node parsing/depth tests pass.
- Hummingbot adapter is syntax checked; a complete Hummingbot runtime session has **not** been run in this environment. First adopter check: connectors ready, pairs mapped, JSONL records valid, no orders created.
- USDT and USDC are distinct collateral/quote currencies. Index methodology, funding, contract terms and settlement differ. Matching H100 labels does not establish economic equivalence.
- Book estimates exclude fees, funding, latency, cancellations and liquidation. Collection is polling, not streaming. It does not build a physical GPU rental curve.
- This repository currently has no explicit reuse license. Before promoting unrestricted adoption, the owner should select a license for their original code. Upstream Hummingbot keeps its own license.

## Cite the tooling and sources

Cite: **Traders Guild, Compute Pulse compute-market research adapters (2026), `feature/compute-energy-lab`, commit [your published commit SHA].** Include observation date and venue-specific source when quoting figures. Do not claim Hummingbot or an exchange endorses the Guild.

- Code: https://github.com/uwecerron/architect-hummingbot/tree/feature/compute-energy-lab
- Demo: https://www.compute-pulse.xyz/#price-surface
- Hummingbot Bitget: https://hummingbot.org/exchanges/bitget/
- Hummingbot Lighter: https://hummingbot.org/exchanges/lighter/
- Pinned Lighter connector: https://github.com/hummingbot/hummingbot/tree/9af100d6822da7d2d0291a906c730ef172284ee2/hummingbot/connector/derivative/lighter_perpetual
- Pinned Bitget connector: https://github.com/hummingbot/hummingbot/tree/9af100d6822da7d2d0291a906c730ef172284ee2/hummingbot/connector/derivative/bitget_perpetual
- Bitget book API: https://www.bitget.com/api-doc/classic/contract/market/Get-Merge-Depth
- Lighter API: https://apidocs.lighter.xyz/reference/orderbookdetails

## Announcement draft (after push; no publication performed)

**X:**
Building a compute strategy? We added Bitget H100/B200 and Lighter H100 data tooling to our research repo. A public Node collector, plus a read-only adapter for Hummingbot's official connectors. Start with quotes and depth before testing an edge.
[repo link]

**LinkedIn:**
The first step in testing a compute trade is collecting the market you could actually trade.

Our research repo now includes a public Node.js collector for Bitget H100/B200 and Lighter H100, plus a read-only script using their official Hummingbot connectors. The Node collector saves venue-labelled snapshots; Bitget order-book sweeps show how estimated execution prices change with size.

There is no trading signal or claimed arbitrage edge. Different benchmarks, funding and collateral still need to be reconciled. The Hummingbot adapter needs a full runtime validation before broader adoption.

If you're researching compute markets, try the collector and tell us what data you're missing. Contact Uwe at https://t.me/UweJensCerron.
[repo link]

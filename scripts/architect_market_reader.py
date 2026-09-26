"""Read native-symbol L2 snapshots via the official Hummingbot Architect connector.

This deliberately bypasses only the perpetual symbol mapper for market-data reads.
It does not add dated-futures trading support or invoke an order API.
"""
import asyncio
import time

SYMBOLS = ('NVDA-H100-2026-DEC', 'UNG-PERP')


def parse_book(payload, symbol, received):
    b = payload['book']
    def rows(side, reverse):
        import math
        levels = [(float(v['p']), float(v['q'])) for v in b[side]]
        levels = [(p, q) for p, q in levels if math.isfinite(p) and math.isfinite(q) and p > 0 and q > 0]
        return sorted(levels, reverse=reverse)
    bids, asks = rows('b', True), rows('a', False)
    ts = float(b['ts'])
    if not bids or not asks or not 1e9 <= ts <= 1e11 or not -2 <= received-ts <= 120:
        raise ValueError('Empty, stale, future or invalid book')
    if bids[0][0] > asks[0][0]:
        raise ValueError('Crossed book')
    return dict(symbol=symbol, timestamp=ts, bid=bids[0][0], ask=asks[0][0],
                bid_size=bids[0][1], ask_size=asks[0][1])


class ArchitectMarketReader:
    def __init__(self, connector):
        self.connector = connector

    async def sample(self):
        # Existing connector handles bearer-token authentication and throttling.
        payloads = await asyncio.gather(*[
            self.connector._api_get(path_url='/api/book', params={'symbol': s, 'level': 2}, is_auth_required=True)
            for s in SYMBOLS
        ])
        now = time.time()
        c, e = [parse_book(p, s, now) for p, s in zip(payloads, SYMBOLS)]
        if abs(c['timestamp'] - e['timestamp']) > 30:
            raise ValueError('Unsynchronized books')
        from scripts.energy_compute_core import Quote
        quote = Quote(now, c['bid'], c['ask'], e['bid'], e['ask'], c['timestamp'], e['timestamp'])
        return quote, [c, e]

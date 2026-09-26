"""Venue-labelled quotes; deliberately does not infer exchange freshness."""
import math

def quote_record(connector, pair, bid, ask, received):
    bid, ask, received = float(bid), float(ask), float(received)
    if not all(math.isfinite(v) and v > 0 for v in (bid, ask, received)) or bid >= ask:
        raise ValueError('Invalid or crossed quote')
    return dict(schema_version=1, connector=connector, pair=pair,
                quote_currency=pair.rsplit('-', 1)[1], received_epoch=received,
                exchange_timestamp=None, freshness='not independently verified',
                bid=bid, ask=ask, spread_bps=(ask-bid)/((ask+bid)/2)*10000)

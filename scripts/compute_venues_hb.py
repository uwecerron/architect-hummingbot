"""Read-only Hummingbot V2 monitor using official Bitget/Lighter connectors."""
import json
import os
from pathlib import Path
from pydantic import Field
from hummingbot.strategy.strategy_v2_base import StrategyV2Base, StrategyV2ConfigBase
from scripts.compute_quote_core import quote_record

class ComputeVenuesConfig(StrategyV2ConfigBase):
    script_file_name: str = os.path.basename(__file__)
    controllers_config: list[str] = Field(default_factory=list, max_length=0)
    interval_seconds: int = Field(default=60, ge=30, le=3600)
    output_path: str = 'data/compute-venues.jsonl'
    markets_to_monitor: dict[str, list[str]] = Field(default_factory=lambda: {
        'bitget_perpetual': ['H100-USDT', 'B200-USDT'],
        'lighter_perpetual': ['H100-USDC']})

    def update_markets(self, markets):
        for name, pairs in self.markets_to_monitor.items():
            if name not in {'bitget_perpetual', 'lighter_perpetual'}:
                raise ValueError('Only Bitget and Lighter perpetual connectors supported')
            markets.setdefault(name, set()).update(pairs)
        return markets

class ComputeVenuesMonitor(StrategyV2Base):
    def __init__(self, connectors, config):
        if config.controllers_config:
            raise ValueError('Read-only monitor cannot load trading controllers')
        super().__init__(connectors, config)
        self.monitor_config = config
        self.next_sample = 0
        self.state = 'Waiting for official connectors'

    def on_tick(self):
        if self.current_timestamp < self.next_sample:
            return
        self.next_sample = self.current_timestamp + self.monitor_config.interval_seconds
        records = []
        for name, pairs in self.monitor_config.markets_to_monitor.items():
            connector = self.connectors.get(name)
            for pair in pairs:
                try:
                    if connector is None or not connector.ready:
                        raise ValueError('Connector not ready')
                    records.append(quote_record(name, pair, connector.get_price(pair, False),
                                                connector.get_price(pair, True), self.current_timestamp))
                except Exception:
                    records.append(dict(schema_version=1, connector=name, pair=pair,
                                        received_epoch=self.current_timestamp,
                                        error='Quote unavailable; check connector readiness and symbol support'))
        path = Path(self.monitor_config.output_path)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('a') as out:
                for row in records:
                    out.write(json.dumps(row, allow_nan=False) + '\n')
            self.state = '\n'.join(json.dumps(r) for r in records)
        except OSError:
            self.state = 'Cannot write output; check path and permissions'
            self.logger().warning(self.state)

    def format_status(self):
        return 'COMPUTE QUOTES / READ ONLY\n' + self.state + '\nReceipt time is not exchange freshness. No orders or signals.'

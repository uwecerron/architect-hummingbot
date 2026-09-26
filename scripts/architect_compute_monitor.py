"""Hummingbot V2 Architect data monitor. Paper only; no order executors."""
import asyncio
import csv
import os
import json
from dataclasses import asdict
from pathlib import Path
from typing import Dict, Set
from pydantic import Field
from hummingbot.strategy.strategy_v2_base import StrategyV2Base, StrategyV2ConfigBase
from scripts.architect_market_reader import ArchitectMarketReader
from scripts.energy_compute_core import Config, PairEngine


class ArchitectComputeConfig(StrategyV2ConfigBase):
    script_file_name: str = os.path.basename(__file__)
    controllers_config: list[str] = Field(default_factory=list, max_length=0)
    connector_name: str = Field(default='architect_perpetual_sandbox', pattern=r'^architect_perpetual(_sandbox)?$')
    interval_seconds: int = Field(default=60, ge=30, le=3600)
    output_path: str = Field(default='data/architect-quotes.csv')

    def update_markets(self, markets: Dict[str, Set[str]]) -> Dict[str, Set[str]]:
        markets.setdefault(self.connector_name, set()).add('UNG-USD')
        return markets


class ArchitectComputeMonitor(StrategyV2Base):
    def __init__(self, connectors, config):
        if config.controllers_config:
            raise ValueError("Read-only monitor cannot load trading controllers")
        super().__init__(connectors, config)
        self.monitor_config = config
        self.reader = ArchitectMarketReader(connectors[config.connector_name])
        self.engine = PairEngine(Config())
        self.next_sample = 0
        self.task = None
        self.state = 'Waiting for connector'

    def on_tick(self):
        if self.task and not self.task.done():
            return
        if self.current_timestamp < self.next_sample:
            return
        self.next_sample = self.current_timestamp + self.monitor_config.interval_seconds
        self.task = asyncio.create_task(self.sample())

    async def sample(self):
        try:
            quote, books = await self.reader.sample()
            quote.validate(self.engine.cfg)
            path = Path(self.monitor_config.output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            manifest = path.with_suffix('.meta.json')
            identity = {'connector': self.monitor_config.connector_name, 'symbols': ['NVDA-H100-2026-DEC', 'UNG-PERP']}
            if manifest.exists():
                if json.loads(manifest.read_text()) != identity:
                    raise ValueError('Output belongs to a different market environment')
            elif path.exists() and path.stat().st_size:
                raise ValueError('Existing CSV lacks a provenance manifest; choose a new path')
            else:
                manifest.write_text(json.dumps(identity, indent=2))
            new_file = not path.exists() or path.stat().st_size == 0
            with path.open('a', newline='') as f:
                w = csv.DictWriter(f, fieldnames=list(asdict(quote)))
                if new_file:
                    w.writeheader()
                w.writerow(asdict(quote))
            self.state = str(self.engine.step(quote))
            self.logger().info('PAPER ONLY %s', self.state)
        except asyncio.CancelledError:
            raise
        except Exception:
            # Avoid logging raw authenticated responses or credentials.
            self.state = 'Sample rejected. Check connector connection, permissions, market hours and book freshness.'
            self.logger().warning(self.state)

    async def on_stop(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        await super().on_stop()

    def format_status(self):
        return 'ARCHITECT READ-ONLY / PAPER MONITOR\n' + self.state + '\nNo order execution. Dated GPU futures read as native symbols.'

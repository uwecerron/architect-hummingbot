"""Hummingbot V2 CSV replay adapter. No connectors and no exchange orders."""
import os
from pathlib import Path
from pydantic import Field
from hummingbot.core.data_type.common import MarketDict
from hummingbot.strategy.strategy_v2_base import StrategyV2Base, StrategyV2ConfigBase
from scripts.energy_compute_core import Config, PairEngine, read_quotes

class EnergyComputeConfig(StrategyV2ConfigBase):
    script_file_name: str = os.path.basename(__file__)
    csv_path: str = Field(default='data/energy_compute.csv')
    def update_markets(self, markets: MarketDict) -> MarketDict:
        return markets  # Replay does not authenticate or connect to an exchange.

class EnergyCompute(StrategyV2Base):
    def __init__(self, connectors, config: EnergyComputeConfig):
        super().__init__(connectors, config)
        self.engine = PairEngine(Config())
        self.rows = iter(read_quotes(Path(config.csv_path)))
        self.done = False
        self.result = {'action': 'READY'}

    def on_tick(self):
        if self.done:
            return
        try:
            self.result = self.engine.step(next(self.rows))
            self.logger().info('PAPER REPLAY ONLY: %s', self.result)
        except StopIteration:
            self.done = True
        except ValueError as exc:
            self.done = True
            self.logger().error('Replay stopped; invalid data: %s', exc)

    def format_status(self):
        return f'RESEARCH REPLAY; NO LIVE ORDERS\n{self.result}\nCompleted: {self.done}'

"""Research-only pair simulator. Standard library; never submits an order."""
from dataclasses import dataclass
from collections import deque
import csv
import math
import statistics

@dataclass(frozen=True)
class Config:
    lookback: int = 60
    entry_z: float = 2.0
    exit_z: float = 0.5
    stop_z: float = 4.0
    beta: float = 1.0  # Research assumption, NOT an estimated electricity hedge.
    leg_usd: float = 10000.0
    compute_multiplier: float = 730.0
    energy_multiplier: float = 1.0
    fee_bps: float = 5.0
    slippage_bps: float = 3.0
    max_spread_bps: float = 50.0
    max_age_seconds: float = 120.0
    max_gap_seconds: float = 180.0
    max_hold_seconds: float = 86400.0
    max_loss_usd: float = 500.0
    cooldown_seconds: float = 300.0

    def __post_init__(self):
        for key, value in vars(self).items():
            if not math.isfinite(value) or value < 0:
                raise ValueError(f'Invalid {key}')
        if self.lookback < 3 or not isinstance(self.lookback, int):
            raise ValueError('lookback must be an integer >= 3')
        if not 0 <= self.exit_z < self.entry_z < self.stop_z:
            raise ValueError('Require exit < entry < stop')
        if min(self.beta, self.leg_usd, self.compute_multiplier, self.energy_multiplier) <= 0:
            raise ValueError('Sizing and multiplier values must be positive')

@dataclass(frozen=True)
class Quote:
    timestamp: float
    compute_bid: float
    compute_ask: float
    energy_bid: float
    energy_ask: float
    compute_timestamp: float
    energy_timestamp: float

    def validate(self, cfg):
        if any(not math.isfinite(v) for v in vars(self).values()):
            raise ValueError('Non-finite quote')
        for bid, ask, ts in [(self.compute_bid, self.compute_ask, self.compute_timestamp),
                              (self.energy_bid, self.energy_ask, self.energy_timestamp)]:
            if not 0 < bid <= ask:
                raise ValueError('Invalid/crossed book')
            if not 0 <= self.timestamp - ts <= cfg.max_age_seconds:
                raise ValueError('Stale/future quote')
            if 10000 * (ask - bid) / ((bid + ask) / 2) > cfg.max_spread_bps:
                raise ValueError('Spread too wide')

class PairEngine:
    def __init__(self, cfg=Config()):
        self.cfg = cfg
        self.history = deque(maxlen=cfg.lookback)
        self.position = None
        self.realized = 0.0
        self.last_timestamp = None
        self.cooldown_until = 0.0
        self.halted = False

    def _fill(self, q, leg, quantity):
        px = getattr(q, f'{leg}_ask' if quantity > 0 else f'{leg}_bid')
        return px * (1 + math.copysign(self.cfg.slippage_bps / 10000, quantity))

    def _fee(self, qc, qe, pc, pe):
        return (abs(qc) * self.cfg.compute_multiplier * pc + abs(qe) * self.cfg.energy_multiplier * pe) * self.cfg.fee_bps / 10000

    def liquidation_pnl(self, q):
        if not self.position:
            return 0.0
        p = self.position
        pc, pe = self._fill(q, 'compute', -p['qc']), self._fill(q, 'energy', -p['qe'])
        return (p['qc'] * self.cfg.compute_multiplier * (pc - p['pc']) +
                p['qe'] * self.cfg.energy_multiplier * (pe - p['pe']) -
                p['entry_fee'] - self._fee(p['qc'], p['qe'], pc, pe))

    def step(self, q):
        q.validate(self.cfg)
        if self.last_timestamp is not None and q.timestamp <= self.last_timestamp:
            raise ValueError('Timestamps must increase strictly')
        gap = self.last_timestamp is not None and q.timestamp - self.last_timestamp > self.cfg.max_gap_seconds
        self.last_timestamp = q.timestamp
        if gap:
            self.history.clear()
            if self.position:
                self.halted = True  # No fictitious fill during missing observations.
        c = (q.compute_bid + q.compute_ask) / 2
        e = (q.energy_bid + q.energy_ask) / 2
        residual = math.log(c) - self.cfg.beta * math.log(e)
        z = None
        if len(self.history) == self.cfg.lookback:
            std = statistics.pstdev(self.history)
            if std > 1e-9:
                z = (residual - statistics.mean(self.history)) / std
        self.history.append(residual)  # Current observation excluded from its baseline.
        action = 'HALTED' if self.halted else 'WARMUP' if z is None else 'HOLD'
        pnl = self.liquidation_pnl(q)
        if self.position and not self.halted:
            p = self.position
            reason = ('LOSS_LIMIT' if self.realized + pnl <= -self.cfg.max_loss_usd else
                      'TIME_LIMIT' if q.timestamp - p['opened'] >= self.cfg.max_hold_seconds else
                      'STOP_Z' if z is not None and abs(z) >= self.cfg.stop_z else
                      'MEAN_REVERSION' if z is not None and
                      (abs(z) <= self.cfg.exit_z or z * p['entry_z'] <= 0) else None)
            if reason:
                self.realized += pnl
                self.position = None
                self.cooldown_until = q.timestamp + self.cfg.cooldown_seconds
                self.halted = reason == 'LOSS_LIMIT'
                action = 'CLOSE_' + reason
        elif not self.halted and z is not None and q.timestamp >= self.cooldown_until and self.cfg.entry_z <= abs(z) < self.cfg.stop_z:
            sign = -1 if z > 0 else 1
            qc = sign * math.floor(self.cfg.leg_usd / (c * self.cfg.compute_multiplier))
            # Size energy against rounded compute exposure, not unrounded target.
            qe = -sign * math.floor(abs(qc) * c * self.cfg.compute_multiplier * self.cfg.beta / (e * self.cfg.energy_multiplier))
            if qc and qe:
                pc, pe = self._fill(q, 'compute', qc), self._fill(q, 'energy', qe)
                self.position = dict(qc=qc, qe=qe, pc=pc, pe=pe, opened=q.timestamp,
                                     entry_z=z, entry_fee=self._fee(qc, qe, pc, pe))
                action = 'OPEN_SHORT_COMPUTE' if sign < 0 else 'OPEN_LONG_COMPUTE'
            else:
                action = 'SKIP_MIN_CONTRACT'
        return dict(timestamp=q.timestamp, z=z, action=action, realized_pnl=self.realized,
                    open_liquidation_pnl=self.liquidation_pnl(q),
                    compute_contracts=self.position['qc'] if self.position else 0,
                    energy_contracts=self.position['qe'] if self.position else 0)

def read_quotes(path):
    with open(path, newline='') as f:
        for row in csv.DictReader(f):
            yield Quote(**{k: float(v) for k, v in row.items()})

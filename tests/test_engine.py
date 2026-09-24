import unittest
from dataclasses import replace
from scripts.energy_compute_core import Config, Quote, PairEngine

def q(t,c=3,e=12):
    return Quote(t,c*.9999,c*1.0001,e*.9999,e*1.0001,t,t)

class EngineTests(unittest.TestCase):
    def engine(self):
        eng = PairEngine(Config(lookback=5, entry_z=1.5, stop_z=10))
        for i,c in enumerate([3,3.01,2.99,3.005,2.995]):eng.step(q(i*60,c))
        return eng
    def test_stale_rejected(self):
        with self.assertRaises(ValueError):PairEngine().step(replace(q(300),compute_timestamp=0))
    def test_crossed_rejected(self):
        with self.assertRaises(ValueError):PairEngine().step(replace(q(0),compute_bid=4))
    def test_nan_rejected(self):
        with self.assertRaises(ValueError):PairEngine().step(replace(q(0),energy_ask=float('nan')))
    def test_duplicate_rejected(self):
        eng=PairEngine();eng.step(q(0))
        with self.assertRaises(ValueError):eng.step(q(0))
    def test_lagged_z_and_multiplier(self):
        eng=self.engine();r=eng.step(q(300,3.025))
        self.assertEqual(r['action'],'OPEN_SHORT_COMPUTE')
        self.assertEqual(r['compute_contracts'],-4)
        self.assertGreater(r['energy_contracts'],0)
        self.assertLess(r['open_liquidation_pnl'],0) # Costs cannot be free.
    def test_reversion_close(self):
        eng=self.engine();eng.step(q(300,3.025));r=eng.step(q(360,3))
        self.assertTrue(r['action'].startswith('CLOSE_'))
        self.assertIsNone(eng.position)
    def test_gap_halts_open_position(self):
        eng=self.engine();eng.step(q(300,3.025));r=eng.step(q(1000))
        self.assertEqual(r['action'],'HALTED')
        self.assertIsNotNone(eng.position)
    def test_loss_limit_halts(self):
        eng=self.engine();eng.step(q(300,3.025));r=eng.step(q(360,4))
        self.assertEqual(r['action'],'CLOSE_LOSS_LIMIT')
        self.assertTrue(eng.halted)
    def test_insufficient_contract_budget(self):
        eng=self.engine();eng.cfg=replace(eng.cfg,leg_usd=10)
        self.assertEqual(eng.step(q(300,3.025))['action'],'SKIP_MIN_CONTRACT')
    def test_invalid_config(self):
        with self.assertRaises(ValueError):Config(beta=0)
        with self.assertRaises(ValueError):Config(entry_z=.1)

if __name__=='__main__':unittest.main()

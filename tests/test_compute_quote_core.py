import unittest
from scripts.compute_quote_core import quote_record

class ComputeQuoteTests(unittest.TestCase):
    def test_currency_and_freshness(self):
        r=quote_record('lighter_perpetual','H100-USDC',2,2.02,100)
        self.assertEqual(r['quote_currency'],'USDC')
        self.assertIsNone(r['exchange_timestamp'])
        self.assertAlmostEqual(r['spread_bps'],.02/2.01*10000)
    def test_invalid_quotes(self):
        for bid,ask in [(2,1),(1,1),(0,2),(float('nan'),2),(1,float('inf'))]:
            with self.assertRaises(ValueError):
                quote_record('bitget_perpetual','H100-USDT',bid,ask,100)

import unittest
from unittest.mock import AsyncMock, patch
from scripts.architect_market_reader import ArchitectMarketReader, parse_book, SYMBOLS

NOW = 1790269200
BOOK = {'book': {'ts': NOW, 'b': [{'p': '3.00', 'q': '2'}], 'a': [{'p': '3.01', 'q': '4'}]}}

class ReaderTests(unittest.IsolatedAsyncioTestCase):
    async def test_connector_reads_native_symbols_only(self):
        connector = AsyncMock()
        connector._api_get.return_value = BOOK
        with patch('scripts.architect_market_reader.time.time', return_value=NOW):
            quote, books = await ArchitectMarketReader(connector).sample()
        self.assertEqual(quote.compute_bid, 3)
        self.assertEqual(len(books), 2)
        self.assertEqual(connector._api_get.call_count, 2)
        for call, symbol in zip(connector._api_get.call_args_list, SYMBOLS):
            self.assertEqual(call.kwargs, {'path_url':'/api/book','params':{'symbol':symbol,'level':2},'is_auth_required':True})
        connector.buy.assert_not_called()
        connector.sell.assert_not_called()

    async def test_unsynchronized_pair_rejected(self):
        connector = AsyncMock()
        connector._api_get.side_effect = [BOOK, {'book':{**BOOK['book'], 'ts': NOW-31}}]
        with patch('scripts.architect_market_reader.time.time', return_value=NOW):
            with self.assertRaisesRegex(ValueError, 'Unsynchronized'):
                await ArchitectMarketReader(connector).sample()

    def test_stale_and_empty_rejected(self):
        with self.assertRaises(ValueError):
            parse_book(BOOK, SYMBOLS[0], NOW+121)
        with self.assertRaises(ValueError):
            parse_book({'book':{**BOOK['book'],'a':[]}},SYMBOLS[0],NOW)

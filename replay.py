import argparse
import csv
from scripts.energy_compute_core import PairEngine, read_quotes
p = argparse.ArgumentParser(description='Paper replay only; no network or order submission')
p.add_argument('csv'); p.add_argument('--output', default='output/replay.csv')
a = p.parse_args()
engine = PairEngine()
with open(a.output, 'w', newline='') as f:
    writer = None
    for quote in read_quotes(a.csv):
        result = engine.step(quote)
        if writer is None:
            writer = csv.DictWriter(f, fieldnames=result); writer.writeheader()
        writer.writerow(result)
print(f'Wrote {a.output}; realized simulation P&L: {engine.realized:.2f}')
print('Open position remains marked, not forcibly closed:', engine.position is not None)
print('Excludes funding, financing, market impact and margin/liquidation effects.')

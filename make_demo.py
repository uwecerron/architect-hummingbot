"""Generate explicitly SYNTHETIC fixtures, not historical market observations."""
import csv, math
from dataclasses import asdict
from scripts.energy_compute_core import Quote
with open('data/SYNTHETIC_demo.csv', 'w', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=Quote.__dataclass_fields__); writer.writeheader()
    for i in range(400):
        t = 1790251200 + i * 60
        e = 12 * math.exp(.00005*i)
        shock = .006 if i % 100 in [75, 76] else 0
        c = 3 * math.exp(.00005*i + .003*math.sin(i/4) + shock)
        writer.writerow(asdict(Quote(t,c*.9998,c*1.0002,e*.9998,e*1.0002,t,t)))
print('Created data/SYNTHETIC_demo.csv. Never use these numbers as evidence of profitability.')

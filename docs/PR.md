# Add compute/energy research dashboard and Architect data monitors

The existing strategy could only replay a CSV in Python. This adds a Vercel-ready dashboard that lets traders inspect relative prices, replay paper decisions, vary costs and exposure, and see when the hypothesis fails. Synthetic observations and authenticated snapshots are labeled and kept separate.

A Node.js port matches Python decisions and P&L across the original fixture and three new scenarios. A Hummingbot StrategyV2 monitor reuses the official Architect connector's authenticated, throttled book reads. The dated GPU future is read by native symbol because the perpetual symbol mapper does not support it; no dated-futures trading support is claimed. A Node collector produces the same quote schema.

The read-only snapshot endpoint uses server-side credentials, environment allowlisting and a separate demo access token. No order routes exist. Includes deployment instructions, an evidence snapshot, research thesis, and CI.

Validation: Node/Python parity and failure-path tests, Python reader contract tests, production Vite build, browser layout and control checks. Authenticated exchange sampling and a full Hummingbot runtime session remain unverified because no configured credentials or Hummingbot runtime are present. Funding, margin, market impact, expiry execution and partial fills are not modeled.

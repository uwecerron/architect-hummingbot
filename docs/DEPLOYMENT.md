# Deploy the dashboard on Vercel

Import `uwecerron/architect-hummingbot`, choose branch `feature/compute-energy-lab`, root directory `.` and Vite. The checked-in `vercel.json` uses `npm run build` and output `dist`. Node 22 or newer is required.

The interactive synthetic demo needs **no environment variables**. Build does not call Architect and does not need private data. Never set exchange credentials with a `VITE_` prefix; that exposes them to browsers.

For optional authenticated market-data snapshots, add these server-only environment variables in Vercel Project Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| ARCHITECT_ENV | `sandbox` first; `production` only for the corresponding account/keys |
| ARCHITECT_API_KEY | Your permitted Architect API key |
| ARCHITECT_API_SECRET | Its secret |
| DATA_ACCESS_TOKEN | A separate long random password for the demo data endpoint |

Keep live market-data access restricted according to your data agreement. The browser's access-token field expects DATA_ACCESS_TOKEN, **never** the exchange key/secret. The API refuses configured credentials without the access gate. No credential is returned to the browser or stored in browser storage. Use the least-privilege exchange keys available. Do not create new broad permissions solely for this demo.

Redeploy after changing variables. Click “Check books” to fetch one snapshot. A disconnected state is expected without keys; it is not a simulated live price. Upstream authentication, missing books or stale quotes return an unavailable state. No automatic fallback to synthetic data occurs.

Vercel runs the stateless dashboard and snapshot API. It does **not** run an always-on Hummingbot process, persist a ledger or maintain an exchange websocket. Run either collector on a local machine or persistent worker, then import its CSV. Do not mistake browser replay time for exchange clock time.

Local development: `npm ci && npm run dev`, then http://127.0.0.1:4180. Optional local variables go in `.env.local` (gitignored). `npm run preview` only previews static assets and cannot serve the API.

Productionization still requires deployed rate limiting, user authentication appropriate to the audience, permitted market-data redistribution, and persistent audit storage. The supplied token gate is for a limited demo, not a multi-tenant service.

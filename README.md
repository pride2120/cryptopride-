# CryptoPride Range Lab V3

V3 adds Robinhood Stock Token pool detection.

## New in V3
- Fetches Robinhood's canonical Stock Token registry from `https://api.robinhood.com/rhj/assets`.
- Matches Chain ID 4663 Stock Token contract addresses against Robinhood Chain pools from GeckoTerminal.
- Scans multiple GeckoTerminal pool pages (8 by default, configurable up to 10).
- Adds **All Pools / Robinhood Stock Tokens** filtering.
- Adds a STOCK TOKEN badge and ticker metadata in the pool directory.
- Keeps the Perfect Range engine, saved LP positions, challenge tracker, and MaxFi referral button.

## Deploy
Upload the contents of this folder to the root of your GitHub repository and let Vercel redeploy.

Required root structure:
- `index.html`
- `vercel.json`
- `package.json`
- `api/pools.js`
- `api/ohlcv.js`

After deployment, test `/api/pools?pages=8`. The response should include a `meta.stockPoolCount` value.

## Notes
Robinhood Stock Tokens are identified using Robinhood's canonical asset registry. Pool market data is sourced from GeckoTerminal. Because GeckoTerminal's public API is rate-limited and ranks network pools, this V3 scans the first 8 pages rather than issuing one API call per Stock Token. This makes the site much more practical on Vercel while still surfacing a broad set of Stock Token pools.

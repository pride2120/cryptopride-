# CryptoPride Range Lab V6

V6 adds a pool-specific width optimizer designed to behave more like a concentrated-liquidity strategy engine instead of a pure volatility calculator.

## New in V6

- Reads `tickSpacing()` and `fee()` directly from Robinhood Chain RPC when the selected pool exposes a Uniswap-V3-compatible interface.
- Snaps recommended and manual widths to valid tick-spacing increments.
- Optimizes candidate widths inside strategy-specific bands using rolling historical stay-in-range, modeled fee capture, concentration, a same-pair fee-efficiency competition proxy, and rebalance-delay burden.
- Adds a rebalance-delay control (0–48h).
- Adds a manual “MaxFi width shown” field for side-by-side comparison with CryptoPride’s independent optimized width.
- Preserves V5.7 reversed-pair pricing/history fixes, Robinhood Stock Token detection, APR engine, positions, and challenge tracker.

## Important limitation

V6 does **not** claim to reproduce MaxFi’s proprietary optimizer. MaxFi says its presets use on-chain liquidity distribution and historical pool data. V6 reads tick spacing on-chain, but exact tick-by-tick competing liquidity still requires an indexer or a more expensive tick scan. The current competition input is a transparent proxy based on same-pair volume/liquidity efficiency across the pools loaded by the app.

## Deploy

Keep this structure at the GitHub repo root:

- `index.html`
- `vercel.json`
- `package.json`
- `api/pools.js`
- `api/ohlcv.js`
- `api/pool-state.js`

Commit to the repository connected to Vercel. Vercel should redeploy automatically.

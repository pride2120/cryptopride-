# CryptoPride Range Lab V5.1

Fixes Stock Token pool orientation so range calculations use the Stock Token price even when it is the quote token in GeckoTerminal. OHLCV requests now explicitly use `token=base` or `token=quote` to match the analyzed asset.

# CryptoPride Range Lab V5

V5 upgrades the APR model so the dashboard does not treat every pool as a fixed 0.30% fee pool.

## New in V5

- Adds an LP fee-tier selector: 0.01%, 0.05%, 0.30%, or 1.00%.
- Attempts to detect a fee tier from pool metadata/name when it is available; otherwise the selected fee tier is used.
- Separates **Base Pool APR** from **Range-Adjusted APR**.
- Base Pool APR = `(24h volume × LP fee rate ÷ pool liquidity) × 365`.
- Range-Adjusted APR = `Base Pool APR × concentration multiplier × historical in-range factor`.
- Uses a width-based concentration curve calibrated so narrower ranges receive more capital-efficiency credit while wider ranges converge toward 1×.
- Uses loaded hourly OHLCV candles for the historical in-range factor on the selected pool.
- Shows the concentration multiplier and fit percentage directly under the Range-Adjusted APR.
- Keeps Perfect Width, Robinhood Stock Token detection, saved positions, challenge tracker, and MaxFi referral link.

## Important

This is an analytical estimate, not a quoted MaxFi APR. Pool volume, liquidity, routing, fee share, tick-level liquidity distribution, price movement, impermanent loss, and future activity can materially change realized returns. Verify the exact fee tier on MaxFi before depositing and select that tier in CryptoPride Range Lab if it is not detected automatically.

## Deploy

Keep this repository structure:

- `index.html`
- `vercel.json`
- `package.json`
- `api/pools.js`
- `api/ohlcv.js`

Upload the contents of this folder to the root of the GitHub repository connected to Vercel.

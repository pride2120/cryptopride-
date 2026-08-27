# CryptoPride Range Lab V4

V4 adds a MaxFi-style total **Range Width %** selector and an original **Perfect Width** recommendation engine while retaining Robinhood Stock Token pool detection.

## New in V4

- 0–100% Range Width slider. `0` means Auto / Perfect Width.
- `Use Perfect Width` button to apply the model recommendation.
- Range width follows MaxFi's convention: a 10% total width is approximately ±5% around spot when centered.
- Perfect Width uses recent hourly price history, current volatility and the selected risk mode to select a target total width.
- Aggressive, Sweet Spot, Conservative and Set & Forget modes use different historical-fit targets.
- Manual widths immediately recalculate range bounds, historical fit, modeled APR, fees and confidence.
- Keeps Robinhood Stock Token filters, saved LP positions, challenge tracker and MaxFi referral button.

## Important

The Perfect Width engine is CryptoPride's own analytics heuristic. It does not reproduce or claim to use MaxFi's proprietary optimization data. Actual LP performance can differ materially.

## Deploy

Upload the **contents** of this folder to the root of the GitHub repository connected to Vercel.

Required structure:

- `index.html`
- `vercel.json`
- `package.json`
- `api/pools.js`
- `api/ohlcv.js`

After deployment, verify `/api/pools?pages=8` returns JSON, then open the homepage.

# CryptoPride Range Lab V2

Independent Robinhood Chain concentrated-liquidity analytics dashboard.

## V2 features
- Live Robinhood Chain pool scanner via GeckoTerminal
- Perfect Range engine using recent hourly volatility
- Aggressive / Sweet Spot / Conservative / Set & Forget modes
- Historical in-range fit score
- Confidence score using historical fit, liquidity and activity
- Simplified modeled APR and fee estimator
- Saved LP positions with SAFE / WATCH / NEAR EDGE / OUT OF RANGE status
- $100 → $10,000 challenge tracker
- Search and ranking controls
- Zero package dependencies; deploy directly to Vercel

## Deploy
1. Create a GitHub repo and upload this folder.
2. In Vercel choose **Add New → Project**.
3. Import the repo and deploy with the defaults.
4. No environment variables are required for V2.

## Data/model notes
Market data comes from GeckoTerminal's Robinhood network endpoints. The fee estimator currently uses a 0.30% analytical fee assumption; it does not claim to reproduce MaxFi's proprietary APR or every pool's exact DEX fee tier. Verify the exact target pool before depositing.

Robinhood Chain is Ethereum-compatible and uses chain ID 4663. This project is independent and is not affiliated with MaxFi, Robinhood, Uniswap, or GeckoTerminal.

## V2.1 deployment fix
This build switches the Vercel API handlers to CommonJS for broad Node/Vercel compatibility, validates pool addresses, and adds a browser-side GeckoTerminal fallback if a serverless route is temporarily unavailable.

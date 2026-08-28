# CryptoPride Range Lab V5.3

V5.3 fixes pricing orientation for both Robinhood Stock Token pools and stablecoin/volatile-asset pools.

## Key fix

- Robinhood Stock Token pairs range around the Stock Token.
- Stablecoin pairs such as `USDG/WETH`, `USDC/WETH`, and `USDG/AVAX` range around the non-stable asset instead of the ~$1 stablecoin.
- OHLCV history requests use the same base/quote side selected for live pricing.
- Range, Perfect Width, historical fit, and Range-Adjusted APR are therefore calculated on the intended asset.

## Deploy

Upload these files to the root of the GitHub repository connected to Vercel:

```text
README.md
api/
  pools.js
  ohlcv.js
index.html
package.json
vercel.json
```

After deployment, test `/api/pools?pages=8` and search for `USDG / WETH`. The pool should show `focus_token_symbol` as `WETH`, `focus_token_side` as `quote` when USDG is the base token, and `focus_orientation_source` as `non-stable-side`.


## V5.6 reversed-pair fix

V5.6 builds a cross-pool reference-price map. If a pool is returned as USDG/WETH and GeckoTerminal does not expose a usable quote-token USD price, CryptoPride uses the median WETH USD price observed in the other Robinhood pools from the same scan. Reversed stable/volatile pool labels are normalized to volatile/stable order for clarity.


## V5.6 history fix
Reversed stable/volatile pools such as USDG/WETH now use a correctly oriented WETH/USDG reference pool for historical price candles. The selected pool still supplies its own 24h volume, liquidity, and LP fee tier for Base Pool APR. This prevents a $1 stablecoin OHLCV series from forcing historical fit, range-adjusted APR, and estimated fees to zero.

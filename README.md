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

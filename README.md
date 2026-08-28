# CryptoPride Range Lab V5.2

V5.2 fixes Stock Token pool orientation and pricing for reversed pairs such as `USDG / MU`.

## V5.2 stock-price fix

- Matches Robinhood Stock Tokens by canonical Chain ID 4663 contract address.
- Adds canonical ticker-symbol fallback for GeckoTerminal pool responses whose relationship metadata is incomplete.
- Adds pair-name fallback for reversed names such as `USDG / MU`.
- When the Stock Token is the quote side, derives its USD value from GeckoTerminal's pair ratios if `quote_token_price_usd` is unavailable.
- Requests OHLCV history for the same base/quote side used by the range calculator.
- Adds `meta.version: "5.2"` plus diagnostic fields in `/api/pools` so deployment can be verified.

## Required GitHub structure

```
README.md
api/
  pools.js
  ohlcv.js
index.html
package.json
vercel.json
```

After Vercel redeploys, open `/api/pools?pages=8`, search for `MU`, and verify that the MU pool has `focus_token_symbol: "MU"`, the correct `focus_token_side`, and a `focus_token_price_usd` well above $1.

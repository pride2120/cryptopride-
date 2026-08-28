const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools';
const RH_ASSETS = 'https://api.robinhood.com/rhj/assets';

function extractAddress(value) {
  const m = String(value || '').match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0].toLowerCase() : '';
}

function normSymbol(v) {
  return String(v || '').trim().toUpperCase();
}

function includedToken(map, id) {
  const obj = map.get(id) || {};
  return obj.attributes || {};
}

function goodPrice(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function deriveFocusPrice(pa, side) {
  const baseUsd = goodPrice(pa.base_token_price_usd);
  const quoteUsd = goodPrice(pa.quote_token_price_usd);
  const baseInQuote = goodPrice(pa.base_token_price_quote_token);
  const quoteInBase = goodPrice(pa.quote_token_price_base_token);

  if (side === 'base') {
    if (baseUsd) return baseUsd;
    if (quoteUsd && baseInQuote) return quoteUsd * baseInQuote;
    if (quoteUsd && quoteInBase) return quoteUsd / quoteInBase;
    return 0;
  }

  if (quoteUsd) return quoteUsd;
  if (baseUsd && quoteInBase) return baseUsd * quoteInBase;
  if (baseUsd && baseInQuote) return baseUsd / baseInQuote;
  return 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pagesRequested = Math.min(Math.max(Number(req.query?.pages || 8), 1), 10);

  try {
    const assetsResp = await fetch(RH_ASSETS, {
      headers: { accept: 'application/json', 'user-agent': 'CryptoPride-Range-Lab/5.2' }
    });
    if (!assetsResp.ok) throw new Error(`Robinhood assets HTTP ${assetsResp.status}`);
    const assetsJson = await assetsResp.json();
    const assets = Array.isArray(assetsJson.assets) ? assetsJson.assets : [];

    const stockByAddress = new Map();
    const stockBySymbol = new Map();
    for (const asset of assets) {
      if (asset.status && asset.status !== 'ASSET_STATUS_ACTIVE') continue;
      const stock = {
        symbol: normSymbol(asset.tokenSymbol),
        name: asset.tokenName || '',
        logoUrl: asset.logoUrl || '',
        multiplier: asset.currentMultiplier || '1'
      };
      if (stock.symbol) stockBySymbol.set(stock.symbol, stock);
      for (const dep of asset.deployments || []) {
        if (Number(dep.chainId) !== 4663) continue;
        const address = String(dep.contractAddress || '').toLowerCase();
        if (address) stockByAddress.set(address, stock);
      }
    }

    const allPools = [];
    const includedById = new Map();

    for (let page = 1; page <= pagesRequested; page++) {
      const url = `${GT_BASE}?include=base_token,quote_token,dex&page=${page}`;
      const response = await fetch(url, {
        headers: {
          accept: 'application/json;version=20230203',
          'user-agent': 'CryptoPride-Range-Lab/5.2'
        }
      });
      if (!response.ok) {
        if (page === 1) throw new Error(`GeckoTerminal HTTP ${response.status}`);
        break;
      }
      const json = await response.json();
      const pagePools = Array.isArray(json.data) ? json.data : [];
      for (const item of json.included || []) includedById.set(item.id, item);
      if (!pagePools.length) break;
      allPools.push(...pagePools);
      if (pagePools.length < 20) break;
    }

    const tagged = allPools.map(pool => {
      const pa = pool.attributes || {};
      const baseId = pool?.relationships?.base_token?.data?.id || '';
      const quoteId = pool?.relationships?.quote_token?.data?.id || '';
      const baseInc = includedToken(includedById, baseId);
      const quoteInc = includedToken(includedById, quoteId);

      const baseAddress = extractAddress(baseId) || extractAddress(baseInc.address);
      const quoteAddress = extractAddress(quoteId) || extractAddress(quoteInc.address);
      const baseSymbol = normSymbol(baseInc.symbol || baseInc.name?.split(' ')[0]);
      const quoteSymbol = normSymbol(quoteInc.symbol || quoteInc.name?.split(' ')[0]);

      // Primary match: canonical Robinhood contract address.
      // Fallback: canonical Robinhood ticker. This catches pool feeds where token
      // relationship/address metadata is incomplete or represented differently.
      let baseStock = stockByAddress.get(baseAddress) || stockBySymbol.get(baseSymbol) || null;
      let quoteStock = stockByAddress.get(quoteAddress) || stockBySymbol.get(quoteSymbol) || null;
      let orientationSource = baseStock || quoteStock ? (stockByAddress.has(baseAddress) || stockByAddress.has(quoteAddress) ? 'address' : 'symbol') : 'none';

      // Final fallback: inspect GeckoTerminal's pool display name, e.g. "USDG / MU".
      if (!baseStock && !quoteStock) {
        const name = String(pa.name || '');
        const pairPart = name.split(/\s+on\s+/i)[0];
        const pairSymbols = pairPart.split('/').slice(0, 2).map(x => normSymbol(x.replace(/[^A-Za-z0-9._-].*$/, '')));
        if (pairSymbols[0] && stockBySymbol.has(pairSymbols[0])) baseStock = stockBySymbol.get(pairSymbols[0]);
        if (pairSymbols[1] && stockBySymbol.has(pairSymbols[1])) quoteStock = stockBySymbol.get(pairSymbols[1]);
        if (baseStock || quoteStock) orientationSource = 'pair-name';
      }

      const stockAssets = [baseStock, quoteStock].filter(Boolean);
      const focusStock = baseStock || quoteStock || null;
      const focusSide = baseStock ? 'base' : quoteStock ? 'quote' : 'base';
      const basePrice = goodPrice(pa.base_token_price_usd);
      const derivedFocus = deriveFocusPrice(pa, focusSide);
      const focusPrice = derivedFocus || basePrice;
      const rawChange = Number(pa.price_change_percentage?.h24 || 0);
      const focusChange = focusSide === 'quote' ? -rawChange : rawChange;

      return {
        ...pool,
        attributes: {
          ...pa,
          is_stock_pool: stockAssets.length > 0,
          stock_symbols: stockAssets.map(x => x.symbol),
          stock_token_names: stockAssets.map(x => x.name),
          focus_token_side: focusSide,
          focus_token_symbol: focusStock?.symbol || baseSymbol || '',
          focus_token_name: focusStock?.name || '',
          focus_token_address: focusSide === 'quote' ? quoteAddress : baseAddress,
          focus_token_price_usd: focusPrice,
          focus_price_change_percentage_h24: Number.isFinite(focusChange) ? focusChange : rawChange,
          focus_orientation_source: orientationSource,
          debug_base_symbol: baseSymbol,
          debug_quote_symbol: quoteSymbol,
          debug_base_price_usd: basePrice,
          debug_quote_price_usd: goodPrice(pa.quote_token_price_usd)
        }
      };
    });

    const stockPoolCount = tagged.filter(p => p.attributes?.is_stock_pool).length;
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      data: tagged,
      meta: {
        version: '5.2',
        pagesScanned: pagesRequested,
        poolCount: tagged.length,
        stockPoolCount,
        robinhoodStockTokens: stockByAddress.size,
        chainId: 4663
      }
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Robinhood pool fetch failed',
      detail: error && error.message ? error.message : String(error)
    });
  }
};

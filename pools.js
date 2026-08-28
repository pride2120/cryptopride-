const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools';
const RH_ASSETS = 'https://api.robinhood.com/rhj/assets';

function extractAddress(value) {
  const m = String(value || '').match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0].toLowerCase() : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pagesRequested = Math.min(Math.max(Number(req.query?.pages || 8), 1), 10);

  try {
    const assetsResp = await fetch(RH_ASSETS, {
      headers: { accept: 'application/json', 'user-agent': 'CryptoPride-Range-Lab/5.1' }
    });
    if (!assetsResp.ok) throw new Error(`Robinhood assets HTTP ${assetsResp.status}`);
    const assetsJson = await assetsResp.json();
    const assets = Array.isArray(assetsJson.assets) ? assetsJson.assets : [];

    const stockByAddress = new Map();
    for (const asset of assets) {
      if (asset.status && asset.status !== 'ASSET_STATUS_ACTIVE') continue;
      for (const dep of asset.deployments || []) {
        if (Number(dep.chainId) !== 4663) continue;
        const address = String(dep.contractAddress || '').toLowerCase();
        if (!address) continue;
        stockByAddress.set(address, {
          symbol: asset.tokenSymbol,
          name: asset.tokenName,
          logoUrl: asset.logoUrl || '',
          multiplier: asset.currentMultiplier || '1'
        });
      }
    }

    const allPools = [];
    const includedById = new Map();

    for (let page = 1; page <= pagesRequested; page++) {
      const url = `${GT_BASE}?include=base_token,quote_token,dex&page=${page}`;
      const response = await fetch(url, {
        headers: {
          accept: 'application/json;version=20230203',
          'user-agent': 'CryptoPride-Range-Lab/5.1'
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
      const baseId = pool?.relationships?.base_token?.data?.id || '';
      const quoteId = pool?.relationships?.quote_token?.data?.id || '';
      const baseAddress = extractAddress(baseId) || extractAddress(includedById.get(baseId)?.attributes?.address);
      const quoteAddress = extractAddress(quoteId) || extractAddress(includedById.get(quoteId)?.attributes?.address);
      const baseStock = stockByAddress.get(baseAddress);
      const quoteStock = stockByAddress.get(quoteAddress);
      const stockAssets = [baseStock, quoteStock].filter(Boolean);
      const focusStock = baseStock || quoteStock || null;
      const focusSide = baseStock ? 'base' : quoteStock ? 'quote' : 'base';
      const pa = pool.attributes || {};
      const basePrice = Number(pa.base_token_price_usd || 0);
      const quotePrice = Number(pa.quote_token_price_usd || 0);
      const rawChange = Number(pa.price_change_percentage?.h24 || 0);
      // For Stock Token pools, always center analytics on the stock token itself.
      // GeckoTerminal's pool OHLCV defaults to the base token, so we preserve
      // whether the stock is base or quote and request matching candles later.
      const focusPrice = focusSide === 'quote' ? quotePrice : basePrice;
      const focusChange = focusSide === 'quote' ? -rawChange : rawChange;
      return {
        ...pool,
        attributes: {
          ...pa,
          is_stock_pool: stockAssets.length > 0,
          stock_symbols: stockAssets.map(x => x.symbol),
          stock_token_names: stockAssets.map(x => x.name),
          focus_token_side: focusSide,
          focus_token_symbol: focusStock?.symbol || '',
          focus_token_name: focusStock?.name || '',
          focus_token_address: focusSide === 'quote' ? quoteAddress : baseAddress,
          focus_token_price_usd: Number.isFinite(focusPrice) && focusPrice > 0 ? focusPrice : basePrice,
          focus_price_change_percentage_h24: Number.isFinite(focusChange) ? focusChange : rawChange
        }
      };
    });

    const stockPoolCount = tagged.filter(p => p.attributes?.is_stock_pool).length;
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      data: tagged,
      meta: {
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

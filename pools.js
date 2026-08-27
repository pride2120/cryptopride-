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
      headers: { accept: 'application/json', 'user-agent': 'CryptoPride-Range-Lab/3.0' }
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
          'user-agent': 'CryptoPride-Range-Lab/3.0'
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
      return {
        ...pool,
        attributes: {
          ...(pool.attributes || {}),
          is_stock_pool: stockAssets.length > 0,
          stock_symbols: stockAssets.map(x => x.symbol),
          stock_token_names: stockAssets.map(x => x.name)
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

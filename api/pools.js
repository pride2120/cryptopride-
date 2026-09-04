const GT_BASE = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools';
const RH_ASSETS = 'https://api.robinhood.com/rhj/assets';
const GT_TOKEN_POOLS = 'https://api.geckoterminal.com/api/v2/networks/robinhood/tokens';
const RH_RPC = process.env.RH_RPC || 'https://rpc.mainnet.chain.robinhood.com';
const UNISWAP_V3_FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa';

  const POOL_CREATED_TOPIC =
  '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118';

async function rpc(method, params = []) {
  const response = await fetch(RH_RPC, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'CryptoPride-Range-Lab/6.0'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });

  if (!response.ok) {
  const detail = await response.text();
  throw new Error(`Robinhood RPC HTTP ${response.status}: ${detail.slice(0, 500)}`);
}

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message || 'Robinhood RPC error');
  }

  return json.result;
}
  function addressTopic(address) {
  const clean = String(address || '').toLowerCase().replace(/^0x/, '');
  return `0x${clean.padStart(64, '0')}`;
}

function topicToAddress(topic) {
  const clean = String(topic || '').replace(/^0x/, '');
  return clean.length >= 40 ? `0x${clean.slice(-40)}`.toLowerCase() : '';
}

function decodePoolCreatedLog(log) {
  
  const token0 = topicToAddress(log?.topics?.[1]);
  const token1 = topicToAddress(log?.topics?.[2]);
  const fee = log?.topics?.[3] ? Number(BigInt(log.topics[3])) : 0;

  const data = String(log?.data || '').replace(/^0x/, '');
  const poolWord = data.slice(64, 128);
  const pool = poolWord.length === 64
    ? `0x${poolWord.slice(-40)}`.toLowerCase()
    : '';

  return {
    token0,
    token1,
    fee,
    pool
  };
}
function encodeAddressWord(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/^0x/, '')
    .padStart(64, '0');
}

function encodeUintWord(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function decodeAddressWord(value) {
  const clean = String(value || '').replace(/^0x/, '');
  if (clean.length < 64) return '';
  const address = `0x${clean.slice(-40)}`.toLowerCase();
  return /^0x0{40}$/.test(address) ? '' : address;
}

async function factoryGetPool(tokenA, tokenB, fee) {
  const data =
    '0x1698ee82' +
    encodeAddressWord(tokenA) +
    encodeAddressWord(tokenB) +
    encodeUintWord(fee);

  const result = await rpc('eth_call', [{
    to: UNISWAP_V3_FACTORY,
    data
  }, 'latest']);

  return decodeAddressWord(result);
}
async function poolEthCall(poolAddress, selector) {
  return rpc('eth_call', [{
    to: poolAddress,
    data: selector
  }, 'latest']);
}
async function readOnChainPoolState(poolAddress) {
  const [token0Raw, token1Raw, feeRaw, liquidityRaw, slot0Raw] = await Promise.all([
  poolEthCall(poolAddress, '0x0dfe1681'),
  poolEthCall(poolAddress, '0xd21220a7'),
  poolEthCall(poolAddress, '0xddca3f43'),
  poolEthCall(poolAddress, '0x1a686502'),
  poolEthCall(poolAddress, '0x3850c7bd')
]);
const slot0Clean = String(slot0Raw || '').replace(/^0x/, '');
const sqrtPriceX96 = slot0Clean.length >= 64
  ? BigInt(`0x${slot0Clean.slice(0, 64)}`).toString()
  : '0';
  return {
    token0: decodeAddressWord(token0Raw),
    token1: decodeAddressWord(token1Raw),
    fee: Number(BigInt(feeRaw || '0x0')),
    liquidity: BigInt(liquidityRaw || '0x0').toString(),
    sqrtPriceX96
  };
}
function sqrtPriceX96ToRawRatio(sqrtPriceX96) {
  const sqrt = Number(sqrtPriceX96 || 0);

  if (!Number.isFinite(sqrt) || sqrt <= 0) {
    return 0;
  }

  const q96 = 2 ** 96;
  const ratio = (sqrt / q96) ** 2;

  return Number.isFinite(ratio) && ratio > 0 ? ratio : 0;
}
async function readTokenDecimals(tokenAddress) {
  const raw = await poolEthCall(tokenAddress, '0x313ce567').catch(() => '0x0');

  try {
    return Number(BigInt(raw || '0x0'));
  } catch {
    return 18;
  }
}
function buildOnChainPoolRecord(discovered, state) {
  const token0Id = `robinhood_${state.token0}`;
  const token1Id = `robinhood_${state.token1}`;
const rawRatio = sqrtPriceX96ToRawRatio(state.sqrtPriceX96);
const decimalAdjustedRatio =
  rawRatio * (10 ** (state.token0Decimals - state.token1Decimals));
  return {
    id: `robinhood_${discovered.pool}`,
    type: 'pool',
    attributes: {
      address: discovered.pool,
      name: `On-chain pool ${state.fee}`,
      reserve_in_usd: '0',
      volume_usd: {
        m5: '0',
        m15: '0',
        m30: '0',
        h1: '0',
        h6: '0',
        h24: '0'
      },
      price_change_percentage: {
        m5: '0',
        m15: '0',
        m30: '0',
        h1: '0',
        h6: '0',
        h24: '0'
      },
      on_chain_only: true,
      on_chain_liquidity: state.liquidity,
      fee_tier: state.fee,
      raw_token_ratio: rawRatio,
decimal_adjusted_ratio: decimalAdjustedRatio,
    on_chain_stock_side: state.stockSide
      },
    relationships: {
      base_token: {
        data: {
          id: token0Id,
          type: 'token'
        }
      },
      quote_token: {
        data: {
          id: token1Id,
          type: 'token'
        }
      }
    }
  };
}
async function fetchOnChainStockPools(
  stockAddresses,
  candidateTokenAddresses = []
) {
  const fees = [100, 200, 460, 500, 3000, 9000, 10000];
  const unique = new Map();

  if (!candidateTokenAddresses.length) return [];

  for (const stockAddress of stockAddresses) {
    for (const otherAddress of candidateTokenAddresses) {
      if (
        !stockAddress ||
        !otherAddress ||
        stockAddress.toLowerCase() === otherAddress.toLowerCase()
      ) continue;

      for (const fee of fees) {
        const pool = await factoryGetPool(
          stockAddress,
          otherAddress,
          fee
        ).catch(() => '');

        if (pool) {
          unique.set(pool, {
            pool,
            token0: stockAddress.toLowerCase(),
            token1: otherAddress.toLowerCase(),
            fee
          });
        }
      }
    }
  }

  return [...unique.values()];
}
function extractAddress(value) {
  const m = String(value || '').match(/0x[a-fA-F0-9]{40}/);
  return m ? m[0].toLowerCase() : '';
}

function normSymbol(v) {
  return String(v || '').trim().toUpperCase();
}

function pairSymbolsFromName(name) {
  const pairPart = String(name || '').split(/\s+on\s+/i)[0];
  const raw = pairPart.split('/').slice(0, 2);
  return raw.map(part => {
    const m = String(part || '').trim().match(/^([A-Za-z0-9._-]+)/);
    return normSymbol(m ? m[1] : '');
  });
}

const STABLE_SYMBOLS = new Set([
  'USDG', 'USDC', 'USDT', 'DAI', 'USDS', 'FDUSD', 'TUSD', 'USDE', 'PYUSD', 'USD1'
]);

function isStableSymbol(symbol) {
  return STABLE_SYMBOLS.has(normSymbol(symbol));
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
async function fetchTokenPools(tokenAddress) {
  const url = `${GT_TOKEN_POOLS}/${tokenAddress}/pools?include=base_token,quote_token,dex`;
  const r = await fetch(url, {
    headers: {
      accept: 'application/json;version=20230203',
      'user-agent': 'CryptoPride-Range-Lab/6.0'
    }
  });

  if (!r.ok) return { data: [], included: [] };

  const j = await r.json();

  return {
    data: Array.isArray(j.data) ? j.data : [],
    included: Array.isArray(j.included) ? j.included : []
  };
}
async function fetchPoolByAddress(poolAddress) {
  const url = `${GT_BASE}/${poolAddress}?include=base_token,quote_token,dex`;

  const r = await fetch(url, {
    headers: {
      accept: 'application/json;version=20230203',
      'user-agent': 'CryptoPride-Range-Lab/6.0'
    }
  });

  if (!r.ok) return { pool: null, included: [] };

  const j = await r.json();

  return {
    pool: j?.data || null,
    included: Array.isArray(j?.included) ? j.included : []
  };
}
async function fetchPoolsByAddresses(poolAddresses) {
  const addresses = poolAddresses.filter(Boolean).join(',');

  if (!addresses) {
    return { data: [], included: [] };
  }

  const url = `${GT_BASE}/multi/${addresses}?include=base_token,quote_token,dex`;

  const r = await fetch(url, {
    headers: {
      accept: 'application/json;version=20230203',
      'user-agent': 'CryptoPride-Range-Lab/6.0'
    }
  });

  if (!r.ok) {
    return { data: [], included: [] };
  }

  const j = await r.json();

  return {
    data: Array.isArray(j?.data) ? j.data : [],
    included: Array.isArray(j?.included) ? j.included : []
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pagesRequested = Math.min(Math.max(Number(req.query?.pages || 8), 1), 20);

  try {
    const assetsResp = await fetch(RH_ASSETS, {
      headers: { accept: 'application/json', 'user-agent': 'CryptoPride-Range-Lab/6.0' }
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
          'user-agent': 'CryptoPride-Range-Lab/6.0'
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
    
    // Discover additional Robinhood stock-token pools that may not appear
    // in GeckoTerminal's first ranked network pages.
    const seenTokenAddresses = new Set();

    for (const pool of allPools) {
      const baseId = pool?.relationships?.base_token?.data?.id || '';
      const quoteId = pool?.relationships?.quote_token?.data?.id || '';

      const baseAddress = extractAddress(baseId);
      const quoteAddress = extractAddress(quoteId);

      if (baseAddress) seenTokenAddresses.add(baseAddress);
      if (quoteAddress) seenTokenAddresses.add(quoteAddress);
    }

    const missingStockAddresses = [...stockByAddress.keys()]
      .filter(address => !seenTokenAddresses.has(address))
      .slice(0, 10);
    const candidateTokenAddresses = [...new Set(
  [...includedById.values()]
    .filter(item => ['WETH', 'USDG', 'USDC'].includes(
      String(item?.attributes?.symbol || '').toUpperCase()
    ))
    .map(item =>
      extractAddress(item?.id) ||
      extractAddress(item?.attributes?.address)
    )
    .filter(Boolean)
)];
const onChainStockPools = await fetchOnChainStockPools(
  missingStockAddresses,
  candidateTokenAddresses
);
    
    const onChainPoolCount = onChainStockPools.length;
let onChainStateCount = 0;
const onChainBuiltPools = [];
let onChainPricedRatioCount = 0;
    let onChainBaseStockCount = 0;
let onChainQuoteStockCount = 0;
for (const discovered of onChainStockPools) {
  const state = await readOnChainPoolState(discovered.pool).catch(() => null);

  if (state?.token0 && state?.token1) {
    const [token0Decimals, token1Decimals] = await Promise.all([
      readTokenDecimals(state.token0),
      readTokenDecimals(state.token1)
    ]);

    state.token0Decimals = token0Decimals;
    state.token1Decimals = token1Decimals;
state.stockSide = stockByAddress.has(state.token0)
  ? 'base'
  : stockByAddress.has(state.token1)
    ? 'quote'
    : '';

if (state.stockSide === 'base') {
  onChainBaseStockCount++;
}

if (state.stockSide === 'quote') {
  onChainQuoteStockCount++;
}
        onChainStateCount++;
    onChainBuiltPools.push(
      buildOnChainPoolRecord(discovered, state)
    );
    const built = onChainBuiltPools[onChainBuiltPools.length - 1];

if (built?.attributes?.decimal_adjusted_ratio > 0) {
  onChainPricedRatioCount++;
}
  }
}
    let onChainPoolsAdded = 0;
let onChainDuplicateCount = 0;
for (const discovered of onChainStockPools) {
  const extra = await fetchPoolByAddress(discovered.pool);

  for (const item of extra.included) {
    includedById.set(item.id, item);
  }

  const builtPool = onChainBuiltPools.find(
    pool =>
      String(pool?.attributes?.address || '').toLowerCase() ===
      discovered.pool.toLowerCase()
  );

  const poolToAdd = extra.pool || builtPool || null;
const alreadyExists = allPools.some(
  existing =>
    extractAddress(existing.id) === discovered.pool.toLowerCase() ||
    extractAddress(existing?.attributes?.address) === discovered.pool.toLowerCase()
);

if (alreadyExists) {
  onChainDuplicateCount++;
}
  if (
  poolToAdd &&
  !alreadyExists
) {
    allPools.push(poolToAdd);
    onChainPoolsAdded++;
  }
}
  
let extraPoolsDiscovered = 0;
    for (const tokenAddress of missingStockAddresses) {
      const extra = await fetchTokenPools(tokenAddress);

      for (const item of extra.included) {
        includedById.set(item.id, item);
      }

      for (const pool of extra.data) {
        if (!allPools.some(existing => existing.id === pool.id)) {
  allPools.push(pool);
  extraPoolsDiscovered++;
}
        }
      }
    
    
    const preliminary = allPools.map(pool => {
      const pa = pool.attributes || {};
      const baseId = pool?.relationships?.base_token?.data?.id || '';
      const quoteId = pool?.relationships?.quote_token?.data?.id || '';
      const baseInc = includedToken(includedById, baseId);
      const quoteInc = includedToken(includedById, quoteId);

      const baseAddress = extractAddress(baseId) || extractAddress(baseInc.address);
      const quoteAddress = extractAddress(quoteId) || extractAddress(quoteInc.address);
      const nameSymbols = pairSymbolsFromName(pa.name);
      const baseSymbol = normSymbol(baseInc.symbol || baseInc.name?.split(' ')[0] || nameSymbols[0]);
      const quoteSymbol = normSymbol(quoteInc.symbol || quoteInc.name?.split(' ')[0] || nameSymbols[1]);

      // Primary match: canonical Robinhood contract address.
      // Fallback: canonical Robinhood ticker. This catches pool feeds where token
      // relationship/address metadata is incomplete or represented differently.
      let baseStock = stockByAddress.get(baseAddress) || stockBySymbol.get(baseSymbol) || null;
      let quoteStock = stockByAddress.get(quoteAddress) || stockBySymbol.get(quoteSymbol) || null;
      let orientationSource = baseStock || quoteStock ? (stockByAddress.has(baseAddress) || stockByAddress.has(quoteAddress) ? 'address' : 'symbol') : 'none';

      // Final fallback: inspect GeckoTerminal's pool display name, e.g. "USDG / MU".
      if (!baseStock && !quoteStock) {
        const pairSymbols = pairSymbolsFromName(pa.name);
        if (pairSymbols[0] && stockBySymbol.has(pairSymbols[0])) baseStock = stockBySymbol.get(pairSymbols[0]);
        if (pairSymbols[1] && stockBySymbol.has(pairSymbols[1])) quoteStock = stockBySymbol.get(pairSymbols[1]);
        if (baseStock || quoteStock) orientationSource = 'pair-name';
      }

      const stockAssets = [baseStock, quoteStock].filter(Boolean);
      const focusStock = baseStock || quoteStock || null;

      // Choose the asset users actually want to range around:
      // 1) Robinhood Stock Token if present.
      // 2) For stable/volatile pairs (USDG/WETH, USDC/WETH, etc.), choose the non-stable asset.
      // 3) Otherwise retain GeckoTerminal base-token orientation.
      const baseStable = isStableSymbol(baseSymbol);
      const quoteStable = isStableSymbol(quoteSymbol);
      let focusSide = baseStock ? 'base' : quoteStock ? 'quote' : 'base';
      let focusReason = focusStock ? 'stock-token' : 'base-default';
      if (!focusStock && baseStable !== quoteStable) {
        focusSide = baseStable ? 'quote' : 'base';
        focusReason = 'non-stable-side';
      }

      const focusSymbol = focusSide === 'quote' ? quoteSymbol : baseSymbol;
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
          focus_token_symbol: focusStock?.symbol || focusSymbol || '',
          focus_token_name: focusStock?.name || (focusSide === 'quote' ? quoteInc.name || '' : baseInc.name || ''),
          focus_token_address: focusSide === 'quote' ? quoteAddress : baseAddress,
          focus_token_price_usd: focusPrice,
          focus_price_change_percentage_h24: Number.isFinite(focusChange) ? focusChange : rawChange,
          focus_orientation_source: focusStock ? orientationSource : focusReason,
          debug_base_symbol: baseSymbol,
          debug_quote_symbol: quoteSymbol,
          debug_base_price_usd: basePrice,
          debug_quote_price_usd: goodPrice(pa.quote_token_price_usd)
        }
      };
    });


    // Build a cross-pool USD reference-price map. GeckoTerminal sometimes returns
    // reversed stable/volatile pools (for example USDG / WETH) without a usable
    // quote-token USD price. Other pools for the same volatile token are usually
    // correctly oriented (WETH / USDG), so use their reliable USD price as a
    // network reference rather than falling back to the $1 stablecoin side.
    const priceSamples = new Map();
    function addSample(symbol, price) {
      symbol = normSymbol(symbol);
      price = goodPrice(price);
      if (!symbol || isStableSymbol(symbol) || !price) return;
      if (!priceSamples.has(symbol)) priceSamples.set(symbol, []);
      priceSamples.get(symbol).push(price);
    }
    for (const pool of preliminary) {
      const a = pool.attributes || {};
      const b = normSymbol(a.debug_base_symbol);
      const q = normSymbol(a.debug_quote_symbol);
      const bp = goodPrice(a.debug_base_price_usd);
      const qp = goodPrice(a.debug_quote_price_usd);
      // Base-token USD prices are the most consistently populated field.
      if (!isStableSymbol(b) && bp > 0) addSample(b, bp);
      if (!isStableSymbol(q) && qp > 0) addSample(q, qp);
      // Stock-token focus prices are also trustworthy when materially above a stable price.
      const fp = goodPrice(a.focus_token_price_usd);
      if (a.focus_token_symbol && !isStableSymbol(a.focus_token_symbol) && fp > 1.5) {
        addSample(a.focus_token_symbol, fp);
      }
    }
    const referencePrice = new Map();
    for (const [symbol, values] of priceSamples) {
      const clean = values.filter(v => Number.isFinite(v) && v > 0).sort((a,b)=>a-b);
      if (!clean.length) continue;
      const mid = Math.floor(clean.length / 2);
      const median = clean.length % 2 ? clean[mid] : (clean[mid-1] + clean[mid]) / 2;
      referencePrice.set(symbol, median);
    }

    // Pick a correctly oriented, liquid reference pool for historical candles for each
    // volatile token. This is important for reversed pools such as USDG / WETH, where
    // GeckoTerminal can return quote-side OHLCV on the stablecoin scale even though the
    // focus asset is WETH. We use this reference only for price history / fit, never for
    // the selected pool's volume, liquidity, or fee tier.
    const historyReference = new Map();
    for (const pool of preliminary) {
      const a = pool.attributes || {};
      const base = normSymbol(a.debug_base_symbol);
      const quote = normSymbol(a.debug_quote_symbol);
      const basePrice = goodPrice(a.debug_base_price_usd);
      const liq = Number(a.reserve_in_usd || 0);
      const address = extractAddress(pool.id) || extractAddress(a.address);
      if (!address || !base || isStableSymbol(base) || !isStableSymbol(quote) || basePrice <= 1.5) continue;
      const prev = historyReference.get(base);
      if (!prev || liq > prev.liquidity) {
        historyReference.set(base, { address, side: 'base', liquidity: liq, price: basePrice, name: a.name || '' });
      }
    }

    const tagged = preliminary.map(pool => {
      const a = pool.attributes || {};
      const focusSymbol = normSymbol(a.focus_token_symbol);
      let focusPrice = goodPrice(a.focus_token_price_usd);
      const ref = referencePrice.get(focusSymbol) || 0;
      const baseStable = isStableSymbol(a.debug_base_symbol);
      const quoteStable = isStableSymbol(a.debug_quote_symbol);
      const isReversedStablePair = baseStable && !quoteStable && a.focus_token_side === 'quote';

      // Hard correction: never let a volatile quote token inherit a ~$1 stablecoin price.
      // If GeckoTerminal cannot derive the quote-token USD price, use the median price
      // observed for that same token across the other Robinhood pools in this scan.
      if (isReversedStablePair && ref > 0 && (focusPrice <= 1.5 || Math.abs(focusPrice - 1) < 0.25)) {
        focusPrice = ref;
      }

      const feeMatch = String(a.name || '').match(/(0\.01|0\.02|0\.046|0\.05|0\.3|0\.30|1(?:\.0+)?)%/i);
      let displayName = a.name || '';
      if (isReversedStablePair && focusSymbol) {
        const stable = normSymbol(a.debug_base_symbol);
        displayName = `${focusSymbol} / ${stable}${feeMatch ? ' ' + feeMatch[1] + '%' : ''}`;
      }

      const histRef = historyReference.get(focusSymbol) || null;
      const ownAddress = extractAddress(pool.id) || extractAddress(a.address);
      const useHistoryReference = Boolean(isReversedStablePair && histRef && histRef.address !== ownAddress);

      return {
        ...pool,
        attributes: {
          ...a,
          focus_token_price_usd: focusPrice,
          reference_token_price_usd: ref || null,
          display_name: displayName,
          focus_orientation_source: isReversedStablePair && ref > 0 ? 'cross-pool-reference' : a.focus_orientation_source,
          history_pool_address: useHistoryReference ? histRef.address : ownAddress,
          history_token_side: useHistoryReference ? histRef.side : a.focus_token_side,
          history_reference_symbol: useHistoryReference ? focusSymbol : null,
          history_reference_name: useHistoryReference ? histRef.name : null
        }
      };
    });

    const stockPoolCount = tagged.filter(p => p.attributes?.is_stock_pool).length;
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      data: tagged,
      meta: {
        version: '6.0',
        pagesScanned: pagesRequested,
        poolCount: tagged.length,
        stockPoolCount,
        robinhoodStockTokens: stockByAddress.size,
        extraPoolsDiscovered,
        onChainPoolCount,
        onChainStateCount,
        onChainPricedRatioCount,
        onChainBaseStockCount,
onChainQuoteStockCount,
        onChainPoolsAdded,
        onChainDuplicateCount,
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

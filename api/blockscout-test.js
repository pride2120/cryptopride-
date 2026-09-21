const BLOCKSCOUT_API_KEY = process.env.BLOCKSCOUT_API_KEY || '';
const RH_RPC = process.env.RH_RPC || 'https://rpc.mainnet.chain.robinhood.com';

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
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message || 'RPC error');
  }

  return json.result;
}
function decodeSigned256(hexWord) {
  const value = BigInt(`0x${hexWord}`);
  const max = 1n << 255n;
  const full = 1n << 256n;

  return value >= max ? value - full : value;
}
async function fetchBlockscoutSwapLogs(poolAddress) {
  if (!BLOCKSCOUT_API_KEY) {
    throw new Error('BLOCKSCOUT_API_KEY is missing');
  }

  const swapTopic =
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

  const latestHex = await rpc('eth_blockNumber');
  const latestBlock = Number(BigInt(latestHex));

  const fromBlock = Math.max(0, latestBlock - 900000);

 const allLogs = [];

for (let page = 1; page <= 10; page++) {
  const url =
    `https://api.blockscout.com/v2/api?chain_id=4663` +
    `&module=logs&action=getLogs` +
    `&fromBlock=${fromBlock}` +
    `&toBlock=${latestBlock}` +
    `&address=${poolAddress}` +
    `&topic0=${swapTopic}` +
    `&page=${page}` +
    `&offset=1000` +
    `&sort=desc` +
    `&apikey=${BLOCKSCOUT_API_KEY}`;

  const response = await fetch(url);
  const text = await response.text();

  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}

  const pageLogs = Array.isArray(json?.result) ? json.result : [];

  if (!pageLogs.length) break;

  allLogs.push(...pageLogs);

  if (pageLogs.length < 1000) break;
}

const uniqueLogs = [
  ...new Map(
    allLogs.map(log => [
      `${log?.transactionHash || ''}:${log?.logIndex || ''}`,
      log
    ])
  ).values()
];

const logs = uniqueLogs;

const cutoff = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

const last24hLogs = logs.filter(log => {
  const ts = Number.parseInt(String(log?.timeStamp || '0').replace(/^0x/, ''), 16);
  return Number.isFinite(ts) && ts >= cutoff;
});
const decoded24h = last24hLogs.map(log => {
  const data = String(log?.data || '').replace(/^0x/, '');

  if (data.length < 128) {
    return null;
  }

  const amount0 = decodeSigned256(data.slice(0, 64));
  const amount1 = decodeSigned256(data.slice(64, 128));

  return {
    transactionHash: log?.transactionHash || '',
    amount0: amount0.toString(),
    amount1: amount1.toString()
  };
}).filter(Boolean);
return {
  latestBlock,
  fromBlock,
  status: 200,
ok: true,
  resultCount: logs.length,
  rawResultCount: allLogs.length,
  last24hSwapCount: last24hLogs.length,
  decodedSwapCount: decoded24h.length,
  oldestReturnedTimestamp: logs.length
    ? logs.reduce((min, log) => {
        const ts = Number.parseInt(String(log?.timeStamp || '0').replace(/^0x/, ''), 16);
        return ts > 0 && ts < min ? ts : min;
      }, Number.MAX_SAFE_INTEGER)
    : null,
  newestReturnedTimestamp: logs.length
    ? logs.reduce((max, log) => {
        const ts = Number.parseInt(String(log?.timeStamp || '0').replace(/^0x/, ''), 16);
        return ts > max ? ts : max;
      }, 0)
    : null,
  sample: decoded24h.slice(0, 3),
  rawMessage: 'paged',
rawStatus: '1'
};
}

module.exports = async function handler(req, res) {
  try {
    const pool = String(req.query?.pool || '').trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(pool)) {
      return res.status(400).json({
        error: 'Valid pool address required'
      });
    }

    const result = await fetchBlockscoutSwapLogs(pool);

    return res.status(200).json({
      pool,
      ...result
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || String(error)
    });
  }
};

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

async function fetchBlockscoutSwapLogs(poolAddress) {
  if (!BLOCKSCOUT_API_KEY) {
    throw new Error('BLOCKSCOUT_API_KEY is missing');
  }

  const swapTopic =
    '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';

  const latestHex = await rpc('eth_blockNumber');
  const latestBlock = Number(BigInt(latestHex));

  const fromBlock = Math.max(0, latestBlock - 50000);

  const url =
    `https://api.blockscout.com/v2/api?chain_id=4663` +
    `&module=logs&action=getLogs` +
    `&fromBlock=${fromBlock}` +
    `&toBlock=${latestBlock}` +
    `&address=${poolAddress}` +
    `&topic0=${swapTopic}` +
    `&apikey=${BLOCKSCOUT_API_KEY}`;

  const response = await fetch(url);
  const text = await response.text();

  let json = {};
  try {
    json = JSON.parse(text);
  } catch {}

 const logs = Array.isArray(json?.result) ? json.result : [];

const cutoff = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

const last24hLogs = logs.filter(log => {
  const ts = Number.parseInt(String(log?.timeStamp || '0').replace(/^0x/, ''), 16);
  return Number.isFinite(ts) && ts >= cutoff;
});

return {
  latestBlock,
  fromBlock,
  status: response.status,
  ok: response.ok,
  resultCount: logs.length,
  last24hSwapCount: last24hLogs.length,
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
  sample: last24hLogs.slice(0, 3),
  rawMessage: json?.message || null,
  rawStatus: json?.status || null
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

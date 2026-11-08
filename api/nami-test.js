const ETH_RPC = 'https://ethereum-rpc.publicnode.com';

const POOL = '0x0572cf85ef493C9621e11821f2C739693F32F27F';

async function rpc(method, params = []) {
  const response = await fetch(ETH_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(json.error.message || 'RPC error');
  }

  return json.result;
}

function decodeAddress(result) {
  if (!result || result === '0x') return null;
  return `0x${result.slice(-40)}`;
}

module.exports = async function handler(req, res) {
  try {
    const token0Raw = await rpc('eth_call', [
      { to: POOL, data: '0x0dfe1681' },
      'latest'
    ]);

    const token1Raw = await rpc('eth_call', [
      { to: POOL, data: '0xd21220a7' },
      'latest'
    ]);
const liquidityRaw = await Promise.race([
  rpc('eth_call', [
    { to: POOL, data: '0x1a686502' },
    'latest'
  ]),
  new Promise(resolve =>
    setTimeout(() => resolve('RPC_TIMEOUT'), 5000)
  )
]);
    return res.status(200).json({
      pool: POOL,
      chain: 'ethereum',
      token0: decodeAddress(token0Raw),
      token1: decodeAddress(token1Raw),
      liquidityRaw
      globalStateRaw
                });
    const globalStateRaw = await rpc('eth_call', [
  { to: POOL, data: '0xe76c01e4' },
  'latest'
]);
  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
};

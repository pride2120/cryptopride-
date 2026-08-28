module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pool = String((req.query && req.query.pool) || '').trim();
  const requestedTimeframe = String((req.query && req.query.timeframe) || 'hour');
  const timeframe = ['minute', 'hour', 'day'].includes(requestedTimeframe) ? requestedTimeframe : 'hour';
  const rawLimit = Number((req.query && req.query.limit) || 168);
  const requestedToken = String((req.query && req.query.token) || 'base').toLowerCase();
  const token = requestedToken === 'quote' ? 'quote' : 'base';
  const limit = Math.max(24, Math.min(Number.isFinite(rawLimit) ? rawLimit : 168, 1000));

  if (!/^0x[a-fA-F0-9]{40}$/.test(pool)) {
    return res.status(400).json({ error: 'Invalid pool address' });
  }

  const url = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${pool}/ohlcv/${timeframe}?aggregate=1&limit=${limit}&currency=usd&token=${token}`;

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'CryptoPride-Range-Lab/5.1'
      }
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({
        error: `GeckoTerminal returned HTTP ${response.status}`,
        detail: text.slice(0, 240)
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(502).json({
      error: 'OHLCV fetch failed',
      detail: error && error.message ? error.message : String(error)
    });
  }
};

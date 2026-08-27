export default async function handler(req, res) {
  const pool = String(req.query.pool || '');
  const timeframe = ['minute','hour','day'].includes(req.query.timeframe) ? req.query.timeframe : 'hour';
  const limit = Math.max(24, Math.min(Number(req.query.limit || 168), 1000));
  if (!/^0x[a-fA-F0-9]{40,64}$/.test(pool)) return res.status(400).json({ error: 'Invalid pool' });
  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${pool}/ohlcv/${timeframe}?aggregate=1&limit=${limit}&currency=usd`;
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');
    res.status(200).json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message || 'OHLCV fetch failed' }); }
}

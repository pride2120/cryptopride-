export default async function handler(req, res) {
  try {
    const url = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools?include=base_token,quote_token,dex&page=1';
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(await r.json());
  } catch (e) {
    res.status(502).json({ error: e.message || 'Pool fetch failed' });
  }
}

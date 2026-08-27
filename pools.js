module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = 'https://api.geckoterminal.com/api/v2/networks/robinhood/pools?include=base_token,quote_token,dex&page=1';

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'CryptoPride-Range-Lab/2.1'
      }
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({
        error: `GeckoTerminal returned HTTP ${response.status}`,
        detail: text.slice(0, 240)
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(502).json({
      error: 'Pool fetch failed',
      detail: error && error.message ? error.message : String(error)
    });
  }
};

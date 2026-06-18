const TFL_BASE = 'https://api.tfl.gov.uk';
const ALLOWED  = /^(StopPoint\/[^/]+\/Arrivals|Line\/[^/]+\/Arrivals\/[^/]+)$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!process.env.TFL_KEY) {
    res.status(500).json({ error: 'TFL_KEY env var not set' });
    return;
  }

  const path = req.query.path;
  if (!path || !ALLOWED.test(path)) {
    res.status(400).json({ error: 'Invalid or missing path parameter' });
    return;
  }

  try {
    const upstream = await fetch(`${TFL_BASE}/${path}?app_key=${process.env.TFL_KEY}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `TfL returned HTTP ${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

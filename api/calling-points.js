const LDBWS_BASE = 'https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!process.env.LDBWS_TOKEN) {
    res.status(500).json({ error: 'LDBWS_TOKEN env var not set' });
    return;
  }

  const serviceId = req.query.serviceId;
  if (!serviceId) { res.status(400).json({ error: 'serviceId required' }); return; }

  try {
    const apiRes = await fetch(`${LDBWS_BASE}/GetServiceDetails/${serviceId}`, {
      headers: { 'x-apikey': process.env.LDBWS_TOKEN },
      signal: AbortSignal.timeout(8000),
    });

    if (!apiRes.ok) {
      res.status(502).json({ error: `National Rail returned HTTP ${apiRes.status}` });
      return;
    }

    const data = await apiRes.json();
    const callingPoints = (data.subsequentCallingPoints?.[0]?.callingPoint || [])
      .map(p => p.locationName);

    res.status(200).json({ callingPoints });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

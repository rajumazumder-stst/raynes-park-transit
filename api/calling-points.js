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
  if (!serviceId) {
    res.status(400).json({ error: 'serviceId parameter required' });
    return;
  }

  const url = `${LDBWS_BASE}/GetServiceDetails?serviceID=${encodeURIComponent(serviceId)}`;

  try {
    const apiRes = await fetch(url, {
      headers: { 'x-apikey': process.env.LDBWS_TOKEN },
      signal: AbortSignal.timeout(8000),
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      res.status(502).json({ error: `National Rail returned HTTP ${apiRes.status}`, detail: detail.slice(0, 500) });
      return;
    }

    const data = await apiRes.json();

    // subsequentCallingPoints is a list of lists (multiple for split/join services)
    // Flatten all routes into a single deduplicated list of location names
    const seen = new Set();
    const callingPoints = [];
    for (const group of (data.subsequentCallingPoints || [])) {
      const points = Array.isArray(group) ? group : (group.callingPoint || []);
      for (const cp of points) {
        const name = cp.locationName;
        if (name && !seen.has(name)) { seen.add(name); callingPoints.push(name); }
      }
    }

    res.status(200).json({ callingPoints });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

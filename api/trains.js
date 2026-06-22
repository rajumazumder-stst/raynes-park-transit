const LDBWS_BASE = 'https://api1.raildata.org.uk/1010-live-departure-board-dep1_2/LDBWS/api/20220120';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!process.env.LDBWS_TOKEN) {
    res.status(500).json({ error: 'LDBWS_TOKEN env var not set' });
    return;
  }

  const crs     = (req.query.crs || 'RAY').toUpperCase().slice(0, 3);
  const numRows = Math.min(parseInt(req.query.rows || '20'), 150);
  const url     = `${LDBWS_BASE}/GetDepBoardWithDetails/${crs}?numRows=${numRows}&timeWindow=30`;

  try {
    const apiRes = await fetch(url, {
      headers: { 'x-apikey': process.env.LDBWS_TOKEN },
      signal: AbortSignal.timeout(12000),
    });

    if (!apiRes.ok) {
      const detail = await apiRes.text();
      res.status(502).json({ error: `National Rail returned HTTP ${apiRes.status}`, detail: detail.slice(0, 500) });
      return;
    }

    const data = await apiRes.json();

    const services = (data.trainServices || []).map(svc => ({
      platform:      svc.platform,
      std:           svc.std,
      etd:           svc.etd,
      destination:   svc.destination?.[0]?.locationName || '—',
      operatorCode:  svc.operatorCode,
      serviceId:     svc.serviceID,
      callingPoints: (svc.subsequentCallingPoints?.[0]?.callingPoint || []).map(p => p.locationName),
    }));

    const messages = (data.nrccMessages || []).map(m => m.Value || '').filter(Boolean);

    res.status(200).json({ services, messages });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

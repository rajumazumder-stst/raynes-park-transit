const LDBWS_TOKEN = '96a52d00-d2b0-4f46-8748-6ee6ab4bcf9b';
const LDBWS_URL   = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb6.asmx';

function buildSoap(token, crs, numRows) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ldb="http://thalesgroup.com/RTTI/2017-02-02/ldb/"
               xmlns:ct="http://thalesgroup.com/RTTI/2010-11-01/ldb/commontypes">
  <soap:Header>
    <ct:AccessToken>
      <ct:TokenValue>${token}</ct:TokenValue>
    </ct:AccessToken>
  </soap:Header>
  <soap:Body>
    <ldb:GetDepBoardWithDetailsRequest>
      <ldb:numRows>${numRows}</ldb:numRows>
      <ldb:crs>${crs}</ldb:crs>
    </ldb:GetDepBoardWithDetailsRequest>
  </soap:Body>
</soap:Envelope>`;
}

function getText(el, tag) {
  const found = el.getElementsByTagNameNS('*', tag);
  return found.length ? found[0].textContent.trim() : null;
}

function parseXml(xmlText) {
  // Node.js doesn't have DOMParser — parse XML manually with regex for the fields we need
  const services = [];
  const serviceBlocks = xmlText.match(/<lt[^:]*:service[\s\S]*?<\/lt[^:]*:service>/g) || [];

  serviceBlocks.forEach(block => {
    const get = (tag) => {
      const m = block.match(new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`));
      return m ? m[1].trim() : null;
    };
    const getDestination = () => {
      const m = block.match(/<[^>]*:?locationName[^>]*>([^<]+)<\/[^>]*:?locationName>/);
      return m ? m[1].trim() : '—';
    };

    services.push({
      platform:    get('platform'),
      std:         get('std'),
      etd:         get('etd'),
      destination: getDestination(),
    });
  });

  // Also grab any NRCC messages
  const messages = [];
  const msgMatches = xmlText.match(/<[^>]*:?message[^>]*>([\s\S]*?)<\/[^>]*:?message>/g) || [];
  msgMatches.forEach(m => {
    const inner = m.replace(/<[^>]+>/g, '').trim();
    if (inner) messages.push(inner);
  });

  return { services, messages };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const crs     = (req.query.crs || 'RAY').toUpperCase().slice(0,3);
  const numRows = Math.min(parseInt(req.query.rows || '20'), 50);

  try {
    const soapRes = await fetch(LDBWS_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://thalesgroup.com/RTTI/2017-02-02/ldb/GetDepBoardWithDetails"',
      },
      body: buildSoap(LDBWS_TOKEN, crs, numRows),
    });

    if (!soapRes.ok) {
      res.status(502).json({ error: 'National Rail returned HTTP ' + soapRes.status });
      return;
    }

    const xmlText = await soapRes.text();

    if (xmlText.includes('Fault')) {
      const faultMatch = xmlText.match(/<faultstring>([^<]+)<\/faultstring>/);
      res.status(502).json({ error: 'SOAP Fault: ' + (faultMatch?.[1] || 'unknown') });
      return;
    }

    const { services, messages } = parseXml(xmlText);
    res.status(200).json({ services, messages });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const LDBWS_TOKEN = '96a52d00-d2b0-4f46-8748-6ee6ab4bcf9b';
const LDBWS_URL   = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb9.asmx';

function buildSoap(token, crs, numRows) {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types" xmlns:ldb="http://thalesgroup.com/RTTI/2016-02-16/ldb/">
   <soap:Header>
      <typ:AccessToken>
         <typ:TokenValue>${token}</typ:TokenValue>
      </typ:AccessToken>
   </soap:Header>
   <soap:Body>
      <ldb:GetDepartureBoardRequest>
         <ldb:numRows>${numRows}</ldb:numRows>
         <ldb:crs>${crs}</ldb:crs>
         <ldb:filterCrs></ldb:filterCrs>
         <ldb:filterType>to</ldb:filterType>
         <ldb:timeOffset>0</ldb:timeOffset>
         <ldb:timeWindow>30</ldb:timeWindow>
      </ldb:GetDepartureBoardRequest>
   </soap:Body>
</soap:Envelope>`;
}

function parseXml(xmlText) {
  const services = [];
  const serviceBlocks = xmlText.match(/<lt[^:]*:service[\s\S]*?<\/lt[^:]*:service>/g) || [];

  serviceBlocks.forEach(block => {
    const get = (tag) => {
      const m = block.match(new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<`));
      return m ? m[1].trim() : null;
    };
    // Destination: first locationName inside a destination block
    const destBlock = block.match(/<[^>]*:?destination[^>]*>([\s\S]*?)<\/[^>]*:?destination>/);
    let destination = '—';
    if (destBlock) {
      const locName = destBlock[1].match(/<[^>]*:?locationName[^>]*>([^<]+)<\/[^>]*:?locationName>/);
      if (locName) destination = locName[1].trim();
    }

    services.push({
      platform:    get('platform'),
      std:         get('std'),
      etd:         get('etd'),
      destination,
    });
  });

  // NRCC messages
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

  const crs     = (req.query.crs || 'RAY').toUpperCase().slice(0, 3);
  const numRows = Math.min(parseInt(req.query.rows || '20'), 50);

  try {
    const soapRes = await fetch(LDBWS_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction':   '',
      },
      body: buildSoap(LDBWS_TOKEN, crs, numRows),
    });

    if (!soapRes.ok) {
      const errText = await soapRes.text();
      res.status(502).json({ error: `National Rail returned HTTP ${soapRes.status}`, detail: errText.slice(0, 500) });
      return;
    }

    const xmlText = await soapRes.text();

    if (xmlText.includes('Fault')) {
      const faultMatch = xmlText.match(/<[^>]*:?faultstring[^>]*>([^<]+)<\/[^>]*:?faultstring>/);
      res.status(502).json({ error: 'SOAP Fault: ' + (faultMatch?.[1] || 'unknown'), raw: xmlText.slice(0, 500) });
      return;
    }

    const { services, messages } = parseXml(xmlText);
    res.status(200).json({ services, messages });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

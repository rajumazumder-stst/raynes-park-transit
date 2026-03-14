const LDBWS_TOKEN = '96a52d00-d2b0-4f46-8748-6ee6ab4bcf9b';
const LDBWS_URL   = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb9.asmx';

function buildSoap(token, serviceId) {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types" xmlns:ldb="http://thalesgroup.com/RTTI/2016-02-16/ldb/">
   <soap:Header>
      <typ:AccessToken>
         <typ:TokenValue>${token}</typ:TokenValue>
      </typ:AccessToken>
   </soap:Header>
   <soap:Body>
      <ldb:GetServiceDetailsRequest>
         <ldb:serviceID>${serviceId}</ldb:serviceID>
      </ldb:GetServiceDetailsRequest>
   </soap:Body>
</soap:Envelope>`;
}

function parseCallingPoints(xmlText) {
  const points = [];
  // Match subsequentCallingPoints block
  const subsBlock = xmlText.match(/<[^>]*:?subsequentCallingPoints[^>]*>([\s\S]*?)<\/[^>]*:?subsequentCallingPoints>/);
  if (subsBlock) {
    const locMatches = subsBlock[1].matchAll(/<[^>]*:?locationName[^>]*>([^<]+)<\/[^>]*:?locationName>/g);
    for (const m of locMatches) points.push(m[1].trim());
  }
  return points;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const serviceId = req.query.serviceId;
  if (!serviceId) { res.status(400).json({ error: 'serviceId required' }); return; }

  try {
    const soapRes = await fetch(LDBWS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8', 'SOAPAction': '' },
      body: buildSoap(LDBWS_TOKEN, serviceId),
    });
    if (!soapRes.ok) { res.status(502).json({ error: 'NR HTTP ' + soapRes.status }); return; }
    const xmlText = await soapRes.text();
    if (xmlText.includes('Fault')) { res.status(502).json({ error: 'SOAP Fault', raw: xmlText.slice(0,200) }); return; }
    const callingPoints = parseCallingPoints(xmlText);
    res.status(200).json({ callingPoints });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}

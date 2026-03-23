module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const { placeUrl, runId, action } = req.body || {};
  const { GOOGLE_API_KEY, APIFY_API_TOKEN } = process.env;

  try {
    // --- ACTION: CHECK STATUS ---
    if (action === 'check' && runId) {
      const sRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
      const sData = await sRes.json();
      if (sData.data?.status === 'SUCCEEDED') {
        const items = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`).then(r => r.json());
        return res.status(200).json({ status: 'done', reviews: items });
      }
      return res.status(200).json({ status: 'running' });
    }

    // --- ACTION: START RUN ---
    let placeId = null;
    let finalUrl = placeUrl;

    // A. Expand Short Links
    if (placeUrl.includes('goo.gl')) {
      const expand = await fetch(placeUrl, { redirect: 'follow', headers: {'User-Agent': 'Mozilla/5.0'} });
      finalUrl = expand.url;
    }

    // B. Detection sequence: PlaceID -> CID -> Coordinates
    const chMatch = finalUrl.match(/ChI[a-zA-Z0-9_-]{24}/);
    if (chMatch) {
      placeId = chMatch[0];
    } else {
      const cidMatch = finalUrl.match(/0x[a-f0-9]+:(0x[a-f0-9]+)/i);
      if (cidMatch) {
        const cidDec = BigInt(cidMatch[1]).toString();
        const d = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?cid=${cidDec}&key=${GOOGLE_API_KEY}`).then(r => r.json());
        placeId = d.result?.place_id;
      }
    }

    // C. Get the best URL for Apify
    let apifyTargetUrl = finalUrl;
    let displayName = "Location";

    if (placeId) {
      const details = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,url&key=${GOOGLE_API_KEY}`).then(r => r.json());
      apifyTargetUrl = details.result?.url || finalUrl;
      displayName = details.result?.name || displayName;
    }

    // D. Trigger Apify
    const apifyRes = await fetch(`https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: apifyTargetUrl }],
        maxReviews: 50,
        language: 'en'
      }),
    });

    const apifyData = await apifyRes.json();
    return res.status(200).json({ 
      status: 'started', 
      runId: apifyData.data?.id,
      restaurant: { name: displayName }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

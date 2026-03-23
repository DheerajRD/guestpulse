module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId, runId, action } = req.body || {};
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

  try {
    // 1. Check Apify Status
    if (action === 'check' && runId) {
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === 'SUCCEEDED') {
        const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&limit=150`);
        const items = await itemsRes.json();
        return res.status(200).json({ status: 'done', reviews: items, total: items.length });
      }
      return res.status(200).json({ status: 'running' });
    }

    // 2. Advanced URL Detection
    let placeId = directId || null;
    let finalUrl = placeUrl;

    if (!placeId && placeUrl) {
      // Follow redirects for short links (goo.gl)
      if (placeUrl.includes('goo.gl') || placeUrl.includes('maps.app.goo.gl')) {
        try {
          const response = await fetch(placeUrl, { 
            method: 'GET', 
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
          });
          finalUrl = response.url;
        } catch (e) { console.error("Redirect expansion failed", e); }
      }

      // Try Place ID (ChIJ)
      const chMatch = finalUrl.match(/ChI[a-zA-Z0-9_-]{24}/);
      if (chMatch) placeId = chMatch[0];

      // Try CID (Hex or ludocid)
      if (!placeId) {
        const cidMatch = finalUrl.match(/0x[a-f0-9]+:(0x[a-f0-9]+)/i) || finalUrl.match(/ludocid=([0-9]+|0x[a-f0-9]+)/);
        if (cidMatch) {
          const rawCid = cidMatch[1];
          const cidDecimal = rawCid.startsWith('0x') ? BigInt(rawCid).toString() : rawCid;
          const cidRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?cid=${cidDecimal}&key=${GOOGLE_API_KEY}`);
          const cidData = await cidRes.json();
          if (cidData.result?.place_id) placeId = cidData.result.place_id;
        }
      }

      // Fallback: Coordinates
      if (!placeId) {
        const geo = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (geo) {
          const search = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${geo[1]},${geo[2]}&radius=50&key=${GOOGLE_API_KEY}`).then(r => r.json());
          if (search.results?.length > 0) placeId = search.results[0].place_id;
        }
      }
    }

    if (!placeId) return res.status(400).json({ error: 'Detection failed. Please use a full desktop URL.' });

    // 3. Get clean URL for Apify
    const details = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,url,rating&key=${GOOGLE_API_KEY}`).then(r => r.json());
    const targetUrl = details.result?.url || finalUrl;

    // 4. Start Apify Scraper (Actor Xb8osYTtOjlsgI6k9)
    const apifyRes = await fetch(`https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: targetUrl }],
        maxReviews: 100,
        language: 'en',
      }),
    });

    const apifyData = await apifyRes.json();
    return res.status(200).json({ 
      status: 'started', 
      runId: apifyData.data?.id,
      restaurant: { name: details.result?.name, placeId }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

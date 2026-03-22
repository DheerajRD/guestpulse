const { placeUrl } = req.body || {};

// block shortened Google links (these cause blank page)
if (placeUrl && placeUrl.includes("maps.app.goo.gl")) {
  return res.status(400).json({
    error: "Please open the Google Maps link in browser and copy the full URL."
  });
}
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId } = req.body || {};
  const GOOGLE_API_KEY  = process.env.GOOGLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

  if (!GOOGLE_API_KEY)  return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
  if (!APIFY_API_TOKEN) return res.status(500).json({ error: 'APIFY_API_TOKEN not configured' });

  try {
    // ── Step 1: Get place details from Google ─────────────────
    let placeId = directId || null;

    if (!placeId && placeUrl) {
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) {
        placeId = chMatch[0];
      } else {
        const nameMatch  = placeUrl.match(/\/place\/([^/@?#]+)/);
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (nameMatch && coordMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g,' ')).trim();
          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
            '?location=' + coordMatch[1] + ',' + coordMatch[2] +
            '&radius=100&keyword=' + encodeURIComponent(name) +
            '&key=' + GOOGLE_API_KEY
          );
          const d = await r.json();
          if (d.results && d.results.length > 0) placeId = d.results[0].place_id;
        }
        if (!placeId) {
          const nameMatch2 = placeUrl.match(/\/place\/([^/@?#]+)/);
          if (nameMatch2) {
            const name2 = decodeURIComponent(nameMatch2[1].replace(/\+/g,' ')).trim();
            const r = await fetch(
              'https://maps.googleapis.com/maps/api/place/textsearch/json' +
              '?query=' + encodeURIComponent(name2) +
              '&key=' + GOOGLE_API_KEY
            );
            const d = await r.json();
            if (d.results && d.results.length > 0) placeId = d.results[0].place_id;
          }
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: 'Could not find restaurant. Paste the full Google Maps URL.' });
    }

    // ── Step 2: Get restaurant basic info from Google ─────────
    const detRes  = await fetch(
      'https://maps.googleapis.com/maps/api/place/details/json' +
      '?place_id=' + placeId +
      '&fields=name,rating,user_ratings_total,formatted_address,url' +
      '&key=' + GOOGLE_API_KEY
    );
    const detData = await detRes.json();

    if (detData.status === 'REQUEST_DENIED') {
      return res.status(403).json({ error: 'Google API blocked. Check billing.' });
    }
    if (detData.status !== 'OK') {
      return res.status(404).json({ error: 'Google API error: ' + detData.status });
    }

    const place       = detData.result;
    const googleMapsUrl = place.url || placeUrl;

    // ── Step 3: Fetch recent reviews via Apify ────────────────
    const apifyInput = {
      startUrls: [{ url: googleMapsUrl }],
      maxReviews: 100,
      reviewsSort: 'newest',
      language: 'en',
      personalDataOptions: 'INCLUDE',
    };

    const startRes  = await fetch(
      'https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=' + APIFY_API_TOKEN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apifyInput),
      }
    );

    if (!startRes.ok) {
      const errText = await startRes.text();
      return res.status(500).json({ error: 'Apify start failed: ' + errText.substring(0, 200) });
    }

    const startData = await startRes.json();
    const runId     = startData.data && startData.data.id;

    if (!runId) {
      return res.status(500).json({ error: 'No run ID from Apify' });
    }

    // ── Step 4: Poll until Apify run finishes (max 55s) ───────
    let succeeded = false;
    for (let i = 0; i < 18; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes  = await fetch(
        'https://api.apify.com/v2/actor-runs/' + runId + '?token=' + APIFY_API_TOKEN
      );
      const statusData = await statusRes.json();
      const status     = statusData.data && statusData.data.status;
      if (status === 'SUCCEEDED') { succeeded = true; break; }
      if (status === 'FAILED' || status === 'ABORTED') {
        return res.status(500).json({ error: 'Apify run failed. Try again.' });
      }
    }

    if (!succeeded) {
      return res.status(504).json({ error: 'Apify timed out. Try again or use a different URL.' });
    }

    // ── Step 5: Get results from Apify ────────────────────────
    const itemsRes  = await fetch(
      'https://api.apify.com/v2/actor-runs/' + runId + '/dataset/items' +
      '?token=' + APIFY_API_TOKEN + '&limit=100'
    );
    const items = await itemsRes.json();

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'No reviews found via Apify.' });
    }

    // ── Step 6: Normalise reviews ─────────────────────────────
    const reviews = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const reviewsArr = item.reviews || [];
      for (let j = 0; j < reviewsArr.length; j++) {
        const r = reviewsArr[j];
        if (r.text && r.text.trim().length > 10) {
          reviews.push({
            id:     reviews.length + 1,
            author: r.name || 'Anonymous',
            rating: r.stars || r.rating || 0,
            text:   r.text.trim(),
            time:   r.publishedAtDate || r.date || '',
          });
        }
      }
      if (reviews.length >= 100) break;
    }

    // Also try flat structure
    if (reviews.length === 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.text && item.text.trim().length > 10) {
          reviews.push({
            id:     reviews.length + 1,
            author: item.name || item.reviewerName || 'Anonymous',
            rating: item.stars || item.rating || 0,
            text:   item.text.trim(),
            time:   item.publishedAtDate || item.date || '',
          });
        }
        if (reviews.length >= 100) break;
      }
    }

    if (reviews.length === 0) {
      return res.status(404).json({ error: 'No reviews found. The restaurant may have no recent reviews.' });
    }

    console.log('Fetched ' + reviews.length + ' reviews via Apify for ' + place.name);

    return res.status(200).json({
      restaurant: {
        name:         place.name,
        address:      place.formatted_address,
        rating:       place.rating,
        totalReviews: place.user_ratings_total,
        placeId:      placeId,
      },
      reviews:  reviews,
      total:    reviews.length,
    });

  } catch (err) {
    console.error('reviews.js error:', err.message);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
```

---

**Then add your Apify token to Vercel:**

1. Go to Vercel → Settings → Environment Variables
2. Add new variable:
```
Name:  APIFY_API_TOKEN
Value: your Apify token (apify_api_xxxx)

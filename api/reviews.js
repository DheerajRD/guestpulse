module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId } = req.body || {};
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });

  try {
    let placeId = directId || null;

    if (!placeId && placeUrl) {

      // Step 1 — Try to get ChIJ place ID directly from URL
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) {
        placeId = chMatch[0];
      }

      // Step 2 — Extract name + search Google
      if (!placeId) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (nameMatch) {
          const name = decodeURIComponent(
            nameMatch[1].replace(/\+/g, ' ').replace(/-/g, ' ')
          ).trim();

          // Try coords + name nearby search first
          const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (coordMatch) {
            const lat = coordMatch[1];
            const lng = coordMatch[2];
            const r   = await fetch(
              `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&keyword=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`
            );
            const d = await r.json();
            if (d.results?.length) placeId = d.results[0].place_id;
          }

          // Fallback — text search by name
          if (!placeId) {
            const r = await fetch(
              `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`
            );
            const d = await r.json();
            if (d.results?.length) placeId = d.results[0].place_id;
          }
        }
      }

      // Step 3 — coords only fallback
      if (!placeId) {
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
          const r = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordMatch[1]},${coordMatch[2]}&radius=30&type=restaurant&key=${GOOGLE_API_KEY}`
          );
          const d = await r.json();
          if (d.results?.length) placeId = d.results[0].place_id;
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({
        error: 'Could not find restaurant. Paste the full Google Maps URL from your browser address bar.'
      });
    }

    // Fetch reviews
    const detRes  = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,formatted_address&key=${GOOGLE_API_KEY}`
    );
    const detData = await detRes.json();

    if (detData.status === 'REQUEST_DENIED') {
      return res.status(403).json({
        error: 'Google API blocked. Please activate billing — go to console.cloud.google.com → Billing → Pay the $10 prepayment.'
      });
    }

    if (detData.status !== 'OK') {
      return res.status(404).json({
        error: `Google API error: ${detData.status}`
      });
    }

    const place   = detData.result;
    const reviews = (place.reviews || [])
      .map((r, i) => ({
        id:     i + 1,
        author: r.author_name || 'Anonymous',
        rating: r.rating || 0,
        text:   r.text || '',
        time:   r.relative_time_description || '',
      }))
      .filter(r => r.text.trim().length > 0);

    if (!reviews.length) {
      return res.status(404).json({
        error: 'No reviews found for this restaurant.'
      });
    }

    return res.status(200).json({
      restaurant: {
        name:         place.name,
        address:      place.formatted_address,
        rating:       place.rating,
        totalReviews: place.user_ratings_total,
        placeId,
      },
      reviews,
      total: reviews.length,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to fetch reviews' });
  }
};
```

---

After committing wait 30 seconds then test with this exact URL:
```
https://www.google.com/maps/place/Hashtag+India+-+San+Antonio/@29.5006705,-98.5822695,17z/data=!3m2!4b1!5s0x865c5dfb31e4ffb5:0x16b79d0b419a8ca7!4m6!3m5!1s0x865c5d00232ba225:0x3c19a6ae5314ca36!8m2!3d29.5006659!4d-98.5796946!16s%2Fg%2F11xmxrrwx9?entry=ttu&g_ep=EgoyMDI2MDMxMS4wIKXMDSoASAFQAw%3D%3D

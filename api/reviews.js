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

    // ── Step 1: Extract place ID from URL ─────────────────────
    if (!placeId && placeUrl) {
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) {
        placeId = chMatch[0];
      }

      if (!placeId) {
        const nameMatch  = placeUrl.match(/\/place\/([^/@?#]+)/);
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ').replace(/-/g, ' ')).trim();
          if (coordMatch) {
            const r = await fetch(
              'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' +
              coordMatch[1] + ',' + coordMatch[2] +
              '&radius=100&keyword=' + encodeURIComponent(name) +
              '&key=' + GOOGLE_API_KEY
            );
            const d = await r.json();
            if (d.results && d.results.length > 0) placeId = d.results[0].place_id;
          }
          if (!placeId) {
            const r = await fetch(
              'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' +
              encodeURIComponent(name) + '&key=' + GOOGLE_API_KEY
            );
            const d = await r.json();
            if (d.results && d.results.length > 0) placeId = d.results[0].place_id;
          }
        }
      }

      if (!placeId) {
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' +
            coordMatch[1] + ',' + coordMatch[2] +
            '&radius=30&type=restaurant&key=' + GOOGLE_API_KEY
          );
          const d = await r.json();
          if (d.results && d.results.length > 0) placeId = d.results[0].place_id;
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: 'Could not find restaurant. Paste the full Google Maps URL from your browser.' });
    }

    // ── Step 2: Try NEW Places API first (returns more reviews) ─
    let reviews = [];
    let restaurantInfo = null;

    try {
      const newApiRes = await fetch(
        'https://places.googleapis.com/v1/places/' + placeId,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,formattedAddress,reviews',
          }
        }
      );
      const newData = await newApiRes.json();

      if (newApiRes.ok && newData.displayName) {
        restaurantInfo = {
          name:         newData.displayName?.text || newData.displayName,
          address:      newData.formattedAddress || '',
          rating:       newData.rating || 0,
          totalReviews: newData.userRatingCount || 0,
          placeId,
        };

        if (newData.reviews && newData.reviews.length > 0) {
          reviews = newData.reviews
            .map((r, i) => ({
              id:     i + 1,
              author: r.authorAttribution?.displayName || 'Anonymous',
              rating: r.rating || 0,
              text:   r.text?.text || r.originalText?.text || '',
              time:   r.relativePublishTimeDescription || '',
            }))
            .filter(r => r.text && r.text.trim().length > 0);
        }
        console.log('New Places API: got ' + reviews.length + ' reviews');
      }
    } catch (newApiErr) {
      console.log('New Places API failed, trying old API:', newApiErr.message);
    }

    // ── Step 3: Fallback to old Places API ────────────────────
    if (reviews.length === 0) {
      const detRes  = await fetch(
        'https://maps.googleapis.com/maps/api/place/details/json?place_id=' +
        placeId + '&fields=name,rating,user_ratings_total,reviews,formatted_address&key=' +
        GOOGLE_API_KEY
      );
      const detData = await detRes.json();

      if (detData.status === 'REQUEST_DENIED') {
        return res.status(403).json({ error: 'Google API blocked. Make sure billing is active at console.cloud.google.com' });
      }
      if (detData.status !== 'OK') {
        return res.status(404).json({ error: 'Google API error: ' + detData.status });
      }

      const place = detData.result;
      restaurantInfo = {
        name:         place.name,
        address:      place.formatted_address,
        rating:       place.rating,
        totalReviews: place.user_ratings_total,
        placeId,
      };

      reviews = (place.reviews || [])
        .map((r, i) => ({
          id:     i + 1,
          author: r.author_name || 'Anonymous',
          rating: r.rating || 0,
          text:   r.text || '',
          time:   r.relative_time_description || '',
        }))
        .filter(r => r.text && r.text.trim().length > 0);

      console.log('Old Places API: got ' + reviews.length + ' reviews');
    }

    if (reviews.length === 0) {
      return res.status(404).json({ error: 'No reviews found for this restaurant.' });
    }

    console.log('Total reviews to analyse: ' + reviews.length + ' for ' + restaurantInfo.name);

    return res.status(200).json({
      restaurant: restaurantInfo,
      reviews,
      total: reviews.length,
    });

  } catch (err) {
    console.error('reviews.js error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch reviews' });
  }
};
```

---

**After committing wait 30 seconds then:**

1. Go to your app
2. Paste Hashtag India URL
3. Analyse again
4. Check Vercel logs — you should see:
```
New Places API: got 5 reviews
```
or
```
New Places API: got 20+ reviews

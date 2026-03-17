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
      // Try ChIJ format first — fastest
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) {
        placeId = chMatch[0];
      } else {
        // Extract name and coordinates
        const nameMatch  = placeUrl.match(/\/place\/([^/@?#]+)/);
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

        if (nameMatch && coordMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g,' ')).trim();
          const lat  = coordMatch[1];
          const lng  = coordMatch[2];

          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json' +
            '?location=' + lat + ',' + lng +
            '&radius=100&keyword=' + encodeURIComponent(name) +
            '&key=' + GOOGLE_API_KEY
          );
          const d = await r.json();
          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
          }
        }

        if (!placeId && placeUrl.match(/\/place\/([^/@?#]+)/)) {
          const nameMatch2 = placeUrl.match(/\/place\/([^/@?#]+)/);
          const name2 = decodeURIComponent(nameMatch2[1].replace(/\+/g,' ')).trim();
          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/textsearch/json' +
            '?query=' + encodeURIComponent(name2) +
            '&key=' + GOOGLE_API_KEY
          );
          const d = await r.json();
          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
          }
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: 'Could not find restaurant. Please paste a full Google Maps URL.' });
    }

    // Get place details
    const detRes  = await fetch(
      'https://maps.googleapis.com/maps/api/place/details/json' +
      '?place_id=' + placeId +
      '&fields=name,rating,user_ratings_total,reviews,formatted_address' +
      '&key=' + GOOGLE_API_KEY
    );
    const detData = await detRes.json();

    if (detData.status === 'REQUEST_DENIED') {
      return res.status(403).json({ error: 'Google API key denied. Check billing at console.cloud.google.com' });
    }
    if (detData.status !== 'OK') {
      return res.status(404).json({ error: 'Google API error: ' + detData.status });
    }

    const place   = detData.result;
    const reviews = [];

    if (place.reviews) {
      for (let i = 0; i < place.reviews.length; i++) {
        const r = place.reviews[i];
        if (r.text && r.text.trim()) {
          reviews.push({
            id:     reviews.length + 1,
            author: r.author_name || 'Anonymous',
            rating: r.rating || 0,
            text:   r.text.trim(),
            time:   r.relative_time_description || '',
          });
        }
      }
    }

    if (reviews.length === 0) {
      return res.status(404).json({ error: 'No reviews found.' });
    }

    return res.status(200).json({
      restaurant: {
        name:         place.name,
        address:      place.formatted_address,
        rating:       place.rating,
        totalReviews: place.user_ratings_total,
        placeId:      placeId,
      },
      reviews: reviews,
      total:   reviews.length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

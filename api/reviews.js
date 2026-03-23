module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId, runId, action } = req.body || {};

  const GOOGLE_API_KEY  = process.env.GOOGLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

  if (!GOOGLE_API_KEY)  return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
  if (!APIFY_API_TOKEN) return res.status(500).json({ error: 'APIFY_API_TOKEN not configured' });

  try {

    // --------------------------------------------------
    // CHECK STATUS (poll Apify)
    // --------------------------------------------------
    if (action === 'check' && runId) {
      const statusRes  = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
      const statusData = await statusRes.json();
      const status     = statusData?.data?.status;

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;

        const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=200`);
        const items    = await itemsRes.json();

        const reviews = [];

        for (const item of items) {
          const arr = item.reviews || [];

          for (const r of arr) {
            if (r.text && r.text.trim().length > 10) {
              reviews.push({
                id: reviews.length + 1,
                author: r.name || 'Anonymous',
                rating: r.stars || r.rating || 0,
                text: r.text.trim(),
                time: r.publishedAtDate || ''
              });
            }
          }

          // fallback if actor returns flat format
          if (item.text && item.text.trim().length > 10) {
            reviews.push({
              id: reviews.length + 1,
              author: item.name || item.reviewerName || 'Anonymous',
              rating: item.stars || item.rating || 0,
              text: item.text.trim(),
              time: item.publishedAtDate || ''
            });
          }
        }

        if (reviews.length === 0) {
          return res.status(404).json({ error: 'No reviews found.' });
        }

        return res.status(200).json({
          status: 'done',
          total: reviews.length,
          reviews
        });
      }

      if (status === 'FAILED' || status === 'ABORTED') {
        return res.status(500).json({ error: 'Apify run failed. Try again.' });
      }

      return res.status(200).json({ status: 'running' });
    }

    // --------------------------------------------------
    // EXTRACT PLACE ID FROM GOOGLE URL
    // --------------------------------------------------
    let placeId = directId || null;

    if (!placeId && placeUrl) {

      // Method 1: ChIJ in URL
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) placeId = chMatch[0];

      // Method 2: extract name and search
      if (!placeId) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();

          const r = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`);
          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
          }
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: 'Could not detect restaurant. Try another link.' });
    }

    // --------------------------------------------------
    // GET RESTAURANT DETAILS (AUTO NAME + CITY)
    // --------------------------------------------------
    const detailsRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_address&key=${GOOGLE_API_KEY}`
    );

    const detailsData = await detailsRes.json();

    if (detailsData.status !== 'OK') {
      return res.status(500).json({ error: 'Google Place Details failed.' });
    }

    const place = detailsData.result;

    const restaurantName = place.name || 'Unknown Restaurant';
    const fullAddress    = place.formatted_address || '';

    // safer city extraction
    const addressParts = fullAddress.split(',');
    const restaurantCity = addressParts.length > 1 ? addressParts[1].trim() : 'Unknown City';

    // --------------------------------------------------
    // START APIFY GOOGLE REVIEWS ACTOR
    // --------------------------------------------------
    const cleanUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

    const startRes = await fetch(`https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: cleanUrl }],
        maxReviews: 150,
        language: 'en',
        reviewsSort: 'newest'
      })
    });

    const startData = await startRes.json();

    if (!startData?.data?.id) {
      return res.status(500).json({ error: 'Failed to start Apify run.' });
    }

    const newRunId = startData.data.id;

    // --------------------------------------------------
    // RESPONSE (READY FOR YELP + TRIPADVISOR NEXT)
    // --------------------------------------------------
    return res.status(200).json({
      status: 'started',
      runId: newRunId,
      restaurant: {
        name: restaurantName,
        city: restaurantCity,
        address: fullAddress,
        rating: place.rating,
        totalReviews: place.user_ratings_total
      }
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

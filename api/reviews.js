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

          // ALSO handle flat format
          if (arr.length === 0 && item.text && item.text.trim().length > 10) {
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
    // EXTRACT PLACE ID (FIXED + ROBUST)
    // --------------------------------------------------
    let placeId = directId || null;

    if (!placeId && placeUrl) {

      // Method 0: direct place_id
      const directMatch = placeUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
      if (directMatch) {
        placeId = directMatch[1];
        console.log('Method 0 (direct):', placeId);
      }

      // Extract coordinates for bias
      const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const lat = coordMatch ? coordMatch[1] : null;
      const lng = coordMatch ? coordMatch[2] : null;

      // Method 1: ChIJ
      if (!placeId) {
        const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
        if (chMatch) {
          placeId = chMatch[0];
          console.log('Method 1 found:', placeId);
        }
      }

      // Method 2: text search WITH bias
      if (!placeId) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();

          let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`;

          if (lat && lng) {
            url += `&location=${lat},${lng}&radius=500`;
          }

          console.log('Method 2 searching:', name);

          const r = await fetch(url);
          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 2 found:', placeId);
          }
        }
      }

      // Method 3: !3d !4d
      if (!placeId) {
        const latMatch  = placeUrl.match(/!3d(-?\d+\.\d+)/);
        const lngMatch  = placeUrl.match(/!4d(-?\d+\.\d+)/);
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (latMatch && lngMatch && nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();

          const r = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latMatch[1]},${lngMatch[1]}&radius=100&keyword=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`
          );

          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 3 found:', placeId);
          }
        }
      }

      // Method 4: @ coords
      if (!placeId && lat && lng) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();

          const r = await fetch(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=300&keyword=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`
          );

          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 4 found:', placeId);
          }
        }
      }

      // Method 5: strong bias fallback
      if (!placeId && lat && lng) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();

          const r = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&location=${lat},${lng}&radius=1000&key=${GOOGLE_API_KEY}`
          );

          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 5 found:', placeId);
          }
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: 'Could not find restaurant. Please try again.' });
    }

    // --------------------------------------------------
    // GET RESTAURANT DETAILS
    // --------------------------------------------------
    const detRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_address&key=${GOOGLE_API_KEY}`
    );

    const detData = await detRes.json();

    if (detData.status !== 'OK') {
      return res.status(500).json({ error: 'Google Place Details failed.' });
    }

    const place = detData.result;

    const addressParts = place.formatted_address.split(',');
    const restaurantCity = addressParts.length > 1 ? addressParts[1].trim() : '';

    const cleanUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

    // --------------------------------------------------
    // START APIFY
    // --------------------------------------------------
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

    return res.status(200).json({
      status: 'started',
      runId: newRunId,
      restaurant: {
        name: place.name,
        city: restaurantCity,
        address: place.formatted_address,
        rating: place.rating,
        totalReviews: place.user_ratings_total,
        placeId
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

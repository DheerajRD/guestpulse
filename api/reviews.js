module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId, runId, yelpRunId, tripRunId, action } = req.body || {};

  const GOOGLE_API_KEY  = process.env.GOOGLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

  if (!GOOGLE_API_KEY)  return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
  if (!APIFY_API_TOKEN) return res.status(500).json({ error: 'APIFY_API_TOKEN not configured' });

  try {

    // --------------------------------------------------
    // HELPER: fetch reviews from dataset
    // --------------------------------------------------
    const fetchReviews = async (datasetId, source) => {
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=200`);
      const items = await itemsRes.json();
      const reviews = [];

      for (const item of items) {
        const arr = item.reviews || [];

        for (const r of arr) {
          if (r.text && r.text.trim().length > 10) {
            reviews.push({
              source,
              author: r.name || 'Anonymous',
              rating: r.stars || r.rating || 0,
              text: r.text.trim(),
              time: r.publishedAtDate || ''
            });
          }
        }

        if (item.text && item.text.trim().length > 10) {
          reviews.push({
            source,
            author: item.name || item.reviewerName || 'Anonymous',
            rating: item.stars || item.rating || 0,
            text: item.text.trim(),
            time: item.publishedAtDate || ''
          });
        }
      }

      return reviews;
    };

    // --------------------------------------------------
    // CHECK STATUS (ALL SOURCES)
    // --------------------------------------------------
    if (action === 'check') {

      const results = {
        google: null,
        yelp: null,
        tripadvisor: null
      };

      let allDone = true;

      const checkRun = async (id, source) => {
        if (!id) return null;

        const r = await fetch(`https://api.apify.com/v2/actor-runs/${id}?token=${APIFY_API_TOKEN}`);
        const d = await r.json();
        const status = d?.data?.status;

        if (status === 'SUCCEEDED') {
          const datasetId = d.data.defaultDatasetId;
          return await fetchReviews(datasetId, source);
        }

        if (status === 'FAILED' || status === 'ABORTED') {
          return { error: `${source} failed` };
        }

        allDone = false;
        return null;
      };

      results.google = await checkRun(runId, 'google');
      results.yelp = await checkRun(yelpRunId, 'yelp');
      results.tripadvisor = await checkRun(tripRunId, 'tripadvisor');

      if (!allDone) {
        return res.status(200).json({ status: 'running' });
      }

      return res.status(200).json({
        status: 'done',
        reviews: {
          google: results.google || [],
          yelp: results.yelp || [],
          tripadvisor: results.tripadvisor || []
        }
      });
    }

    // --------------------------------------------------
    // EXTRACT PLACE ID (same as yours)
    // --------------------------------------------------
    let placeId = directId || null;

    if (!placeId && placeUrl) {
      const directMatch = placeUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
      if (directMatch) placeId = directMatch[1];

      const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const lat = coordMatch ? coordMatch[1] : null;
      const lng = coordMatch ? coordMatch[2] : null;

      if (!placeId) {
        const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
        if (chMatch) placeId = chMatch[0];
      }

      if (!placeId) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&key=${GOOGLE_API_KEY}`;
          if (lat && lng) url += `&location=${lat},${lng}&radius=500`;

          const r = await fetch(url);
          const d = await r.json();
          if (d.results?.length) placeId = d.results[0].place_id;
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: 'Could not find restaurant.' });
    }

    // --------------------------------------------------
    // GET DETAILS
    // --------------------------------------------------
    const detRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_address&key=${GOOGLE_API_KEY}`
    );

    const detData = await detRes.json();
    const place = detData.result;

    const addressParts = place.formatted_address.split(',');
    const restaurantCity = addressParts.length > 1 ? addressParts[1].trim() : '';

    const cleanUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
    const searchQuery = `${place.name} ${restaurantCity}`;

    // --------------------------------------------------
    // START GOOGLE
    // --------------------------------------------------
    const gRes = await fetch(`https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: cleanUrl }],
        maxReviews: 150
      })
    });

    const gData = await gRes.json();

    // --------------------------------------------------
    // START YELP
    // --------------------------------------------------
    const yRes = await fetch(`https://api.apify.com/v2/acts/compass~yelp-reviews-scraper/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search: searchQuery,
        maxReviews: 50
      })
    });

    const yData = await yRes.json();

    // --------------------------------------------------
    // START TRIPADVISOR
    // --------------------------------------------------
    const tRes = await fetch(`https://api.apify.com/v2/acts/maxcopell~tripadvisor-reviews/runs?token=${APIFY_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery,
        maxReviews: 50
      })
    });

    const tData = await tRes.json();

    return res.status(200).json({
      status: 'started',
      runIds: {
        google: gData?.data?.id,
        yelp: yData?.data?.id,
        tripadvisor: tData?.data?.id
      },
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
    console.error(err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

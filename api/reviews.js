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

    // HELPER: fetch reviews from dataset
    const fetchReviews = async (datasetId, source) => {
      const itemsRes = await fetch('https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + APIFY_API_TOKEN + '&limit=200');
      const items    = await itemsRes.json();
      const reviews  = [];

      for (const item of items) {
        const arr = item.reviews || [];
        for (const r of arr) {
          if (r.text && r.text.trim().length > 10) {
            reviews.push({ source, author:r.name||'Anonymous', rating:r.stars||r.rating||0, text:r.text.trim(), time:r.publishedAtDate||'' });
          }
        }
        if (arr.length === 0 && item.text && item.text.trim().length > 10) {
          reviews.push({ source, author:item.name||item.reviewerName||'Anonymous', rating:item.stars||item.rating||0, text:item.text.trim(), time:item.publishedAtDate||'' });
        }
      }
      return reviews;
    };

    // HELPER: check single run status
    const checkRun = async (id, source) => {
      if (!id) return { status: 'done', reviews: [] };
      const r = await fetch('https://api.apify.com/v2/actor-runs/' + id + '?token=' + APIFY_API_TOKEN);
      const d = await r.json();
      const status = d?.data?.status;
      if (status === 'SUCCEEDED') {
        const reviews = await fetchReviews(d.data.defaultDatasetId, source);
        return { status: 'done', reviews };
      }
      if (status === 'FAILED' || status === 'ABORTED') return { status: 'done', reviews: [] };
      return { status: 'running', reviews: [] };
    };

    // CHECK: poll all runs
    if (action === 'check') {
      const [gResult, yResult, tResult] = await Promise.all([
        checkRun(runId,      'google'),
        checkRun(yelpRunId,  'yelp'),
        checkRun(tripRunId,  'tripadvisor'),
      ]);

      const allDone = gResult.status === 'done' && yResult.status === 'done' && tResult.status === 'done';

      if (!allDone) {
        return res.status(200).json({ status: 'running' });
      }

      // Combine all reviews
      const allReviews = [
        ...gResult.reviews,
        ...yResult.reviews,
        ...tResult.reviews,
      ];

      if (allReviews.length === 0) {
        return res.status(404).json({ error: 'No reviews found from any source.' });
      }

      console.log('Reviews fetched — Google:', gResult.reviews.length, 'Yelp:', yResult.reviews.length, 'TripAdvisor:', tResult.reviews.length);

      return res.status(200).json({
        status: 'done',
        reviews: allReviews,
        total:   allReviews.length,
        sources: {
          google:      gResult.reviews.length,
          yelp:        yResult.reviews.length,
          tripadvisor: tResult.reviews.length,
        }
      });
    }

    // FIND PLACE ID
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
          let url = 'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(name) + '&key=' + GOOGLE_API_KEY;
          if (lat && lng) url += '&location=' + lat + ',' + lng + '&radius=500';
          const r = await fetch(url);
          const d = await r.json();
          if (d.results?.length) placeId = d.results[0].place_id;
        }
      }

      if (!placeId) {
        const latMatch  = placeUrl.match(/!3d(-?\d+\.\d+)/);
        const lngMatch  = placeUrl.match(/!4d(-?\d+\.\d+)/);
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (latMatch && lngMatch && nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          const r = await fetch('https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' + latMatch[1] + ',' + lngMatch[1] + '&radius=100&keyword=' + encodeURIComponent(name) + '&key=' + GOOGLE_API_KEY);
          const d = await r.json();
          if (d.results?.length) placeId = d.results[0].place_id;
        }
      }
    }

    if (!placeId) return res.status(400).json({ error: 'Could not find restaurant.' });

    // GET DETAILS
    const detRes  = await fetch('https://maps.googleapis.com/maps/api/place/details/json?place_id=' + placeId + '&fields=name,rating,user_ratings_total,formatted_address&key=' + GOOGLE_API_KEY);
    const detData = await detRes.json();
    if (detData.status !== 'OK') return res.status(500).json({ error: 'Google Place Details failed.' });

    const place         = detData.result;
    const addressParts  = place.formatted_address.split(',');
    const city          = addressParts.length > 1 ? addressParts[1].trim() : '';
    const cleanUrl      = 'https://www.google.com/maps/place/?q=place_id:' + placeId;
    const searchQuery   = place.name + ' ' + city;

    // START GOOGLE
    const gRes = await fetch('https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=' + APIFY_API_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls:[{url:cleanUrl}], maxReviews:150, reviewsSort:'newest', language:'en' })
    });
    const gData = await gRes.json();

    // START YELP
    const yRes = await fetch('https://api.apify.com/v2/acts/compass~yelp-reviews-scraper/runs?token=' + APIFY_API_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerms:[searchQuery], maxReviews:50 })
    });
    const yData = await yRes.json();

    // START TRIPADVISOR
    const tRes = await fetch('https://api.apify.com/v2/acts/maxcopell~tripadvisor-reviews/runs?token=' + APIFY_API_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries:[searchQuery], maxReviews:50 })
    });
    const tData = await tRes.json();

    console.log('Started — Google:', gData?.data?.id, 'Yelp:', yData?.data?.id, 'TripAdvisor:', tData?.data?.id);

    return res.status(200).json({
      status: 'started',
      runId:     gData?.data?.id || null,
      yelpRunId: yData?.data?.id || null,
      tripRunId: tData?.data?.id || null,
      restaurant: {
        name: place.name, city, address: place.formatted_address,
        rating: place.rating, totalReviews: place.user_ratings_total, placeId
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

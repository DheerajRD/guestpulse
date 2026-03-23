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

    // CHECK: poll existing Apify run
    if (action === 'check' && runId) {
      const statusRes  = await fetch('https://api.apify.com/v2/actor-runs/' + runId + '?token=' + APIFY_API_TOKEN);
      const statusData = await statusRes.json();
      const status     = statusData.data && statusData.data.status;

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;
        const itemsRes  = await fetch('https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + APIFY_API_TOKEN + '&limit=150');
        const items     = await itemsRes.json();
        const reviews   = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const arr  = item.reviews || [];
          for (let j = 0; j < arr.length; j++) {
            const r = arr[j];
            if (r.text && r.text.trim().length > 10) {
              reviews.push({
                id:     reviews.length + 1,
                author: r.name || 'Anonymous',
                rating: r.stars || r.rating || 0,
                text:   r.text.trim(),
                time:   r.publishedAtDate || '',
              });
            }
          }
        }

        if (reviews.length === 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.text && item.text.trim().length > 10) {
              reviews.push({
                id:     reviews.length + 1,
                author: item.name || item.reviewerName || 'Anonymous',
                rating: item.stars || item.rating || 0,
                text:   item.text.trim(),
                time:   item.publishedAtDate || '',
              });
            }
          }
        }

        if (reviews.length === 0) return res.status(404).json({ error: 'No reviews found.' });
        return res.status(200).json({ status: 'done', reviews, total: reviews.length });
      }

      if (status === 'FAILED' || status === 'ABORTED') {
        return res.status(500).json({ error: 'Apify run failed. Please try again.' });
      }

      return res.status(200).json({ status: 'running' });
    }

    // START: find restaurant and launch Apify
    let placeId = directId || null;

    if (!placeId && placeUrl) {

      // Method 1: ChIJ format in URL
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) {
        placeId = chMatch[0];
        console.log('Method 1 found:', placeId);
      }

      // Method 2: text search by name
      if (!placeId) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 2 searching:', name);
          const r = await fetch('https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(name) + '&key=' + GOOGLE_API_KEY);
          const d = await r.json();
          console.log('Method 2 status:', d.status, 'count:', d.results ? d.results.length : 0);
          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 2 found:', placeId);
          }
        }
      }

      // Method 3: nearby search with precise !3d !4d coords
      if (!placeId) {
        const latMatch  = placeUrl.match(/!3d(-?\d+\.\d+)/);
        const lngMatch  = placeUrl.match(/!4d(-?\d+\.\d+)/);
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (latMatch && lngMatch && nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 3 searching near:', latMatch[1], lngMatch[1]);
          const r = await fetch('https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' + latMatch[1] + ',' + lngMatch[1] + '&radius=100&keyword=' + encodeURIComponent(name) + '&key=' + GOOGLE_API_KEY);
          const d = await r.json();
          console.log('Method 3 status:', d.status, 'count:', d.results ? d.results.length : 0);
          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 3 found:', placeId);
          }
        }
      }

      // Method 4: nearby search with @ coords
      if (!placeId) {
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        const nameMatch  = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (coordMatch && nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 4 searching near:', coordMatch[1], coordMatch[2]);
          const r = await fetch('https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' + coordMatch[1] + ',' + coordMatch[2] + '&radius=300&keyword=' + encodeURIComponent(name) + '&key=' + GOOGLE_API_KEY);
          const d = await r.json();
          console.log('Method 4 status:', d.status, 'count:', d.results ? d.results.length : 0);
          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 4 found:', placeId);
          }
        }
      }

      // Method 5: text search with location bias
      if (!placeId) {
        const nameMatch  = placeUrl.match(/\/place\/([^/@?#]+)/);
        const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (nameMatch && coordMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 5 searching with bias:', name);
          const r = await fetch('https://maps.googleapis.com/maps/api/place/textsearch/json?query=' + encodeURIComponent(name) + '&location=' + coordMatch[1] + ',' + coordMatch[2] + '&radius=500&key=' + GOOGLE_API_KEY);
          const d = await r.json();
          console.log('Method 5 status:', d.status, 'count:', d.results ? d.results.length : 0);
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

    // Get restaurant details
    const detRes  = await fetch('https://maps.googleapis.com/maps/api/place/details/json?place_id=' + placeId + '&fields=name,rating,user_ratings_total,formatted_address&key=' + GOOGLE_API_KEY);
    const detData = await detRes.json();

    if (detData.status === 'REQUEST_DENIED') return res.status(403).json({ error: 'Google API blocked. Check billing.' });
    if (detData.status !== 'OK') return res.status(404).json({ error: 'Google API error: ' + detData.status });

    const place    = detData.result;
    const cleanUrl = 'https://www.google.com/maps/place/?q=place_id:' + placeId;
    console.log('Apify URL:', cleanUrl);

    // Start Apify
    const startRes = await fetch('https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=' + APIFY_API_TOKEN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls:   [{ url: cleanUrl }],
        maxReviews:  100,
        reviewsSort: 'newest',
        language:    'en',
      }),
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.log('Apify start failed:', errText);
      return res.status(500).json({ error: 'Apify Error: ' + errText.substring(0, 200) });
    }

    const startData = await startRes.json();
    const newRunId  = startData.data && startData.data.id;
    if (!newRunId) return res.status(500).json({ error: 'No run ID from Apify' });

    console.log('Apify started:', newRunId);

    return res.status(200).json({
      status: 'started',
      runId:  newRunId,
      restaurant: {
        name:         place.name,
        address:      place.formatted_address,
        rating:       place.rating,
        totalReviews: place.user_ratings_total,
        placeId:      placeId,
      },
    });

  } catch (err) {
    console.error('reviews.js error:', err.message);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId, runId, yelpRunId, tripRunId, action } = req.body || {};

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

  if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
  if (!APIFY_API_TOKEN) return res.status(500).json({ error: 'APIFY_API_TOKEN not configured' });

  try {
    // --------------------------------------------------
    // HELPER: fetch reviews from dataset
    // --------------------------------------------------
    const fetchReviews = async (datasetId, source) => {
      const itemsRes = await fetch(
        'https://api.apify.com/v2/datasets/' + datasetId + '/items?token=' + APIFY_API_TOKEN + '&limit=200'
      );
      const items = await itemsRes.json();
      const reviews = [];

      // STEP 3: dataset count log
      console.log(source, 'dataset items count:', Array.isArray(items) ? items.length : 0);

      // STEP 4: sample item log
      if (Array.isArray(items) && items.length > 0) {
        console.log(source, 'sample item:', JSON.stringify(items[0]).slice(0, 700));
      }

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
    // HELPER: check single run status
    // --------------------------------------------------
    const checkRun = async (id, source) => {
      if (!id) return { status: 'done', reviews: [] };

      const r = await fetch('https://api.apify.com/v2/actor-runs/' + id + '?token=' + APIFY_API_TOKEN);
      const d = await r.json();
      const status = d?.data?.status;

      if (status === 'SUCCEEDED') {
        const datasetId = d?.data?.defaultDatasetId;
        if (!datasetId) return { status: 'done', reviews: [] };
        const reviews = await fetchReviews(datasetId, source);
        return { status: 'done', reviews };
      }

      if (status === 'FAILED' || status === 'ABORTED') {
        return { status: 'done', reviews: [] };
      }

      return { status: 'running', reviews: [] };
    };

    // --------------------------------------------------
    // CHECK: poll all runs
    // --------------------------------------------------
    if (action === 'check') {
      const [gResult, yResult, tResult] = await Promise.all([
        checkRun(runId, 'google'),
        checkRun(yelpRunId, 'yelp'),
        checkRun(tripRunId, 'tripadvisor'),
      ]);

      const allDone =
        gResult.status === 'done' &&
        yResult.status === 'done' &&
        tResult.status === 'done';

      if (!allDone) {
        return res.status(200).json({ status: 'running' });
      }

      const allReviews = [
        ...gResult.reviews,
        ...yResult.reviews,
        ...tResult.reviews,
      ];

      if (allReviews.length === 0) {
        return res.status(404).json({ error: 'No reviews found from any source.' });
      }

      return res.status(200).json({
        status: 'done',
        reviews: allReviews,
        total: allReviews.length,
        sources: {
          google: gResult.reviews.length,
          yelp: yResult.reviews.length,
          tripadvisor: tResult.reviews.length,
        }
      });
    }

    // --------------------------------------------------
    // FIND PLACE ID (full 5-method logic)
    // --------------------------------------------------
    let placeId = directId || null;

    if (!placeId && placeUrl) {
      // Method 0: direct place_id
      const directMatch = placeUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
      if (directMatch) {
        placeId = directMatch[1];
        console.log('Method 0 (direct place_id):', placeId);
      }

      // Common coords from @lat,lng
      const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const lat = coordMatch ? coordMatch[1] : null;
      const lng = coordMatch ? coordMatch[2] : null;

      // Method 1: ChIJ in URL
      if (!placeId) {
        const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
        if (chMatch) {
          placeId = chMatch[0];
          console.log('Method 1 found:', placeId);
        }
      }

      // Method 2: text search by name with location bias
      if (!placeId) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 2 searching:', name);

          let url =
            'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' +
            encodeURIComponent(name) +
            '&key=' +
            GOOGLE_API_KEY;

          if (lat && lng) {
            url += '&location=' + lat + ',' + lng + '&radius=500';
          }

          const r = await fetch(url);
          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 2 found:', placeId);
          }
        }
      }

      // Method 3: nearby search with !3d !4d coords
      if (!placeId) {
        const latMatch = placeUrl.match(/!3d(-?\d+\.\d+)/);
        const lngMatch = placeUrl.match(/!4d(-?\d+\.\d+)/);
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (latMatch && lngMatch && nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 3 searching near:', latMatch[1], lngMatch[1]);

          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' +
              latMatch[1] +
              ',' +
              lngMatch[1] +
              '&radius=100&keyword=' +
              encodeURIComponent(name) +
              '&key=' +
              GOOGLE_API_KEY
          );
          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 3 found:', placeId);
          }
        }
      }

      // Method 4: nearby search with @ coords
      if (!placeId && lat && lng) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 4 searching near:', lat, lng);

          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=' +
              lat +
              ',' +
              lng +
              '&radius=300&keyword=' +
              encodeURIComponent(name) +
              '&key=' +
              GOOGLE_API_KEY
          );
          const d = await r.json();

          if (d.results && d.results.length > 0) {
            placeId = d.results[0].place_id;
            console.log('Method 4 found:', placeId);
          }
        }
      }

      // Method 5: text search with strong location bias
      if (!placeId && lat && lng) {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);

        if (nameMatch) {
          const name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim();
          console.log('Method 5 searching with bias:', name);

          const r = await fetch(
            'https://maps.googleapis.com/maps/api/place/textsearch/json?query=' +
              encodeURIComponent(name) +
              '&location=' +
              lat +
              ',' +
              lng +
              '&radius=1000&key=' +
              GOOGLE_API_KEY
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
      return res.status(400).json({ error: 'Could not find restaurant.' });
    }

    // --------------------------------------------------
    // GET DETAILS
    // --------------------------------------------------
    const detRes = await fetch(
      'https://maps.googleapis.com/maps/api/place/details/json?place_id=' +
        placeId +
        '&fields=name,rating,user_ratings_total,formatted_address,geometry,address_components&key=' + GOOGLE_API_KEY
    );

    const detData = await detRes.json();

    if (detData.status !== 'OK') {
      return res.status(500).json({ error: 'Google Place Details failed.' });
    }

    const place = detData.result;
    const addressParts = (place.formatted_address || '').split(',');
    const city = addressParts.length > 1 ? addressParts[1].trim() : '';
    const cleanUrl = 'https://www.google.com/maps/place/?q=place_id:' + placeId;

    // STEP 2: stronger search query
    const searchQuery = [
      place.name || '',
      city || '',
      place.formatted_address || ''
    ].join(' ').trim();

    console.log('Search query for Yelp/TripAdvisor:', searchQuery);

    // --------------------------------------------------
    // START GOOGLE
    // --------------------------------------------------
    const gRes = await fetch(
      'https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=' + APIFY_API_TOKEN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url: cleanUrl }],
          maxReviews: 150,
          reviewsSort: 'newest',
          language: 'en'
        })
      }
    );

    const gData = await gRes.json();

    // --------------------------------------------------
    // START YELP (safe)
    // --------------------------------------------------
    let safeYelpRunId = null;

    try {
      const yRes = await fetch(
        'https://api.apify.com/v2/acts/compass~yelp-reviews-scraper/runs?token=' + APIFY_API_TOKEN,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            searchTerms: [searchQuery],
            maxReviews: 50
          })
        }
      );

      if (!yRes.ok) {
        const errText = await yRes.text();
        console.log('Yelp API error:', errText);
      } else {
        const yData = await yRes.json();
        safeYelpRunId = yData?.data?.id || null;
      }
    } catch (err) {
      console.log('Yelp failed:', err.message);
    }

    // STEP 1: Yelp runId log
    console.log('Yelp runId:', safeYelpRunId);

    // --------------------------------------------------
    // START TRIPADVISOR (safe)
    // --------------------------------------------------
    let safeTripRunId = null;

    try {
      const tRes = await fetch(
        'https://api.apify.com/v2/acts/maxcopell~tripadvisor-reviews/runs?token=' + APIFY_API_TOKEN,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: [searchQuery],
            maxReviews: 50
          })
        }
      );

      if (!tRes.ok) {
        const errText = await tRes.text();
        console.log('TripAdvisor API error:', errText);
      } else {
        const tData = await tRes.json();
        safeTripRunId = tData?.data?.id || null;
      }
    } catch (err) {
      console.log('TripAdvisor failed:', err.message);
    }

    // STEP 1: TripAdvisor runId log
    console.log('TripAdvisor runId:', safeTripRunId);

    return res.status(200).json({
      status: 'started',
      runId: gData?.data?.id || null,
      yelpRunId: safeYelpRunId,
      tripRunId: safeTripRunId,
      restaurant: {
        name: place.name,
        city,
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

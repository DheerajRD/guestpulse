module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { placeUrl, placeId: directId } = req.body || {};
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured in environment variables' });

  try {
    let placeId = directId || null;

    if (!placeId && placeUrl) {
      const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
      if (chMatch) {
        placeId = chMatch[0];
      } else {
        const nameMatch = placeUrl.match(/place\/([^/@?]+)/);
        const query = nameMatch ? decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')) : placeUrl;
        const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${GOOGLE_API_KEY}`);
        const searchData = await searchRes.json();
        if (!searchData.candidates?.length) return res.status(404).json({ error: 'Restaurant not found. Please paste the full Google Maps URL.' });
        placeId = searchData.candidates[0].place_id;
      }
    }

    if (!placeId) return res.status(400).json({ error: 'Please provide a Google Maps URL.' });

    const detRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,formatted_address&key=${GOOGLE_API_KEY}`);
    const detData = await detRes.json();
    if (detData.status !== 'OK') return res.status(404).json({ error: `Google API error: ${detData.status}. Check your API key and that Places API is enabled.` });

    const place = detData.result;
    const reviews = (place.reviews || [])
      .map((r, i) => ({ id: i + 1, author: r.author_name || 'Anonymous', rating: r.rating || 0, text: r.text || '', time: r.relative_time_description || '' }))
      .filter(r => r.text.trim().length > 0);

    if (!reviews.length) return res.status(404).json({ error: 'No reviews found for this restaurant.' });

    return res.status(200).json({
      restaurant: { name: place.name, address: place.formatted_address, rating: place.rating, totalReviews: place.user_ratings_total, placeId },
      reviews,
      total: reviews.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to fetch reviews' });
  }
};

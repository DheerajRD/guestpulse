module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, lat, lng, address, city } = req.body || {};
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) return res.status(500).json({ error: 'GOOGLE_API_KEY not configured' });
  if (!name) return res.status(400).json({ error: 'Restaurant name is required' });

  try {
    let searchLat = lat, searchLng = lng;

    if (!searchLat && (address || city)) {
      const geoQuery = encodeURIComponent(address || city);
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${geoQuery}&key=${GOOGLE_API_KEY}`);
      const geoData = await geoRes.json();
      if (geoData.results?.length) {
        searchLat = geoData.results[0].geometry.location.lat;
        searchLng = geoData.results[0].geometry.location.lng;
      }
    }

    let url;
    if (searchLat && searchLng) {
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}&radius=5000&keyword=${encodeURIComponent(name)}&type=restaurant&key=${GOOGLE_API_KEY}`;
    } else {
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name + ' restaurant')}&key=${GOOGLE_API_KEY}`;
    }

    const searchRes = await fetch(url);
    const searchData = await searchRes.json();
    const places = (searchData.results || []).slice(0, 6);

    if (!places.length) return res.status(404).json({ error: `No "${name}" locations found nearby.` });

    const branches = places.map(p => {
      let dist = null;
      if (searchLat && searchLng && p.geometry?.location) {
        const R = 3958.8;
        const dLat = (p.geometry.location.lat - searchLat) * Math.PI / 180;
        const dLng = (p.geometry.location.lng - searchLng) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(searchLat * Math.PI/180) * Math.cos(p.geometry.location.lat * Math.PI/180) * Math.sin(dLng/2)**2;
        dist = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
      }
      return {
        placeId: p.place_id,
        name: p.name,
        address: p.vicinity || p.formatted_address,
        rating: p.rating || 0,
        reviews: p.user_ratings_total || 0,
        lat: p.geometry?.location?.lat,
        lng: p.geometry?.location?.lng,
        distance: dist,
        open: p.opening_hours?.open_now,
      };
    }).sort((a, b) => (a.distance || 999) - (b.distance || 999));

    return res.status(200).json({ branches, total: branches.length, searchLocation: searchLat ? { lat: searchLat, lng: searchLng } : null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
};

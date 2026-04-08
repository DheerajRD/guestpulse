module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name,
      lat,
      lng,
      address,
      city,
      yourRestaurant
    } = req.body || {};

    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: "GOOGLE_API_KEY not configured" });
    }

    if (!name) {
      return res.status(400).json({ error: "Restaurant name is required" });
    }

    let searchLat = lat;
    let searchLng = lng;

    if ((!searchLat || !searchLng) && (address || city)) {
      const geoQuery = encodeURIComponent(address || city);
      const geoRes = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${geoQuery}&key=${GOOGLE_API_KEY}`
      );
      const geoData = await geoRes.json();

      if (geoData.results?.length) {
        searchLat = geoData.results[0].geometry.location.lat;
        searchLng = geoData.results[0].geometry.location.lng;
      }
    }

    let keyword = name;
    const lower = String(name).toLowerCase();

    if (lower.includes("ice cream")) {
      keyword = "ice cream";
    } else if (lower.includes("pizza")) {
      keyword = "pizza";
    } else if (lower.includes("burger")) {
      keyword = "burger";
    } else if (lower.includes("biryani")) {
      keyword = "biryani";
    }

    let searchUrl;
    if (searchLat && searchLng) {
      searchUrl =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${searchLat},${searchLng}` +
        `&radius=4000&type=restaurant&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_API_KEY}`;
    } else {
      searchUrl =
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword + " restaurant")}` +
        `&key=${GOOGLE_API_KEY}`;
    }

    const placesRes = await fetch(searchUrl);
    const placesData = await placesRes.json();
    const places = Array.isArray(placesData.results) ? placesData.results : [];

    const normalize = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const yourName = normalize(name);

    const competitors = places
      .filter((p) => normalize(p.name) !== yourName)
      .map((p) => {
        let distance = null;

        if (searchLat && searchLng && p.geometry?.location) {
          const R = 3958.8;
          const dLat = ((p.geometry.location.lat - searchLat) * Math.PI) / 180;
          const dLng = ((p.geometry.location.lng - searchLng) * Math.PI) / 180;

          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((searchLat * Math.PI) / 180) *
              Math.cos((p.geometry.location.lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;

          distance = Number(
            (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
          );
        }

        return {
          placeId: p.place_id,
          name: p.name,
          address: p.vicinity || p.formatted_address || "",
          rating: typeof p.rating === "number" ? p.rating : 0,
          reviews: p.user_ratings_total || 0,
          open: p.opening_hours?.open_now ?? null,
          distance,
          lat: p.geometry?.location?.lat || null,
          lng: p.geometry?.location?.lng || null
        };
      })
      .sort((a, b) => {
        if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
        return b.rating - a.rating;
      })
      .slice(0, 5);

    const yourRating = Number(yourRestaurant?.rating || 0);
    const yourReviews = Number(yourRestaurant?.totalReviews || 0);
    const topCompetitor = competitors[0] || null;

    let summary = {
      winning: [],
      losing: [],
      recommendation: "Not enough competitor data yet."
    };

    if (topCompetitor) {
      if (yourRating >= topCompetitor.rating) {
        summary.winning.push(
          `Your rating (${yourRating}) is stronger than ${topCompetitor.name} (${topCompetitor.rating}).`
        );
      } else {
        summary.losing.push(
          `${topCompetitor.name} has a higher rating (${topCompetitor.rating}) than your restaurant (${yourRating}).`
        );
      }

      if (yourReviews >= topCompetitor.reviews) {
        summary.winning.push(
          `Your restaurant has stronger review volume (${yourReviews}) than ${topCompetitor.name} (${topCompetitor.reviews}).`
        );
      } else {
        summary.losing.push(
          `${topCompetitor.name} has more customer reviews (${topCompetitor.reviews}) than your restaurant (${yourReviews}).`
        );
      }

      if ((yourRestaurant?.healthScore || 0) >= 70) {
        summary.winning.push("Your current AI health score is strong, which suggests healthier customer sentiment overall.");
      } else {
        summary.losing.push("Your AI health score is not yet strong enough, which suggests customer experience needs improvement.");
      }

      if (summary.losing.length > summary.winning.length) {
        summary.recommendation =
          `You are currently behind ${topCompetitor.name}. Focus on service quality, review generation, and fixing repeated complaints first.`;
      } else {
        summary.recommendation =
          `You are competitive against ${topCompetitor.name}. Focus on keeping quality high and increasing review volume to strengthen your lead.`;
      }
    }

    return res.status(200).json({
      competitors,
      summary,
      keywordUsed: keyword
    });
  } catch (err) {
    console.error("competitors.js error:", err);
    return res.status(500).json({ error: err.message || "Competitor comparison failed" });
  }
};

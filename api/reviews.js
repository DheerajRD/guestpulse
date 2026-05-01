module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    placeUrl,
    placeId: directId,
    runId,
    yelpRunId,
    tripRunId,
    action,
    addressHint,
    yelpUrl,
    monthsBack
  } = req.body || {};

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: "GOOGLE_API_KEY not configured" });
  }

  if (!APIFY_API_TOKEN) {
    return res.status(500).json({ error: "APIFY_API_TOKEN not configured" });
  }

  try {
    const normalizeText = (value) => {
      if (value === null || value === undefined) return "";
      return String(value).replace(/\s+/g, " ").trim();
    };

    const safeNumber = (value) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

    const normalizeDate = (value) => {
      if (!value) return "";

      if (typeof value === "number") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? "" : d.toISOString();
      }

      const raw = String(value).trim();
      if (!raw) return "";

      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();

      return raw;
    };

    const normalizeReview = (review, source) => {
      const text = normalizeText(
        review?.text ||
          review?.reviewText ||
          review?.review_text ||
          review?.comment ||
          review?.content ||
          review?.description ||
          review?.snippet ||
          review?.body ||
          review?.message ||
          review?.reviewBody ||
          review?.review_body ||
          review?.reviewContent ||
          review?.review_content ||
          review?.fullReview ||
          review?.full_review ||
          review?.localizedText ||
          review?.localized_text ||
          review?.feedback ||
          ""
      );

      if (!text || text.length < 3) return null;

      const author = normalizeText(
        review?.name ||
          review?.reviewerName ||
          review?.reviewer_name ||
          review?.author ||
          review?.authorName ||
          review?.author_name ||
          review?.userName ||
          review?.user_name ||
          review?.username ||
          review?.reviewer ||
          review?.user?.name ||
          review?.user?.displayName ||
          review?.user ||
          "Anonymous"
      );

      const rating = safeNumber(
        review?.stars ??
          review?.rating ??
          review?.score ??
          review?.reviewRating ??
          review?.review_rating ??
          review?.ratingValue ??
          review?.rating_value ??
          review?.reviewRating?.ratingValue ??
          review?.reviewRating?.value ??
          0
      );

      const time = normalizeDate(
        review?.publishedAtDate ||
          review?.published_at_date ||
          review?.date ||
          review?.publishedDate ||
          review?.published_date ||
          review?.reviewDate ||
          review?.review_date ||
          review?.time ||
          review?.createdAt ||
          review?.created_at ||
          review?.publishedAt ||
          review?.published_at ||
          review?.datePublished ||
          review?.date_published ||
          review?.localizedDate ||
          review?.localized_date ||
          ""
      );

      return { source, author, rating, text, time };
    };

    const dedupeReviews = (reviews) => {
      const seen = new Set();
      const out = [];

      for (const review of reviews) {
        const key = [
          review.source || "",
          (review.author || "").toLowerCase(),
          String(review.rating || 0),
          (review.text || "").toLowerCase().slice(0, 180),
          review.time || ""
        ].join("|");

        if (seen.has(key)) continue;
        seen.add(key);
        out.push(review);
      }

      return out;
    };

    const parseReviewDate = (value) => {
      if (!value) return null;

      if (typeof value === "number") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }

      const raw = String(value).trim();
      if (!raw) return null;

      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) return parsed;

      const lower = raw.toLowerCase();
      const nMatch = lower.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/);
      const oneMatch = lower.match(/(?:a|an)\s*(second|minute|hour|day|week|month|year)\s*ago/);

      let amount = 0;
      let unit = "";

      if (nMatch) {
        amount = Number(nMatch[1]);
        unit = nMatch[2];
      } else if (oneMatch) {
        amount = 1;
        unit = oneMatch[1];
      } else if (lower.includes("yesterday")) {
        amount = 1;
        unit = "day";
      }

      if (!amount || !unit) return null;

      const d = new Date();
      if (unit === "second") d.setSeconds(d.getSeconds() - amount);
      if (unit === "minute") d.setMinutes(d.getMinutes() - amount);
      if (unit === "hour") d.setHours(d.getHours() - amount);
      if (unit === "day") d.setDate(d.getDate() - amount);
      if (unit === "week") d.setDate(d.getDate() - amount * 7);
      if (unit === "month") d.setMonth(d.getMonth() - amount);
      if (unit === "year") d.setFullYear(d.getFullYear() - amount);

      return isNaN(d.getTime()) ? null : d;
    };

    const filterReviewsByMonths = (reviews, months) => {
      const m = Number(months);
      if (!Number.isFinite(m) || m <= 0) return reviews;

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - m);

      return reviews.filter((review) => {
        const d = parseReviewDate(review.time);
        if (!d) return false;
        return d >= cutoff;
      });
    };

    const countBySource = (reviews) => ({
      google: reviews.filter((r) => r.source === "google").length,
      yelp: reviews.filter((r) => r.source === "yelp").length,
      tripadvisor: reviews.filter((r) => r.source === "tripadvisor").length
    });

    const fetchReviewsFromDataset = async (datasetId, source) => {
      if (!datasetId) return [];

      const itemsRes = await fetch(
        "https://api.apify.com/v2/datasets/" +
          datasetId +
          "/items?token=" +
          APIFY_API_TOKEN +
          "&limit=1000"
      );

      if (!itemsRes.ok) {
        const errText = await itemsRes.text();
        console.log(source, "dataset fetch failed:", errText);
        return [];
      }

      const items = await itemsRes.json();
      const reviews = [];

      console.log(source, "dataset items count:", Array.isArray(items) ? items.length : 0);

      if (!Array.isArray(items)) return [];

      const collectReviews = (obj) => {
        if (!obj || typeof obj !== "object") return;

        const normalized = normalizeReview(obj, source);
        if (normalized) reviews.push(normalized);

        for (const value of Object.values(obj)) {
          if (Array.isArray(value)) {
            for (const child of value) collectReviews(child);
          } else if (value && typeof value === "object") {
            collectReviews(value);
          }
        }
      };

      for (const item of items) {
        if (item?.demo === true) continue;
        collectReviews(item);
      }

      const clean = dedupeReviews(reviews);
      console.log(source, "normalized reviews count:", clean.length);
      return clean;
    };

    const checkRun = async (id, source) => {
      if (!id) {
        return { status: "done", reviews: [] };
      }

      const runRes = await fetch(
        "https://api.apify.com/v2/actor-runs/" +
          id +
          "?token=" +
          APIFY_API_TOKEN
      );

      if (!runRes.ok) {
        const errText = await runRes.text();
        console.log(source, "run check failed:", errText);
        return { status: "done", reviews: [] };
      }

      const runData = await runRes.json();
      const status = runData?.data?.status;

      if (status === "SUCCEEDED") {
        const datasetId = runData?.data?.defaultDatasetId;
        const reviews = await fetchReviewsFromDataset(datasetId, source);
        return { status: "done", reviews };
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        return { status: "done", reviews: [] };
      }

      return { status: "running", reviews: [] };
    };

    if (action === "check") {
      const [gResult, yResult, tResult] = await Promise.all([
        checkRun(runId, "google"),
        checkRun(yelpRunId, "yelp"),
        checkRun(tripRunId, "tripadvisor")
      ]);

      const allDone =
        gResult.status === "done" &&
        yResult.status === "done" &&
        tResult.status === "done";

      if (!allDone) {
        return res.status(200).json({ status: "running" });
      }

      const allReviews = dedupeReviews([
        ...gResult.reviews,
        ...yResult.reviews,
        ...tResult.reviews
      ]);

      if (allReviews.length === 0) {
        return res.status(404).json({ error: "No reviews found from any source." });
      }

      const filteredReviews = filterReviewsByMonths(allReviews, monthsBack);

      if (filteredReviews.length === 0) {
        const m = Number(monthsBack);
        return res.status(404).json({
          error: Number.isFinite(m) && m > 0
            ? `Reviews were found, but none were dated within the past ${m} months. Try All reviews or a larger window.`
            : "No reviews found from any source."
        });
      }

      const filteredSourceCounts = countBySource(filteredReviews);
      const allSourceCounts = countBySource(allReviews);

      return res.status(200).json({
        status: "done",
        reviews: filteredReviews,
        total: filteredReviews.length,
        totalBeforeFilter: allReviews.length,
        filteredOut: allReviews.length - filteredReviews.length,
        monthsBack: Number(monthsBack) || null,
        sources: filteredSourceCounts,
        sourceTotalsBeforeFilter: allSourceCounts
      });
    }

    let placeId = directId || null;

    if (!placeId && placeUrl) {
      const normalizeName = (s) =>
        (s || "")
          .toLowerCase()
          .replace(/[%]/g, "")
          .replace(/[^a-z0-9\s&'-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const extractPlaceName = () => {
        const nameMatch = placeUrl.match(/\/place\/([^/@?#]+)/);
        if (!nameMatch) return "";
        return decodeURIComponent(nameMatch[1].replace(/\+/g, " ")).trim();
      };

      const requestedName = extractPlaceName();
      const normalizedRequestedName = normalizeName(requestedName);

      const directMatch = placeUrl.match(/place_id:([a-zA-Z0-9_-]+)/);
      if (directMatch) {
        placeId = directMatch[1];
        console.log("Method 0 (direct place_id):", placeId);
      }

      if (!placeId) {
        const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
        if (chMatch) {
          placeId = chMatch[0];
          console.log("Method 1 found:", placeId);
        }
      }

      const coordMatch = placeUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      const lat = coordMatch ? coordMatch[1] : null;
      const lng = coordMatch ? coordMatch[2] : null;

      const latMatch = placeUrl.match(/!3d(-?\d+\.\d+)/);
      const lngMatch = placeUrl.match(/!4d(-?\d+\.\d+)/);
      const exactLat = latMatch ? latMatch[1] : lat;
      const exactLng = lngMatch ? lngMatch[1] : lng;

      const chooseBestCandidate = (results, preferClosest = false) => {
        if (!Array.isArray(results) || results.length === 0) return null;

        const requested = normalizedRequestedName;

        if (preferClosest) {
          const exact = results.find((r) => normalizeName(r.name || "") === requested);
          if (exact) return exact;

          const contains = results.find((r) => {
            const candidateName = normalizeName(r.name || "");
            return candidateName.includes(requested) || requested.includes(candidateName);
          });
          if (contains) return contains;

          return results[0];
        }

        const scored = results.map((r) => {
          const candidateName = normalizeName(r.name || "");
          let score = 0;

          if (candidateName === requested) score += 100;
          else if (candidateName.includes(requested) || requested.includes(candidateName)) score += 60;

          if ((r.business_status || "") === "OPERATIONAL") score += 10;
          if (typeof r.rating === "number") score += Math.min(r.rating, 5);

          return { ...r, _score: score };
        });

        scored.sort((a, b) => b._score - a._score);
        return scored[0];
      };

      if (!placeId && exactLat && exactLng && requestedName) {
        const r = await fetch(
          "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" +
            exactLat +
            "," +
            exactLng +
            "&rankby=distance&keyword=" +
            encodeURIComponent(requestedName) +
            "&key=" +
            GOOGLE_API_KEY
        );

        const d = await r.json();
        const best = chooseBestCandidate(d.results, true);

        if (best?.place_id) {
          placeId = best.place_id;
          console.log("Method 2 found:", placeId, best.name);
        }
      }

      if (!placeId && lat && lng && requestedName) {
        const r = await fetch(
          "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" +
            lat +
            "," +
            lng +
            "&rankby=distance&keyword=" +
            encodeURIComponent(requestedName) +
            "&key=" +
            GOOGLE_API_KEY
        );

        const d = await r.json();
        const best = chooseBestCandidate(d.results, true);

        if (best?.place_id) {
          placeId = best.place_id;
          console.log("Method 3 found:", placeId, best.name);
        }
      }

      if (!placeId && requestedName && exactLat && exactLng) {
        const r = await fetch(
          "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
            encodeURIComponent(requestedName) +
            "&location=" +
            exactLat +
            "," +
            exactLng +
            "&radius=100&key=" +
            GOOGLE_API_KEY
        );

        const d = await r.json();
        const best = chooseBestCandidate(d.results, false);

        if (best?.place_id) {
          placeId = best.place_id;
          console.log("Method 4 found:", placeId, best.name);
        }
      }

      if (!placeId && requestedName) {
        const r = await fetch(
          "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
            encodeURIComponent(requestedName) +
            "&key=" +
            GOOGLE_API_KEY
        );

        const d = await r.json();
        const best = chooseBestCandidate(d.results, false);

        if (best?.place_id) {
          placeId = best.place_id;
          console.log("Method 5 found:", placeId, best.name);
        }
      }
    }

    if (!placeId) {
      return res.status(400).json({ error: "Could not find restaurant." });
    }

    const detRes = await fetch(
      "https://maps.googleapis.com/maps/api/place/details/json?place_id=" +
        placeId +
        "&fields=name,rating,user_ratings_total,formatted_address,geometry,address_components&key=" +
        GOOGLE_API_KEY
    );

    const detData = await detRes.json();

    if (detData.status !== "OK") {
      return res.status(500).json({ error: "Google Place Details failed." });
    }

    const place = detData.result;
    const addressParts = (place.formatted_address || "").split(",");
    const city = addressParts.length > 1 ? addressParts[1].trim() : "";
    const cleanUrl = "https://www.google.com/maps/place/?q=place_id:" + placeId;

    const searchQuery = [
      place.name || "",
      place.formatted_address || "",
      city || "",
      addressHint || ""
    ]
      .join(" ")
      .trim();

    console.log("Search query for Yelp/TripAdvisor:", searchQuery);

    const gRes = await fetch(
      "https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=" + APIFY_API_TOKEN,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: cleanUrl }],
          maxReviews: 150,
          reviewsSort: "newest",
          language: "en"
        })
      }
    );

    const gData = await gRes.json();

    let safeYelpRunId = null;

    try {
      if (yelpUrl && yelpUrl.trim()) {
        console.log("Starting Yelp with direct URL:", yelpUrl.trim());

        const yRes = await fetch(
          "https://api.apify.com/v2/acts/agents~yelp-reviews/runs?token=" + APIFY_API_TOKEN,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              startUrls: [{ url: yelpUrl.trim() }],
              maxItems: 30,
              sortBy: "yelp"
            })
          }
        );

        if (!yRes.ok) {
          const errText = await yRes.text();
          console.log("Yelp API error:", errText);
        } else {
          const yData = await yRes.json();
          safeYelpRunId = yData?.data?.id || null;
        }
      } else {
        console.log("No Yelp URL provided. Skipping Yelp start.");
      }
    } catch (err) {
      console.log("Yelp failed:", err.message);
    }

    let safeTripRunId = null;

    try {
      const tRes = await fetch(
        "https://api.apify.com/v2/acts/maxcopell~tripadvisor-reviews/runs?token=" + APIFY_API_TOKEN,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: [searchQuery],
            maxReviews: 50
          })
        }
      );

      if (!tRes.ok) {
        const errText = await tRes.text();
        console.log("TripAdvisor API error:", errText);
      } else {
        const tData = await tRes.json();
        safeTripRunId = tData?.data?.id || null;
      }
    } catch (err) {
      console.log("TripAdvisor failed:", err.message);
    }

    return res.status(200).json({
      status: "started",
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
    console.error("reviews.js error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

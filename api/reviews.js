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
    monthsFilter,
    months
  } = req.body || {};

  const selectedMonthsFilter = monthsFilter || months || "all";

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

    const getReviewDate = (value) => {
      if (!value) return null;

      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;

      const raw = String(value).toLowerCase().trim();
      const now = new Date();

      const numMatch = raw.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/);
      if (numMatch) {
        const amount = Number(numMatch[1]);
        const unit = numMatch[2];
        const d = new Date(now);

        if (unit.includes("day")) d.setDate(d.getDate() - amount);
        if (unit.includes("week")) d.setDate(d.getDate() - amount * 7);
        if (unit.includes("month")) d.setMonth(d.getMonth() - amount);
        if (unit.includes("year")) d.setFullYear(d.getFullYear() - amount);

        return d;
      }

      if (raw.includes("yesterday")) {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        return d;
      }

      if (raw.includes("today") || raw.includes("hour ago") || raw.includes("hours ago")) {
        return now;
      }

      return null;
    };

    const filterReviewsByMonths = (reviews, filterValue) => {
      if (!filterValue || filterValue === "all") return reviews;

      const m = Number(filterValue);
      if (!Number.isFinite(m) || m <= 0) return reviews;

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - m);

      return reviews.filter((review) => {
        const reviewDate = getReviewDate(review.time);

        // Keep reviews with unknown dates so Yelp/TripAdvisor do not disappear
        if (!reviewDate) return true;

        return reviewDate >= cutoff;
      });
    };

    const normalizeReview = (review, source) => {
      const text = normalizeText(
        review?.text ||
          review?.reviewText ||
          review?.comment ||
          review?.content ||
          review?.reviewBody ||
          review?.review ||
          review?.reviewTextSnippet ||
          review?.textSnippet ||
          review?.description ||
          ""
      );

      if (!text || text.length < 10) return null;

      const author = normalizeText(
        review?.name ||
          review?.reviewerName ||
          review?.author ||
          review?.userName ||
          review?.username ||
          review?.reviewer ||
          review?.user?.name ||
          "Anonymous"
      );

      const rating = safeNumber(
        review?.stars ??
          review?.rating ??
          review?.score ??
          review?.reviewRating ??
          review?.ratingValue ??
          review?.reviewRating?.ratingValue ??
          0
      );

      const time = normalizeDate(
        review?.publishedAtDate ||
          review?.date ||
          review?.publishedDate ||
          review?.reviewDate ||
          review?.time ||
          review?.createdAt ||
          review?.publishedAt ||
          review?.localizedDate ||
          review?.datePublished ||
          ""
      );

      return {
        source,
        author,
        rating,
        text,
        time
      };
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

    const fetchReviewsFromDataset = async (datasetId, source) => {
      if (!datasetId) return [];

      const itemsRes = await fetch(
        "https://api.apify.com/v2/datasets/" +
          datasetId +
          "/items?token=" +
          APIFY_API_TOKEN +
          "&limit=300"
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

      for (const item of items) {
        if (item?.demo === true) {
          console.log(source, "demo item ignored");
          continue;
        }

        if (Array.isArray(item?.reviews)) {
          for (const nested of item.reviews) {
            const normalized = normalizeReview(nested, source);
            if (normalized) reviews.push(normalized);
          }
        }

        if (Array.isArray(item?.reviewsList)) {
          for (const nested of item.reviewsList) {
            const normalized = normalizeReview(nested, source);
            if (normalized) reviews.push(normalized);
          }
        }

        if (Array.isArray(item?.comments)) {
          for (const nested of item.comments) {
            const normalized = normalizeReview(nested, source);
            if (normalized) reviews.push(normalized);
          }
        }

        const flat = normalizeReview(item, source);
        if (flat) reviews.push(flat);
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

      console.log(source, "run status:", status);

      if (status === "SUCCEEDED") {
        const datasetId = runData?.data?.defaultDatasetId;
        const reviews = await fetchReviewsFromDataset(datasetId, source);
        return { status: "done", reviews };
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        console.log(source, "run ended without success:", status);
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

      const allReviewsBeforeFilter = dedupeReviews([
        ...gResult.reviews,
        ...yResult.reviews,
        ...tResult.reviews
      ]);

      const allReviews = filterReviewsByMonths(allReviewsBeforeFilter, selectedMonthsFilter);

      if (allReviews.length === 0) {
        return res.status(404).json({
          error:
            "No reviews found for the selected time filter. Try All Reviews or a larger time range."
        });
      }

      return res.status(200).json({
        status: "done",
        reviews: allReviews,
        total: allReviews.length,
        totalBeforeFilter: allReviewsBeforeFilter.length,
        monthsFilter: selectedMonthsFilter,
        sources: {
          google: gResult.reviews.length,
          yelp: yResult.reviews.length,
          tripadvisor: tResult.reviews.length
        }
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
        console.log("Method 0 direct place_id:", placeId);
      }

      if (!placeId) {
        const chMatch = placeUrl.match(/ChI[a-zA-Z0-9_-]+/);
        if (chMatch) {
          placeId = chMatch[0];
          console.log("Method 1 ChI found:", placeId);
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
          console.log("Method 2 nearby exact found:", placeId, best.name);
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
          console.log("Method 3 nearby found:", placeId, best.name);
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
          console.log("Method 4 text exact found:", placeId, best.name);
        }
      }

      if (!placeId && requestedName) {
        const r = await fetch(
          "https://maps.googleapis.com/maps/api/place/textsearch/json?query=" +
            encodeURIComponent(requestedName + " " + (addressHint || "")) +
            "&key=" +
            GOOGLE_API_KEY
        );

        const d = await r.json();
        const best = chooseBestCandidate(d.results, false);

        if (best?.place_id) {
          placeId = best.place_id;
          console.log("Method 5 text found:", placeId, best.name);
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
      console.log("Google details failed:", detData);
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

    console.log("Restaurant found:", place.name, place.formatted_address);
    console.log("Selected months filter:", selectedMonthsFilter);
    console.log("Search query for TripAdvisor:", searchQuery);

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

    const gText = await gRes.text();
    let gData = {};
    try {
      gData = JSON.parse(gText);
    } catch {
      console.log("Google Apify non-json response:", gText);
    }

    if (!gRes.ok) {
      console.log("Google Apify API error:", gText);
    }

    let safeYelpRunId = null;

    try {
      if (yelpUrl && yelpUrl.trim()) {
        const cleanYelpUrl = yelpUrl.trim();
        console.log("Starting Yelp actor with direct URL:", cleanYelpUrl);

        const yelpInputs = [
          {
            directUrls: [cleanYelpUrl],
            scrapeReviews: true,
            maxReviewsPerBusiness: 50,
            reviewSortOrder: "date_desc",
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ["RESIDENTIAL"]
            }
          },
          {
            startUrls: [{ url: cleanYelpUrl }],
            maxItems: 50,
            scrapeReviews: true,
            sortBy: "date_desc",
            proxyConfiguration: {
              useApifyProxy: true,
              apifyProxyGroups: ["RESIDENTIAL"]
            }
          }
        ];

        const yRes = await fetch(
          "https://api.apify.com/v2/acts/agents~yelp-reviews/runs?token=" + APIFY_API_TOKEN,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(yelpInputs[0])
          }
        );

        const yText = await yRes.text();
        let yData = {};
        try {
          yData = JSON.parse(yText);
        } catch {
          console.log("Yelp non-json response:", yText);
        }

        if (!yRes.ok) {
          console.log("Yelp API error:", yText);
        } else {
          safeYelpRunId = yData?.data?.id || null;
          console.log("Yelp run started:", safeYelpRunId);
        }
      } else {
        console.log("No Yelp URL provided. Skipping Yelp.");
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

      const tText = await tRes.text();
      let tData = {};
      try {
        tData = JSON.parse(tText);
      } catch {
        console.log("TripAdvisor non-json response:", tText);
      }

      if (!tRes.ok) {
        console.log("TripAdvisor API error:", tText);
      } else {
        safeTripRunId = tData?.data?.id || null;
        console.log("TripAdvisor run started:", safeTripRunId);
      }
    } catch (err) {
      console.log("TripAdvisor failed:", err.message);
    }

    return res.status(200).json({
      status: "started",
      runId: gData?.data?.id || null,
      yelpRunId: safeYelpRunId,
      tripRunId: safeTripRunId,
      monthsFilter: selectedMonthsFilter,
      restaurant: {
        name: place.name,
        city,
        address: place.formatted_address,
        rating: place.rating,
        totalReviews: place.user_ratings_total,
        placeId,
        lat: place.geometry?.location?.lat || null,
        lng: place.geometry?.location?.lng || null
      }
    });
  } catch (err) {
    console.error("reviews.js error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

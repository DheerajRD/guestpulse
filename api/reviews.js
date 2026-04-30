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
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const isRecentReview = (dateValue) => {
      if (!dateValue) return true;
      const d = new Date(dateValue);
      if (isNaN(d.getTime())) return true;
      return d >= sixMonthsAgo;
    };

    const fetchReviews = async (datasetId, source) => {
      const itemsRes = await fetch(
        "https://api.apify.com/v2/datasets/" +
          datasetId +
          "/items?token=" +
          APIFY_API_TOKEN +
          "&limit=300"
      );

      const items = await itemsRes.json();
      const reviews = [];

      console.log(source, "dataset items count:", Array.isArray(items) ? items.length : 0);

      if (Array.isArray(items) && items.length > 0) {
        console.log(source, "sample item:", JSON.stringify(items[0]).slice(0, 900));
      }

      if (!Array.isArray(items)) return [];

      if (source === "yelp") {
        for (const item of items) {
          if (item?.demo === true) {
            console.warn("Yelp returned demo data. Ignoring.");
            continue;
          }

          const text = item.reviewText || item.text || item.description || "";
          const rating = item.reviewRating || item.rating || item.stars || 0;
          const author = item.reviewerName || item.authorName || item.name || "Anonymous";
          const time = item.reviewDate || item.date || item.localizedDate || "";

          if (!text || String(text).trim().length < 5) continue;
          if (!isRecentReview(time)) continue;

          reviews.push({
            source: "yelp",
            author,
            rating,
            text: String(text).trim(),
            time,
          });
        }

        return reviews;
      }

      const getText = (obj) =>
        obj?.text ||
        obj?.reviewText ||
        obj?.description ||
        obj?.comment ||
        obj?.content ||
        obj?.reviewBody ||
        obj?.review ||
        "";

      const getAuthor = (obj) =>
        obj?.name ||
        obj?.reviewerName ||
        obj?.author ||
        obj?.userName ||
        obj?.username ||
        "Anonymous";

      const getRating = (obj) =>
        obj?.stars ||
        obj?.rating ||
        obj?.score ||
        0;

      const getTime = (obj) =>
        obj?.publishedAtDate ||
        obj?.localizedDate ||
        obj?.date ||
        obj?.publishedDate ||
        obj?.reviewDate ||
        obj?.time ||
        "";

      for (const item of items) {
        const nestedReviews = item.reviews || [];

        for (const r of nestedReviews) {
          const text = getText(r);
          if (text && text.trim().length > 10) {
            reviews.push({
              source,
              author: getAuthor(r),
              rating: getRating(r),
              text: text.trim(),
              time: getTime(r),
            });
          }
        }

        const flatText = getText(item);
        if (flatText && flatText.trim().length > 10) {
          reviews.push({
            source,
            author: getAuthor(item),
            rating: getRating(item),
            text: flatText.trim(),
            time: getTime(item),
          });
        }
      }

      return reviews;
    };

    const checkRun = async (id, source) => {
      if (!id) return { status: "done", reviews: [] };

      const r = await fetch(
        "https://api.apify.com/v2/actor-runs/" + id + "?token=" + APIFY_API_TOKEN
      );

      const d = await r.json();
      const status = d?.data?.status;

      console.log(source, "run status:", status, "run id:", id);

      if (status === "SUCCEEDED") {
        const datasetId = d?.data?.defaultDatasetId;
        if (!datasetId) return { status: "done", reviews: [] };

        const reviews = await fetchReviews(datasetId, source);
        return { status: "done", reviews };
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        console.log(source, "run ended without usable results:", status);
        return { status: "done", reviews: [] };
      }

      return { status: "running", reviews: [] };
    };

    if (action === "check") {
      const [gResult, yResult, tResult] = await Promise.all([
        checkRun(runId, "google"),
        checkRun(yelpRunId, "yelp"),
        checkRun(tripRunId, "tripadvisor"),
      ]);

      const allDone =
        gResult.status === "done" &&
        yResult.status === "done" &&
        tResult.status === "done";

      if (!allDone) {
        return res.status(200).json({ status: "running" });
      }

      const allReviews = [
        ...gResult.reviews,
        ...yResult.reviews,
        ...tResult.reviews,
      ];

      if (allReviews.length === 0) {
        return res.status(200).json({
          status: "done",
          reviews: [],
          total: 0,
          sources: {
            google: gResult.reviews.length,
            yelp: yResult.reviews.length,
            tripadvisor: tResult.reviews.length,
          },
          warning: "No reviews were returned from the provided source(s).",
        });
      }

      return res.status(200).json({
        status: "done",
        reviews: allReviews,
        total: allReviews.length,
        sources: {
          google: gResult.reviews.length,
          yelp: yResult.reviews.length,
          tripadvisor: tResult.reviews.length,
        },
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
          console.log("Method 2 nearby exact coords found:", placeId, best.name);
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
          console.log("Method 3 nearby coords found:", placeId, best.name);
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
          console.log("Method 4 text search exact bias found:", placeId, best.name);
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
          console.log("Method 5 plain text fallback found:", placeId, best.name);
        }
      }
    }

    if (!placeId && !yelpUrl) {
      return res.status(400).json({ error: "Please provide Google Maps URL or Yelp URL." });
    }

    let place = null;
    let city = "";
    let cleanUrl = null;
    let searchQuery = "";

    if (placeId) {
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

      place = detData.result;

      const addressParts = (place.formatted_address || "").split(",");
      city = addressParts.length > 1 ? addressParts[1].trim() : "";
      cleanUrl = "https://www.google.com/maps/place/?q=place_id:" + placeId;

      searchQuery = [
        place.name || "",
        place.formatted_address || "",
        city || "",
        addressHint || "",
      ]
        .join(" ")
        .trim();
    } else {
      const fallbackName = (() => {
        try {
          const u = new URL(yelpUrl);
          const slug = (u.pathname.split("/").pop() || "").replace(/-/g, " ").trim();
          return slug || "Yelp Business";
        } catch {
          return "Yelp Business";
        }
      })();

      place = {
        name: fallbackName,
        formatted_address: addressHint || "Yelp URL provided",
        rating: null,
        user_ratings_total: null,
      };

      city = "";
      cleanUrl = null;
      searchQuery = [fallbackName, addressHint || ""].join(" ").trim();
    }

    console.log("Search query:", searchQuery);

    let gData = null;

    if (cleanUrl) {
      const gRes = await fetch(
        "https://api.apify.com/v2/acts/Xb8osYTtOjlsgI6k9/runs?token=" + APIFY_API_TOKEN,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startUrls: [{ url: cleanUrl }],
            maxReviews: 150,
            reviewsSort: "newest",
            language: "en",
          }),
        }
      );

      gData = await gRes.json();
      console.log("Google runId:", gData?.data?.id || null);
    }

    let safeYelpRunId = null;

    try {
      if (yelpUrl && yelpUrl.trim()) {
        console.log("Starting Yelp actor:", yelpUrl.trim());

        const yRes = await fetch(
          "https://api.apify.com/v2/acts/tri_angle~yelp-review-scraper/runs?token=" +
            APIFY_API_TOKEN,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              maxReviewsPerUrl: 50,
              startUrls: [
                {
                  url: yelpUrl.trim(),
                },
              ],
            }),
          }
        );

        const yText = await yRes.text();
        console.log("Yelp raw start response:", yText.slice(0, 800));

        if (yRes.ok) {
          const yData = JSON.parse(yText);
          safeYelpRunId = yData?.data?.id || null;
        } else {
          console.log("Yelp API error:", yText);
        }
      } else {
        console.log("No Yelp URL provided. Skipping Yelp.");
      }
    } catch (err) {
      console.log("Yelp failed:", err.message);
    }

    console.log("Yelp runId:", safeYelpRunId);

    let safeTripRunId = null;

    if (cleanUrl) {
      try {
        const tRes = await fetch(
          "https://api.apify.com/v2/acts/maxcopell~tripadvisor-reviews/runs?token=" +
            APIFY_API_TOKEN,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              queries: [searchQuery],
              maxReviews: 50,
            }),
          }
        );

        if (tRes.ok) {
          const tData = await tRes.json();
          safeTripRunId = tData?.data?.id || null;
        } else {
          const errText = await tRes.text();
          console.log("TripAdvisor API error:", errText);
        }
      } catch (err) {
        console.log("TripAdvisor failed:", err.message);
      }
    }

    console.log("TripAdvisor runId:", safeTripRunId);

    return res.status(200).json({
      status: "started",
      runId: gData?.data?.id || null,
      yelpRunId: safeYelpRunId,
      tripRunId: cleanUrl ? safeTripRunId : null,
      restaurant: {
        name: place.name,
        city,
        address: place.formatted_address,
        rating: place.rating,
        totalReviews: place.user_ratings_total,
        placeId: placeId || null,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

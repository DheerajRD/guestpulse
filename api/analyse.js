module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reviews, restaurantName } = req.body || {};

  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return res.status(400).json({ error: 'No reviews provided' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing from environment variables' });
  }

  try {
    // --------------------------------------------
    // Normalize and count sources
    // --------------------------------------------
    const safeReviews = reviews
      .filter(r => r && typeof r === 'object' && typeof r.text === 'string' && r.text.trim().length > 0)
      .map(r => ({
        source: r.source || 'unknown',
        rating: typeof r.rating === 'number' ? r.rating : Number(r.rating) || 0,
        text: r.text.trim(),
        time: r.time || '',
        author: r.author || 'Anonymous'
      }));

    if (safeReviews.length === 0) {
      return res.status(400).json({ error: 'No usable reviews provided' });
    }

    const sourceCounts = safeReviews.reduce((acc, r) => {
      const key = r.source || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, { google: 0, yelp: 0, tripadvisor: 0, unknown: 0 });

    const sourcesUsed = {
      google: sourceCounts.google || 0,
      yelp: sourceCounts.yelp || 0,
      tripadvisor: sourceCounts.tripadvisor || 0
    };

    const sourceList = Object.entries(sourcesUsed)
      .filter(([, count]) => count > 0)
      .map(([name]) => name);

    const completeness =
      sourceList.length >= 3 ? 'full' :
      sourceList.length === 2 ? 'mostly_full' :
      sourceList.length === 1 ? 'partial' :
      'unknown';

    const confidence =
      safeReviews.length >= 80 ? 'high' :
      safeReviews.length >= 30 ? 'medium' :
      'low';

    // --------------------------------------------
    // Token-safe review selection
    // Keep prompt honest about what is actually analyzed
    // --------------------------------------------
    const MAX_REVIEWS_FOR_PROMPT = 120;

    // Prefer a balanced slice across sources when possible
    const bySource = {
      google: safeReviews.filter(r => r.source === 'google'),
      yelp: safeReviews.filter(r => r.source === 'yelp'),
      tripadvisor: safeReviews.filter(r => r.source === 'tripadvisor'),
      unknown: safeReviews.filter(r => !['google', 'yelp', 'tripadvisor'].includes(r.source))
    };

    const selected = [];
    const perSourceCap = Math.max(20, Math.floor(MAX_REVIEWS_FOR_PROMPT / 3));

    for (const key of ['google', 'yelp', 'tripadvisor']) {
      selected.push(...bySource[key].slice(0, perSourceCap));
    }

    if (selected.length < MAX_REVIEWS_FOR_PROMPT) {
      const leftovers = safeReviews.filter(r => !selected.includes(r));
      selected.push(...leftovers.slice(0, MAX_REVIEWS_FOR_PROMPT - selected.length));
    }

    const promptReviews = selected.slice(0, MAX_REVIEWS_FOR_PROMPT);

    const reviewText = promptReviews.map((r, i) => {
      return (
        (i + 1) +
        '. [' + (r.source || 'unknown').toUpperCase() + '] ' +
        r.rating + ' stars' +
        (r.time ? ' | ' + r.time : '') +
        ' | ' + r.text
      );
    }).join('\n');

    // --------------------------------------------
    // Prompt
    // --------------------------------------------
    const prompt =
      'You are a restaurant review analyst.\n\n' +
      'Restaurant: "' + (restaurantName || 'Unknown Restaurant') + '"\n' +
      'Total reviews received by backend: ' + safeReviews.length + '\n' +
      'Reviews actually provided for this analysis pass: ' + promptReviews.length + '\n' +
      'Source counts in full backend set: ' + JSON.stringify(sourcesUsed) + '\n' +
      'Completeness: ' + completeness + '\n' +
      'Confidence: ' + confidence + '\n\n' +

      'Important rules:\n' +
      '- Analyse ONLY the reviews provided below in this prompt.\n' +
      '- Do NOT claim to have analyzed more reviews than were provided in this prompt.\n' +
      '- Use source labels when useful, but keep conclusions unified.\n' +
      '- Find real complaints and praises from the actual review text.\n' +
      '- Identify real dish names mentioned by customers.\n' +
      '- If review volume is small or source coverage is partial, keep conclusions less certain.\n' +
      '- Return ONLY raw JSON. No markdown, no explanation, no backticks.\n\n' +

      'REVIEWS:\n' + reviewText + '\n\n' +

      'Return this exact JSON structure with real extracted values:\n' +
      '{"healthScore":75,"totalAnalysed":' + promptReviews.length + ',' +
      '"analysisMeta":{"totalInputReviews":' + safeReviews.length + ',"reviewsUsedForAnalysis":' + promptReviews.length + ',"sourcesUsed":{"google":' + (sourcesUsed.google || 0) + ',"yelp":' + (sourcesUsed.yelp || 0) + ',"tripadvisor":' + (sourcesUsed.tripadvisor || 0) + '},"completeness":"' + completeness + '","confidence":"' + confidence + '"},' +
      '"sentiment":{"positive":4,"neutral":1,"negative":1},' +
      '"topComplaints":[{"issue":"Slow service","count":2,"severity":"high","example":"waited 45 mins"}],' +
      '"topPraises":[{"aspect":"Biryani","count":5,"example":"best biryani in SA"}],' +
      '"bestDishes":["Chicken Biryani","Butter Naan","Irani Chai"],' +
      '"dishesToAvoid":["Desserts"],' +
      '"priceRange":{"avgMealForOne":"$15-20","avgMealForTwo":"$30-40","valueRating":4,"valueLabel":"Good"},' +
      '"bestTimeToVisit":"Weekday lunch for fastest service",' +
      '"accessibility":{"parking":{"available":true,"detail":"free lot"},"wheelchair":{"accessible":null,"detail":null},"kidsChairs":{"available":null,"detail":null},"wifi":{"available":null,"detail":null},"noiseLevel":"Moderate","restrooms":"Clean"},' +
      '"hygiene":{"score":8,"label":"Good","kitchen":"Clean","tables":"Clean","staff":"Professional","restrooms":"Clean","ownerAlert":null},' +
      '"forOwner":{"conclusion":"2 sentence summary of real strengths and weaknesses based on reviews","urgentAction":"single most important thing to fix right now","improvements":["specific action 1","specific action 2","specific action 3","specific action 4"]},' +
      '"forCustomer":{"conclusion":"honest 2 sentence summary to help customer decide","mustTry":"best dish name from reviews","avoid":"what to avoid based on reviews","verdict":"recommended"},' +
      '"fakeReviewCount":0,"fakeReviewReason":null}';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        error: 'Claude API failed: ' + response.status + ' - ' + responseText.substring(0, 300)
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      return res.status(500).json({
        error: 'Claude response not JSON: ' + responseText.substring(0, 200)
      });
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      return res.status(500).json({
        error: 'No content from Claude: ' + JSON.stringify(data).substring(0, 300)
      });
    }

    let raw = data.content[0].text;
    raw = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return res.status(500).json({
        error: 'No JSON in Claude response: ' + raw.substring(0, 200)
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(raw.substring(start, end + 1));
    } catch (e) {
      return res.status(500).json({
        error: 'Failed to parse Claude JSON: ' + e.message
      });
    }

    // --------------------------------------------
    // Fix missing fields
    // --------------------------------------------
    if (!analysis.healthScore) analysis.healthScore = 60;
    analysis.totalAnalysed = promptReviews.length;

    if (!analysis.analysisMeta || typeof analysis.analysisMeta !== 'object') {
      analysis.analysisMeta = {};
    }

    analysis.analysisMeta.totalInputReviews = safeReviews.length;
    analysis.analysisMeta.reviewsUsedForAnalysis = promptReviews.length;
    analysis.analysisMeta.sourcesUsed = sourcesUsed;
    analysis.analysisMeta.completeness = completeness;
    analysis.analysisMeta.confidence = confidence;

    if (!analysis.sentiment) analysis.sentiment = { positive: 0, neutral: 0, negative: 0 };
    if (!analysis.topComplaints) analysis.topComplaints = [];
    if (!analysis.topPraises) analysis.topPraises = [];
    if (!analysis.bestDishes) analysis.bestDishes = [];
    if (!analysis.dishesToAvoid) analysis.dishesToAvoid = [];
    if (!analysis.priceRange) {
      analysis.priceRange = {
        avgMealForOne: '—',
        avgMealForTwo: '—',
        valueRating: 3,
        valueLabel: 'Fair'
      };
    }
    if (!analysis.bestTimeToVisit) analysis.bestTimeToVisit = 'Weekday lunch';
    if (!analysis.forOwner) {
      analysis.forOwner = {
        conclusion: 'Mixed reviews.',
        urgentAction: 'Review customer feedback',
        improvements: ['Improve service', 'Maintain quality', 'Respond to reviews']
      };
    }
    if (!analysis.forCustomer) {
      analysis.forCustomer = {
        conclusion: 'Mixed experiences.',
        mustTry: 'Ask staff',
        avoid: 'Peak hours',
        verdict: 'mixed'
      };
    }
    if (!analysis.hygiene) {
      analysis.hygiene = {
        score: 7,
        label: 'Good',
        kitchen: 'Unknown',
        tables: 'Unknown',
        staff: 'Unknown',
        restrooms: 'Unknown',
        ownerAlert: null
      };
    }
    if (!analysis.accessibility) {
      analysis.accessibility = {
        parking: { available: null, detail: null },
        wheelchair: { accessible: null, detail: null },
        kidsChairs: { available: null, detail: null },
        wifi: { available: null, detail: null },
        noiseLevel: null,
        restrooms: null
      };
    }
    if (!analysis.fakeReviewCount) analysis.fakeReviewCount = 0;
    if (analysis.fakeReviewReason === undefined) analysis.fakeReviewReason = null;

    return res.status(200).json({ analysis });

  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

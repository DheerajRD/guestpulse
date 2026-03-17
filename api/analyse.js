module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reviews, restaurantName } = req.body || {};
  if (!reviews?.length) return res.status(400).json({ error: 'No reviews provided' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const reviewText = reviews.map((r, i) =>
    `Review ${i+1} (${r.rating} stars) by ${r.author}: ${r.text}`
  ).join('\n\n');

  const prompt = `Analyse these ${reviews.length} Google reviews for the restaurant "${restaurantName}" and return a JSON object.

REVIEWS:
${reviewText}

Return ONLY this JSON with no extra text, no markdown, no backticks:
{
  "healthScore": <number 0-100 based on overall sentiment>,
  "totalAnalysed": ${reviews.length},
  "sentiment": {
    "positive": <count of positive reviews>,
    "neutral": <count of neutral reviews>,
    "negative": <count of negative reviews>
  },
  "topComplaints": [
    {"issue": "<main complaint>", "count": <number>, "severity": "high", "example": "<short quote>"},
    {"issue": "<second complaint>", "count": <number>, "severity": "medium", "example": "<short quote>"}
  ],
  "topPraises": [
    {"aspect": "<what customers loved>", "count": <number>, "example": "<short quote>"},
    {"aspect": "<second praise>", "count": <number>, "example": "<short quote>"}
  ],
  "bestDishes": ["<dish mentioned positively>", "<second dish>", "<third dish>"],
  "dishesToAvoid": ["<dish with complaints>"],
  "priceRange": {
    "avgMealForOne": "<estimated price range>",
    "avgMealForTwo": "<estimated price range>",
    "valueRating": <1-5>,
    "valueLabel": "<Excellent or Good or Fair or Poor>"
  },
  "bestTimeToVisit": "<recommendation based on reviews>",
  "accessibility": {
    "parking": {"available": <true or false or null>, "detail": "<detail or null>"},
    "wheelchair": {"accessible": <true or false or null>, "detail": "<detail or null>"},
    "kidsChairs": {"available": <true or false or null>, "detail": "<detail or null>"},
    "wifi": {"available": <true or false or null>, "detail": "<detail or null>"},
    "noiseLevel": "<Quiet or Moderate or Loud or null>",
    "restrooms": "<Clean or Mixed or Poor or null>"
  },
  "hygiene": {
    "score": <1-10>,
    "label": "<Excellent or Good or Fair or Poor>",
    "kitchen": "<Clean or Mixed or Poor or Unknown>",
    "tables": "<Clean or Mixed or Poor or Unknown>",
    "staff": "<Professional or Mixed or Poor or Unknown>",
    "restrooms": "<Clean or Mixed or Poor or Unknown>",
    "ownerAlert": "<specific issue or null>"
  },
  "forOwner": {
    "conclusion": "<2 sentence summary of main strengths and weaknesses>",
    "urgentAction": "<single most important thing to fix>",
    "improvements": [
      "<specific improvement 1>",
      "<specific improvement 2>",
      "<specific improvement 3>"
    ]
  },
  "forCustomer": {
    "conclusion": "<2 sentence honest summary to help customer decide>",
    "mustTry": "<best dish or experience>",
    "avoid": "<what to avoid>",
    "verdict": "<recommended or mixed or avoid>"
  },
  "fakeReviewCount": 0,
  "fakeReviewReason": null
}`;

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      }),
    });

    const data = await apiRes.json();

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from Claude AI' });
    }

    let raw = data.content[0].text || '';
    console.log('Raw Claude response:', raw.substring(0, 200));

    // Strip any markdown
    raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

    // Extract JSON object
    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'Claude did not return valid JSON' });
    }
    raw = raw.substring(start, end + 1);

    const analysis = JSON.parse(raw);

    // Fix health score if 0
    if (!analysis.healthScore) {
      const pos = analysis.sentiment?.positive || 0;
      const tot = analysis.totalAnalysed || reviews.length;
      analysis.healthScore = Math.max(20, Math.round((pos / Math.max(tot, 1)) * 100));
    }

    // Fix missing fields
    if (!analysis.forCustomer) analysis.forCustomer = { conclusion: "Based on reviews, this restaurant has mixed feedback.", mustTry: "Ask staff for recommendations", avoid: "Visiting during peak hours", verdict: "mixed" };
    if (!analysis.forOwner) analysis.forOwner = { conclusion: "Reviews show mixed customer experiences.", urgentAction: "Review customer feedback carefully", improvements: ["Improve service speed", "Maintain food quality", "Respond to reviews"] };
    if (!analysis.bestDishes) analysis.bestDishes = [];
    if (!analysis.topComplaints) analysis.topComplaints = [];
    if (!analysis.topPraises) analysis.topPraises = [];
    if (!analysis.priceRange) analysis.priceRange = { avgMealForOne: "—", avgMealForTwo: "—", valueRating: 3, valueLabel: "Fair" };
    if (!analysis.hygiene) analysis.hygiene = { score: 7, label: "Good", kitchen: "Unknown", tables: "Unknown", staff: "Unknown", restrooms: "Unknown", ownerAlert: null };
    if (!analysis.accessibility) analysis.accessibility = { parking: { available: null, detail: null }, wheelchair: { accessible: null, detail: null }, kidsChairs: { available: null, detail: null }, wifi: { available: null, detail: null }, noiseLevel: null, restrooms: null };

    return res.status(200).json({ analysis });

  } catch (err) {
    console.error('analyse.js error:', err.message);
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
};

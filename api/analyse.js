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

  const reviewText = reviews.map(r => `[${r.rating}★] ${r.author}: "${r.text}"`).join('\n');

  const prompt = `You are an expert restaurant analyst. Analyse these ${reviews.length} reviews for "${restaurantName}" and respond ONLY with valid JSON — no markdown, no extra text.

Reviews:
${reviewText}

Respond with exactly this JSON:
{
  "healthScore": <0-100>,
  "totalAnalysed": <number>,
  "sentiment": { "positive": <n>, "neutral": <n>, "negative": <n> },
  "topComplaints": [
    { "issue": "<name>", "count": <n>, "severity": "high|medium|low", "example": "<short quote>" },
    { "issue": "<name>", "count": <n>, "severity": "high|medium|low", "example": "<short quote>" },
    { "issue": "<name>", "count": <n>, "severity": "high|medium|low", "example": "<short quote>" }
  ],
  "topPraises": [
    { "aspect": "<name>", "count": <n>, "example": "<short quote>" },
    { "aspect": "<name>", "count": <n>, "example": "<short quote>" },
    { "aspect": "<name>", "count": <n>, "example": "<short quote>" }
  ],
  "bestDishes": ["<dish 1>", "<dish 2>", "<dish 3>"],
  "dishesToAvoid": ["<dish 1>", "<dish 2>"],
  "priceRange": {
    "avgMealForOne": "<e.g. $10-15>",
    "avgMealForTwo": "<e.g. $20-30>",
    "valueRating": <1-5>,
    "valueLabel": "Excellent|Good|Fair|Poor"
  },
  "bestTimeToVisit": "<short recommendation>",
  "accessibility": {
    "parking": { "available": true|false|null, "detail": "<detail or null>" },
    "wheelchair": { "accessible": true|false|null, "detail": "<detail or null>" },
    "kidsChairs": { "available": true|false|null, "detail": "<detail or null>" },
    "wifi": { "available": true|false|null, "detail": "<detail or null>" },
    "noiseLevel": "<Quiet|Moderate|Loud|null>",
    "restrooms": "<Clean|Mixed|Poor|null>"
  },
  "hygiene": {
    "score": <0-10>,
    "label": "Excellent|Good|Fair|Poor",
    "kitchen": "<Clean|Mixed|Poor|Unknown>",
    "tables": "<Clean|Mixed|Poor|Unknown>",
    "staff": "<Professional|Mixed|Poor|Unknown>",
    "restrooms": "<Clean|Mixed|Poor|Unknown>",
    "ownerAlert": "<issue to fix or null>"
  },
  "forOwner": {
    "conclusion": "<2-3 sentence summary>",
    "urgentAction": "<single most important fix>",
    "improvements": ["<action 1>", "<action 2>", "<action 3>", "<action 4>"]
  },
  "forCustomer": {
    "conclusion": "<2-3 sentence summary>",
    "mustTry": "<best dish with price if known>",
    "avoid": "<what to avoid>",
    "verdict": "recommended|mixed|avoid"
  },
  "fakeReviewCount": <n>,
  "fakeReviewReason": "<reason or null>"
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
    const raw = data.content?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);
    return res.status(200).json({ analysis });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
};

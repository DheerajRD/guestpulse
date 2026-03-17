module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reviews, restaurantName } = req.body || {};
  if (!reviews || reviews.length === 0) return res.status(400).json({ error: 'No reviews provided' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const total = reviews.length;
    const reviewText = reviews.map((r, i) =>
      (i+1) + '. [' + r.rating + ' stars] ' + r.author + ': ' + r.text
    ).join('\n\n');

    const prompt = 'Analyse these ' + total + ' Google reviews for "' + restaurantName + '". Return ONLY a JSON object with no extra text.\n\n'
      + 'REVIEWS:\n' + reviewText + '\n\n'
      + 'Return this exact JSON structure filled with real data from the reviews:\n'
      + '{\n'
      + '  "healthScore": 75,\n'
      + '  "totalAnalysed": ' + total + ',\n'
      + '  "sentiment": {"positive": 3, "neutral": 1, "negative": 1},\n'
      + '  "topComplaints": [{"issue": "Slow service", "count": 2, "severity": "high", "example": "waited too long"}],\n'
      + '  "topPraises": [{"aspect": "Great biryani", "count": 3, "example": "best biryani in town"}],\n'
      + '  "bestDishes": ["Biryani", "Butter Chicken", "Naan"],\n'
      + '  "dishesToAvoid": ["Desserts"],\n'
      + '  "priceRange": {"avgMealForOne": "$12-18", "avgMealForTwo": "$25-35", "valueRating": 4, "valueLabel": "Good"},\n'
      + '  "bestTimeToVisit": "Weekday lunch for best service",\n'
      + '  "accessibility": {"parking": {"available": true, "detail": "free lot"}, "wheelchair": {"accessible": true, "detail": "ramp available"}, "kidsChairs": {"available": true, "detail": "high chairs"}, "wifi": {"available": null, "detail": null}, "noiseLevel": "Moderate", "restrooms": "Clean"},\n'
      + '  "hygiene": {"score": 8, "label": "Good", "kitchen": "Clean", "tables": "Clean", "staff": "Professional", "restrooms": "Clean", "ownerAlert": null},\n'
      + '  "forOwner": {"conclusion": "Your food is praised but service needs work.", "urgentAction": "Improve service speed during peak hours", "improvements": ["Train staff on speed", "Maintain food temperature", "Respond to all reviews", "Add more weekend staff"]},\n'
      + '  "forCustomer": {"conclusion": "Good food with some service issues worth visiting for the biryani.", "mustTry": "Biryani", "avoid": "Dinner rush hours", "verdict": "recommended"},\n'
      + '  "fakeReviewCount": 0,\n'
      + '  "fakeReviewReason": null\n'
      + '}\n\n'
      + 'Important: Use ONLY real data from the reviews above. Replace all example values with actual analysis of ' + restaurantName + '.';

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
      })
    });

    const data = await apiRes.json();

    if (!data.content || !data.content[0] || !data.content[0].text) {
  return res.status(500).json({ 
    error: 'Claude API error: ' + JSON.stringify(data).substring(0, 200)
  });
}

    let raw = data.content[0].text;

    // Clean any markdown
    raw = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();

    // Extract JSON
    const startIdx = raw.indexOf('{');
    const endIdx   = raw.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'Claude did not return valid JSON: ' + raw.substring(0, 200) });
    }

    const jsonStr  = raw.substring(startIdx, endIdx + 1);
    const analysis = JSON.parse(jsonStr);

    // Fix missing fields
    if (!analysis.healthScore || analysis.healthScore === 0) analysis.healthScore = 50;
    analysis.totalAnalysed = total;
    if (!analysis.sentiment) analysis.sentiment = { positive: 0, neutral: 0, negative: 0 };
    if (!analysis.topComplaints) analysis.topComplaints = [];
    if (!analysis.topPraises) analysis.topPraises = [];
    if (!analysis.bestDishes) analysis.bestDishes = [];
    if (!analysis.dishesToAvoid) analysis.dishesToAvoid = [];
    if (!analysis.priceRange) analysis.priceRange = { avgMealForOne: '—', avgMealForTwo: '—', valueRating: 3, valueLabel: 'Fair' };
    if (!analysis.bestTimeToVisit) analysis.bestTimeToVisit = 'Weekday lunch for best experience';
    if (!analysis.forOwner) analysis.forOwner = { conclusion: 'Mixed reviews detected.', urgentAction: 'Review customer feedback', improvements: ['Improve service', 'Maintain quality', 'Respond to reviews'] };
    if (!analysis.forCustomer) analysis.forCustomer = { conclusion: 'Mixed customer experiences.', mustTry: 'Ask staff for specials', avoid: 'Peak hours', verdict: 'mixed' };
    if (!analysis.hygiene) analysis.hygiene = { score: 7, label: 'Good', kitchen: 'Unknown', tables: 'Unknown', staff: 'Unknown', restrooms: 'Unknown', ownerAlert: null };
    if (!analysis.accessibility) analysis.accessibility = { parking: { available: null, detail: null }, wheelchair: { accessible: null, detail: null }, kidsChairs: { available: null, detail: null }, wifi: { available: null, detail: null }, noiseLevel: null, restrooms: null };
    if (!analysis.fakeReviewCount) analysis.fakeReviewCount = 0;

    return res.status(200).json({ analysis });

  } catch (err) {
    console.error('analyse error:', err.message);
    return res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
};

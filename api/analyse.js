module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { reviews, restaurantName } = req.body || {};
  if (!reviews || reviews.length === 0) {
    return res.status(400).json({ error: 'No reviews provided' });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY missing from environment variables' });
  }

  try {
    const reviewText = reviews.slice(0, 5).map((r, i) =>
      (i+1) + '. ' + r.rating + ' stars - ' + r.text
    ).join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: 'Analyse these reviews for "' + restaurantName + '" and return ONLY JSON:\n\n' + reviewText + '\n\nReturn this JSON:\n{"healthScore":75,"totalAnalysed":' + reviews.length + ',"sentiment":{"positive":3,"neutral":1,"negative":1},"topComplaints":[{"issue":"example","count":1,"severity":"medium","example":"quote"}],"topPraises":[{"aspect":"example","count":2,"example":"quote"}],"bestDishes":["dish1","dish2"],"dishesToAvoid":["dish"],"priceRange":{"avgMealForOne":"$15","avgMealForTwo":"$30","valueRating":4,"valueLabel":"Good"},"bestTimeToVisit":"Weekday lunch","accessibility":{"parking":{"available":null,"detail":null},"wheelchair":{"accessible":null,"detail":null},"kidsChairs":{"available":null,"detail":null},"wifi":{"available":null,"detail":null},"noiseLevel":null,"restrooms":null},"hygiene":{"score":8,"label":"Good","kitchen":"Clean","tables":"Clean","staff":"Professional","restrooms":"Clean","ownerAlert":null},"forOwner":{"conclusion":"summary here","urgentAction":"main action","improvements":["action1","action2","action3"]},"forCustomer":{"conclusion":"summary here","mustTry":"best dish","avoid":"what to avoid","verdict":"recommended"},"fakeReviewCount":0,"fakeReviewReason":null}'
        }]
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
    } catch(e) {
      return res.status(500).json({ error: 'Claude response not JSON: ' + responseText.substring(0, 200) });
    }

    if (!data.content || !data.content[0] || !data.content[0].text) {
      return res.status(500).json({ 
        error: 'No content from Claude: ' + JSON.stringify(data).substring(0, 300)
      });
    }

    let raw = data.content[0].text;
    raw = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();

    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');

    if (start === -1 || end === -1) {
      return res.status(500).json({ error: 'No JSON in Claude response: ' + raw.substring(0, 200) });
    }

    let analysis;
    try {
      analysis = JSON.parse(raw.substring(start, end + 1));
    } catch(e) {
      return res.status(500).json({ error: 'Failed to parse Claude JSON: ' + e.message });
    }

    if (!analysis.healthScore) analysis.healthScore = 60;
    analysis.totalAnalysed = reviews.length;
    if (!analysis.sentiment) analysis.sentiment = { positive: 0, neutral: 0, negative: 0 };
    if (!analysis.topComplaints) analysis.topComplaints = [];
    if (!analysis.topPraises) analysis.topPraises = [];
    if (!analysis.bestDishes) analysis.bestDishes = [];
    if (!analysis.dishesToAvoid) analysis.dishesToAvoid = [];
    if (!analysis.priceRange) analysis.priceRange = { avgMealForOne: '—', avgMealForTwo: '—', valueRating: 3, valueLabel: 'Fair' };
    if (!analysis.bestTimeToVisit) analysis.bestTimeToVisit = 'Weekday lunch';
    if (!analysis.forOwner) analysis.forOwner = { conclusion: 'Mixed reviews.', urgentAction: 'Review customer feedback', improvements: ['Improve service', 'Maintain quality', 'Respond to reviews'] };
    if (!analysis.forCustomer) analysis.forCustomer = { conclusion: 'Mixed experiences.', mustTry: 'Ask staff', avoid: 'Peak hours', verdict: 'mixed' };
    if (!analysis.hygiene) analysis.hygiene = { score: 7, label: 'Good', kitchen: 'Unknown', tables: 'Unknown', staff: 'Unknown', restrooms: 'Unknown', ownerAlert: null };
    if (!analysis.accessibility) analysis.accessibility = { parking: { available: null, detail: null }, wheelchair: { accessible: null, detail: null }, kidsChairs: { available: null, detail: null }, wifi: { available: null, detail: null }, noiseLevel: null, restrooms: null };
    if (!analysis.fakeReviewCount) analysis.fakeReviewCount = 0;

    return res.status(200).json({ analysis });

  } catch(err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

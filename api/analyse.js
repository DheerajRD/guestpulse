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

  const reviewText = reviews.map(function(r) {
    return '[' + r.rating + 'star] ' + r.author + ': "' + r.text + '"';
  }).join('\n');

  const prompt = 'You are a restaurant analyst. Analyse these ' + reviews.length + ' reviews for "' + restaurantName + '".\n\nREVIEWS:\n' + reviewText + '\n\nRespond with ONLY a JSON object. No markdown. No backticks. No extra text. Just pure JSON.\n\n{"healthScore":75,"totalAnalysed":' + reviews.length + ',"sentiment":{"positive":3,"neutral":1,"negative":1},"topComplaints":[{"issue":"Slow service","count":2,"severity":"medium","example":"waited too long"},{"issue":"Cold food","count":1,"severity":"low","example":"food was cold"}],"topPraises":[{"aspect":"Great biryani","count":3,"example":"best biryani in town"},{"aspect":"Friendly staff","count":2,"example":"very welcoming"}],"bestDishes":["Biryani","Butter Chicken","Naan"],"dishesToAvoid":["Desserts"],"priceRange":{"avgMealForOne":"$12-18","avgMealForTwo":"$25-35","valueRating":4,"valueLabel":"Good"},"bestTimeToVisit":"Weekday lunch for fastest service","accessibility":{"parking":{"available":true,"detail":"Free parking lot"},"wheelchair":{"accessible":true,"detail":"Ramp at entrance"},"kidsChairs":{"available":true,"detail":"High chairs available"},"wifi":{"available":null,"detail":null},"noiseLevel":"Moderate","restrooms":"Clean"},"hygiene":{"score":8,"label":"Good","kitchen":"Clean","tables":"Clean","staff":"Professional","restrooms":"Clean","ownerAlert":null},"forOwner":{"conclusion":"Your biryani is highly praised but service speed needs improvement. Focus on reducing wait times during peak hours.","urgentAction":"Train staff to improve service speed during dinner rush hours","improvements":["Speed up service during peak hours","Maintain food temperature standards","Add more staff on weekends","Respond to negative reviews promptly"]},"forCustomer":{"conclusion":"Good Indian restaurant with excellent biryani. Service can be slow during busy times but food quality is worth the wait.","mustTry":"Biryani - highly recommended by most customers","avoid":"Visiting during dinner rush without a reservation","verdict":"recommended"},"fakeReviewCount":0,"fakeReviewReason":null}\n\nNow analyse the actual reviews above and return real JSON in exactly the same format. Base everything on what the reviews actually say about ' + restaurantName + '.';

  try {
    var apiRes = await fetch('https://api.anthropic.com/v1/messages', {
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

    var data = await apiRes.json();

    if (!data.content || !data.content[0]) {
      return res.status(500).json({ error: 'No response from Claude AI' });
    }

    var raw = data.content[0].text || '{}';

    // Clean up any markdown formatting
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    // Find JSON object in response
    var startIdx = raw.indexOf('{');
    var endIdx   = raw.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      raw = raw.substring(startIdx, endIdx + 1);
    }

    var analysis = JSON.parse(raw);

    // Make sure healthScore is never 0
    if (!analysis.healthScore || analysis.healthScore === 0) {
      var pos = analysis.sentiment?.positive || 0;
      var tot = analysis.totalAnalysed || reviews.length;
      analysis.healthScore = Math.max(10, Math.round((pos / tot) * 100));
    }

    return res.status(200).json({ analysis: analysis });

  } catch (err) {
    console.error('analyse.js error:', err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
};

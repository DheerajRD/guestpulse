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
    const reviewText = reviews.slice(0, 60).map((r, i) =>
      (i+1) + '. ' + r.rating + ' stars - ' + r.text
    ).join('\n');

    const prompt = 'You are a restaurant analyst. Analyse ALL ' + reviews.length + ' reviews below for "' + restaurantName + '" and return ONLY a raw JSON object with no extra text, no markdown, no backticks.\n\n'
      + 'REVIEWS:\n' + reviewText + '\n\n'
      + 'Rules:\n'
      + '- Count sentiment from ALL reviews above\n'
      + '- Find real complaints and praises from the actual review text\n'
      + '- Identify real dish names mentioned by customers\n'
      + '- Base healthScore on overall sentiment percentage\n'
      + '- totalAnalysed must be ' + reviews.length + '\n\n'
      + 'Return this exact JSON structure with real data:\n'
      + '{"healthScore":75,"totalAnalysed":' + reviews.length + ',"sentiment":{"positive":4,"neutral":1,"negative":1},'
      + '"topComplaints":[{"issue":"Slow service","count":2,"severity":"high","example":"waited 45 mins"}],'
      + '"topPraises":[{"aspect":"Biryani","count":5,"example":"best biryani in SA"}],'
      + '"bestDishes":["Chicken Biryani","Butter Naan","Irani Chai"],'
      + '"dishesToAvoid":["Desserts"],'
      + '"priceRange":{"avgMealForOne":"$15-20","avgMealForTwo":"$30-40","valueRating":4,"valueLabel":"Good"},'
      + '"bestTimeToVisit":"Weekday lunch for fastest service",'
      + '"accessibility":{"parking":{"available":true,"detail":"free lot"},"wheelchair":{"accessible":null,"detail":null},"kidsChairs":{"available":null,"detail":null},"wifi":{"available":null,"detail":null},"noiseLevel":"Moderate","restrooms":"Clean"},'
      + '"hygiene":{"score":8,"label":"Good","kitchen":"Clean","tables":"Clean","staff":"Professional","restrooms":"Clean","ownerAlert":null},'
      + '"forOwner":{"conclusion":"2 sentence summary of real strengths and weaknesses based on reviews","urgentAction":"single most important thing to fix right now","improvements":["specific action 1","specific action 2","specific action 3","specific action 4"]},'
      + '"forCustomer":{"conclusion":"honest 2 sentence summary to help customer decide","mustTry":"best dish name from reviews","avoid":"what to avoid based on reviews","verdict":"recommended"},'
      + '"fakeReviewCount":0,"fakeReviewReason":null}';

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
        messages: [{
          role: 'user',
          content: prompt
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

    // Fix missing fields
    if (!analysis.healthScore)    analysis.healthScore    = 60;
    analysis.totalAnalysed        = reviews.length;
    if (!analysis.sentiment)      analysis.sentiment      = { positive:0, neutral:0, negative:0 };
    if (!analysis.topComplaints)  analysis.topComplaints  = [];
    if (!analysis.topPraises)     analysis.topPraises     = [];
    if (!analysis.bestDishes)     analysis.bestDishes     = [];
    if (!analysis.dishesToAvoid)  analysis.dishesToAvoid  = [];
    if (!analysis.priceRange)     analysis.priceRange     = { avgMealForOne:'—', avgMealForTwo:'—', valueRating:3, valueLabel:'Fair' };
    if (!analysis.bestTimeToVisit) analysis.bestTimeToVisit = 'Weekday lunch';
    if (!analysis.forOwner)       analysis.forOwner       = { conclusion:'Mixed reviews.', urgentAction:'Review customer feedback', improvements:['Improve service','Maintain quality','Respond to reviews'] };
    if (!analysis.forCustomer)    analysis.forCustomer    = { conclusion:'Mixed experiences.', mustTry:'Ask staff', avoid:'Peak hours', verdict:'mixed' };
    if (!analysis.hygiene)        analysis.hygiene        = { score:7, label:'Good', kitchen:'Unknown', tables:'Unknown', staff:'Unknown', restrooms:'Unknown', ownerAlert:null };
    if (!analysis.accessibility)  analysis.accessibility  = { parking:{available:null,detail:null}, wheelchair:{accessible:null,detail:null}, kidsChairs:{available:null,detail:null}, wifi:{available:null,detail:null}, noiseLevel:null, restrooms:null };
    if (!analysis.fakeReviewCount) analysis.fakeReviewCount = 0;

    return res.status(200).json({ analysis });

  } catch(err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

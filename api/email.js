module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, email, restaurantName, analysis, restaurant } = req.body || {};
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured. Get a free key at resend.com' });
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!analysis) return res.status(400).json({ error: 'Analysis data is required' });

  try {
    const healthColor = analysis.healthScore > 70 ? '#00e676' : analysis.healthScore > 40 ? '#448aff' : '#ff5252';
    const isAlert = type === 'alert';
    const name = restaurantName || restaurant?.name || 'Your Restaurant';
    const subject = isAlert
      ? '🚨 New negative review alert — ' + name
      : '📊 Weekly GuestPulse Report — ' + name;

    const complaintsHtml = (analysis.topComplaints || []).map(function(c) {
      var color = c.severity === 'high' ? '#ff5252' : c.severity === 'medium' ? '#448aff' : '#888';
      var bg = c.severity === 'high' ? 'rgba(255,82,82,0.15)' : c.severity === 'medium' ? 'rgba(68,138,255,0.15)' : 'rgba(232,234,246,0.1)';
      return '<tr><td style="padding:8px 12px;color:#e8eaf6;font-size:14px">' + c.issue + '</td><td style="padding:8px 12px;text-align:center"><span style="background:' + bg + ';color:' + color + ';padding:2px 8px;border-radius:100px;font-size:12px;font-weight:700">' + c.severity + '</span></td><td style="padding:8px 12px;text-align:right;color:#ff5252;font-weight:700;font-size:14px">' + c.count + ' mentions</td></tr>';
    }).join('');

    const improvementsHtml = (analysis.forOwner?.improvements || []).map(function(imp, i) {
      return '<div style="display:flex;gap:12px;background:rgba(255,255,255,0.03);border-radius:10px;padding:12px 14px;margin-bottom:8px;border:1px solid rgba(232,234,246,0.07)"><div style="width:22px;height:22px;min-width:22px;border-radius:50%;background:linear-gradient(135deg,#2979ff,#00e676);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#07090f;text-align:center;line-height:22px">' + (i+1) + '</div><p style="margin:0;font-size:13px;color:rgba(232,234,246,0.6);line-height:1.6">' + imp + '</p></div>';
    }).join('');

    const dishesHtml = (analysis.bestDishes || []).map(function(d, i) {
      var medals = ['🥇','🥈','🥉'];
      return '<span style="background:rgba(0,230,118,0.1);border:1px solid rgba(0,230,118,0.22);color:#00e676;padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;margin:3px;display:inline-block">' + (medals[i] || '✅') + ' ' + d + '</span>';
    }).join('');

    const emailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head><body style="margin:0;padding:0;background:#07090f;font-family:Segoe UI,Arial,sans-serif">'
      + '<div style="max-width:600px;margin:0 auto;padding:32px 20px">'

      + '<div style="text-align:center;margin-bottom:28px">'
      + '<div style="display:inline-block;background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-radius:14px;padding:12px 20px">'
      + '<span style="font-size:20px">💓</span>'
      + '<span style="font-size:18px;font-weight:800;color:#448aff;margin-left:8px">GuestPulse AI</span>'
      + '</div>'
      + '<p style="color:rgba(232,234,246,0.35);font-size:13px;margin:10px 0 0">' + (isAlert ? '🚨 Review Alert' : '📊 Weekly Report') + '</p>'
      + '</div>'

      + '<div style="background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-radius:16px;padding:20px;margin-bottom:16px">'
      + '<div style="display:flex;align-items:center;gap:14px">'
      + '<div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#2979ff,#00e676);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🍽️</div>'
      + '<div style="flex:1"><h2 style="margin:0 0 4px;color:#e8eaf6;font-size:18px;font-weight:800">' + name + '</h2>'
      + '<p style="margin:0;color:rgba(232,234,246,0.4);font-size:12px">' + (restaurant?.address || '') + '</p></div>'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:800;color:' + healthColor + '">' + analysis.healthScore + '</div>'
      + '<div style="font-size:10px;color:rgba(232,234,246,0.3)">Health %</div></div>'
      + '</div></div>'

      + (isAlert ? '<div style="background:rgba(255,82,82,0.08);border:1px solid rgba(255,82,82,0.25);border-radius:14px;padding:16px 20px;margin-bottom:16px">'
      + '<p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#ff5252;text-transform:uppercase;letter-spacing:0.5px">🚨 Action Required</p>'
      + '<p style="margin:0;font-size:14px;color:rgba(232,234,246,0.7);line-height:1.6">' + (analysis.forOwner?.urgentAction || 'A new negative review needs your attention.') + '</p>'
      + '</div>' : '')

      + '<div style="background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-radius:14px;padding:16px 20px;margin-bottom:16px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="font-size:12px;font-weight:700;color:rgba(232,234,246,0.3);text-transform:uppercase;letter-spacing:0.5px">Health Score</span>'
      + '<span style="font-size:20px;font-weight:800;color:' + healthColor + '">' + analysis.healthScore + '%</span>'
      + '</div>'
      + '<div style="background:rgba(232,234,246,0.06);border-radius:100px;height:8px;overflow:hidden">'
      + '<div style="height:100%;width:' + analysis.healthScore + '%;background:linear-gradient(90deg,#2979ff,#00e676);border-radius:100px"></div>'
      + '</div></div>'

      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">'
      + '<div style="background:#0d1117;border:1px solid rgba(0,230,118,0.2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#00e676">' + (analysis.sentiment?.positive || 0) + '</div><div style="font-size:11px;color:rgba(232,234,246,0.3);margin-top:3px">Positive</div></div>'
      + '<div style="background:#0d1117;border:1px solid rgba(68,138,255,0.2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#448aff">' + (analysis.sentiment?.neutral || 0) + '</div><div style="font-size:11px;color:rgba(232,234,246,0.3);margin-top:3px">Neutral</div></div>'
      + '<div style="background:#0d1117;border:1px solid rgba(255,82,82,0.2);border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#ff5252">' + (analysis.sentiment?.negative || 0) + '</div><div style="font-size:11px;color:rgba(232,234,246,0.3);margin-top:3px">Negative</div></div>'
      + '</div>'

      + '<div style="background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-left:3px solid #2979ff;border-radius:14px;padding:16px 20px;margin-bottom:16px">'
      + '<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#448aff;text-transform:uppercase;letter-spacing:0.5px">AI Conclusion</p>'
      + '<p style="margin:0;font-size:14px;color:rgba(232,234,246,0.6);line-height:1.7">' + (analysis.forOwner?.conclusion || '') + '</p>'
      + '</div>'

      + '<div style="background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-radius:14px;padding:16px 20px;margin-bottom:16px">'
      + '<p style="margin:0 0 14px;font-size:11px;font-weight:700;color:rgba(232,234,246,0.3);text-transform:uppercase;letter-spacing:0.5px">❌ Top Complaints</p>'
      + '<table style="width:100%;border-collapse:collapse">' + complaintsHtml + '</table>'
      + '</div>'

      + '<div style="background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-radius:14px;padding:16px 20px;margin-bottom:16px">'
      + '<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:rgba(232,234,246,0.3);text-transform:uppercase;letter-spacing:0.5px">💡 How to Improve</p>'
      + improvementsHtml
      + '</div>'

      + '<div style="background:#0d1117;border:1px solid rgba(232,234,246,0.07);border-radius:14px;padding:16px 20px;margin-bottom:24px">'
      + '<p style="margin:0 0 12px;font-size:11px;font-weight:700;color:rgba(232,234,246,0.3);text-transform:uppercase;letter-spacing:0.5px">🍽️ What Customers Love</p>'
      + '<div>' + dishesHtml + '</div>'
      + '</div>'

      + '<div style="text-align:center;padding-top:20px;border-top:1px solid rgba(232,234,246,0.06)">'
      + '<p style="color:rgba(232,234,246,0.2);font-size:12px;margin:0">Sent by GuestPulse AI · Restaurant Intelligence</p>'
      + '<p style="color:rgba(232,234,246,0.15);font-size:11px;margin:6px 0 0">You received this because you signed up for ' + (isAlert ? 'review alerts' : 'weekly reports') + ' on GuestPulse.</p>'
      + '</div>'
      + '</div></body></html>';

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'GuestPulse AI <onboarding@resend.dev>',
        to: [email],
        subject: subject,
        html: emailHtml,
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      return res.status(400).json({ error: emailData.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, message: 'Email sent successfully!' });

  } catch (err) {
    console.error('email.js error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }
};

import { useState } from "react";

export default function App() {
  const [url, setUrl]       = useState("");
  const [stage, setStage]   = useState("idle");
  const [data, setData]     = useState(null);
  const [error, setError]   = useState("");

  const run = async () => {
    if (!url.trim()) { setError("Paste a Google Maps URL"); return; }
    setError(""); setData(null); setStage("loading");
    try {
      const r1  = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeUrl: url.trim() })
      });
      const t1  = await r1.text();
      let d1;
      try { d1 = JSON.parse(t1); }
      catch(e) { throw new Error("Reviews API error: " + t1.substring(0, 100)); }
      if (!r1.ok) throw new Error(d1.error || "Reviews failed");

      const r2  = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: d1.reviews, restaurantName: d1.restaurant.name })
      });
      const t2  = await r2.text();
      let d2;
      try { d2 = JSON.parse(t2); }
      catch(e) { throw new Error("Analyse API error: " + t2.substring(0, 100)); }
      if (!r2.ok) throw new Error(d2.error || "Analysis failed");

      setData({ restaurant: d1.restaurant, analysis: d2.analysis || d2 });
      setStage("done");
    } catch(e) {
      setError(e.message);
      setStage("error");
    }
  };

  const a = data?.analysis;
  const r = data?.restaurant;

  return (
    <div style={{ minHeight:"100vh", background:"#07090f", color:"#e8eaf6",
      fontFamily:"'Segoe UI',sans-serif", padding:"32px 20px", maxWidth:700, margin:"0 auto" }}>

      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
        <div style={{ width:40, height:40, borderRadius:10,
          background:"linear-gradient(135deg,#2979ff,#00e676)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>💓</div>
        <h1 style={{ fontSize:24, fontWeight:800, margin:0,
          background:"linear-gradient(135deg,#448aff,#00e676)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
          GuestPulse AI
        </h1>
      </div>

      <div style={{ background:"#0d1117", border:"1px solid #1e2535", borderRadius:16, padding:20, marginBottom:20 }}>
        <p style={{ fontSize:11, color:"rgba(232,234,246,0.4)", textTransform:"uppercase",
          letterSpacing:"1px", marginBottom:10 }}>Paste Google Maps URL</p>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://maps.google.com/maps/place/..."
          style={{ width:"100%", padding:"12px 16px", borderRadius:10,
            border:"1px solid #1e2535", background:"#07090f", color:"#e8eaf6",
            fontSize:14, outline:"none", marginBottom:12, boxSizing:"border-box" }}/>
        <button onClick={run} disabled={stage==="loading"}
          style={{ width:"100%", padding:"13px", borderRadius:10,
            background: stage==="loading" ? "#1e2535" : "linear-gradient(135deg,#2979ff,#00e676)",
            border:"none", color: stage==="loading" ? "#555" : "#000",
            fontSize:14, fontWeight:800, cursor: stage==="loading" ? "not-allowed" : "pointer" }}>
          {stage==="loading" ? "⏳ Analysing... please wait 30s" : "🔍 Analyse Restaurant"}
        </button>
        {error && (
          <div style={{ marginTop:12, padding:"10px 14px", borderRadius:10,
            background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.3)",
            color:"#ff5252", fontSize:13 }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {stage==="loading" && (
        <div style={{ background:"#0d1117", border:"1px solid #1e2535", borderRadius:16,
          padding:32, textAlign:"center" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🤖</div>
          <p style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Claude AI is analysing reviews...</p>
          <p style={{ fontSize:13, color:"rgba(232,234,246,0.4)" }}>This takes 20–30 seconds. Please wait.</p>
        </div>
      )}

      {stage==="done" && a && r && (
        <div>
          <div style={{ background:"#0d1117", border:"1px solid #1e2535", borderRadius:16,
            padding:20, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
              <div style={{ width:48, height:48, borderRadius:12,
                background:"linear-gradient(135deg,#2979ff,#00e676)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🍽️</div>
              <div style={{ flex:1 }}>
                <h2 style={{ margin:"0 0 4px", fontSize:18 }}>{r.name}</h2>
                <p style={{ margin:0, fontSize:12, color:"rgba(232,234,246,0.4)" }}>{r.address}</p>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:28, fontWeight:800,
                  color: a.healthScore > 70 ? "#00e676" : a.healthScore > 40 ? "#448aff" : "#ff5252" }}>
                  {a.healthScore}%
                </div>
                <div style={{ fontSize:10, color:"rgba(232,234,246,0.3)" }}>Health</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ flex:1, background:"rgba(0,230,118,0.1)", border:"1px solid rgba(0,230,118,0.2)",
                borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"#00e676" }}>{a.sentiment?.positive||0}</div>
                <div style={{ fontSize:11, color:"rgba(232,234,246,0.4)" }}>Positive</div>
              </div>
              <div style={{ flex:1, background:"rgba(41,121,255,0.1)", border:"1px solid rgba(41,121,255,0.2)",
                borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"#448aff" }}>{a.sentiment?.neutral||0}</div>
                <div style={{ fontSize:11, color:"rgba(232,234,246,0.4)" }}>Neutral</div>
              </div>
              <div style={{ flex:1, background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.2)",
                borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"#ff5252" }}>{a.sentiment?.negative||0}</div>
                <div style={{ fontSize:11, color:"rgba(232,234,246,0.4)" }}>Negative</div>
              </div>
            </div>
          </div>

          <div style={{ background:"#0d1117", border:"1px solid #1e2535",
            borderLeft:"3px solid #2979ff", borderRadius:16, padding:20, marginBottom:16 }}>
            <p style={{ fontSize:11, color:"#448aff", textTransform:"uppercase",
              letterSpacing:"0.5px", marginBottom:8 }}>AI Conclusion for Owner</p>
            <p style={{ fontSize:14, color:"rgba(232,234,246,0.6)", lineHeight:1.7, marginBottom:12 }}>
              {a.forOwner?.conclusion}
            </p>
            <div style={{ background:"rgba(255,82,82,0.08)", border:"1px solid rgba(255,82,82,0.2)",
              borderRadius:10, padding:"10px 14px" }}>
              <p style={{ fontSize:10, color:"#ff5252", fontWeight:700,
                textTransform:"uppercase", marginBottom:4 }}>Urgent Action</p>
              <p style={{ fontSize:13, color:"rgba(232,234,246,0.6)", margin:0 }}>
                {a.forOwner?.urgentAction}
              </p>
            </div>
          </div>

          <div style={{ background:"#0d1117", border:"1px solid #1e2535", borderRadius:16, padding:20, marginBottom:16 }}>
            <p style={{ fontSize:11, color:"rgba(232,234,246,0.3)", textTransform:"uppercase",
              letterSpacing:"0.5px", marginBottom:12 }}>❌ Top Complaints</p>
            {(a.topComplaints||[]).map((c,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:12, color:"rgba(232,234,246,0.5)", width:120, flexShrink:0 }}>{c.issue}</span>
                <div style={{ flex:1, background:"rgba(255,82,82,0.1)", borderRadius:100, height:5 }}>
                  <div style={{ height:"100%", borderRadius:100, background:"#ff5252",
                    width: Math.min((c.count / Math.max(a.totalAnalysed||1, 1)) * 300, 100) + "%" }}/>
                </div>
                <span style={{ fontSize:12, color:"#ff5252", fontWeight:700 }}>{c.count}</span>
              </div>
            ))}
            {(a.topComplaints||[]).length === 0 &&
              <p style={{ color:"#00e676", fontSize:13 }}>No major complaints ✅</p>}
          </div>

          <div style={{ background:"#0d1117", border:"1px solid #1e2535", borderRadius:16, padding:20, marginBottom:16 }}>
            <p style={{ fontSize:11, color:"rgba(232,234,246,0.3)", textTransform:"uppercase",
              letterSpacing:"0.5px", marginBottom:12 }}>✅ Top Praises</p>
            {(a.topPraises||[]).map((p,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <span style={{ fontSize:12, color:"rgba(232,234,246,0.5)", width:120, flexShrink:0 }}>{p.aspect}</span>
                <div style={{ flex:1, background:"rgba(0,230,118,0.1)", borderRadius:100, height:5 }}>
                  <div style={{ height:"100%", borderRadius:100, background:"#00e676",
                    width: Math.min((p.count / Math.max(a.totalAnalysed||1, 1)) * 300, 100) + "%" }}/>
                </div>
                <span style={{ fontSize:12, color:"#00e676", fontWeight:700 }}>{p.count}</span>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ background:"rgba(0,230,118,0.08)", border:"1px solid rgba(0,230,118,0.2)",
              borderRadius:12, padding:14 }}>
              <p style={{ fontSize:10, color:"#00e676", textTransform:"uppercase",
                letterSpacing:"0.5px", marginBottom:6 }}>Must Try</p>
              <p style={{ fontSize:14, fontWeight:700, color:"#e8eaf6", margin:0 }}>
                {a.forCustomer?.mustTry||"—"}
              </p>
            </div>
            <div style={{ background:"rgba(255,82,82,0.08)", border:"1px solid rgba(255,82,82,0.2)",
              borderRadius:12, padding:14 }}>
              <p style={{ fontSize:10, color:"#ff5252", textTransform:"uppercase",
                letterSpacing:"0.5px", marginBottom:6 }}>Avoid</p>
              <p style={{ fontSize:14, fontWeight:700, color:"#e8eaf6", margin:0 }}>
                {a.forCustomer?.avoid||"—"}
              </p>
            </div>
            <div style={{ background:"rgba(41,121,255,0.08)", border:"1px solid rgba(41,121,255,0.2)",
              borderRadius:12, padding:14 }}>
              <p style={{ fontSize:10, color:"#448aff", textTransform:"uppercase",
                letterSpacing:"0.5px", marginBottom:6 }}>Best Time</p>
              <p style={{ fontSize:14, fontWeight:700, color:"#e8eaf6", margin:0 }}>
                {a.bestTimeToVisit||"—"}
              </p>
            </div>
            <div style={{ background:"rgba(0,230,118,0.08)", border:"1px solid rgba(0,230,118,0.2)",
              borderRadius:12, padding:14 }}>
              <p style={{ fontSize:10, color:"#00e676", textTransform:"uppercase",
                letterSpacing:"0.5px", marginBottom:6 }}>Best Dishes</p>
              <p style={{ fontSize:14, fontWeight:700, color:"#e8eaf6", margin:0 }}>
                {(a.bestDishes||[]).join(", ")||"—"}
              </p>
            </div>
          </div>

          <div style={{ background:"#0d1117", border:"1px solid #1e2535", borderRadius:16, padding:20 }}>
            <p style={{ fontSize:11, color:"rgba(232,234,246,0.3)", textTransform:"uppercase",
              letterSpacing:"0.5px", marginBottom:12 }}>💡 How to Improve</p>
            {(a.forOwner?.improvements||[]).map((imp,i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start",
                background:"#161b27", borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0,
                  background:"linear-gradient(135deg,#2979ff,#00e676)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:800, color:"#000" }}>{i+1}</div>
                <p style={{ fontSize:13, color:"rgba(232,234,246,0.6)", margin:0, lineHeight:1.6 }}>{imp}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

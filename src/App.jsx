import { useState } from "react";

export default function App() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const analyse = async () => {
    if (!url.trim()) { setError("Please enter a URL"); return; }
    setError(""); setResult(null); setStage("loading");
    try {
      const r1 = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeUrl: url.trim() })
      });
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || "Reviews failed");

      const r2 = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: d1.reviews, restaurantName: d1.restaurant.name })
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || "Analysis failed");

      setResult({ restaurant: d1.restaurant, analysis: d2.analysis });
      setStage("done");
    } catch(e) {
      setError(e.message);
      setStage("error");
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#07090f", color:"#e8eaf6", fontFamily:"sans-serif", padding:32 }}>
      <h1 style={{ color:"#00e676", marginBottom:24 }}>💓 GuestPulse AI</h1>

      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Paste Google Maps URL..."
        style={{ width:"100%", maxWidth:600, padding:"12px 16px", borderRadius:10, border:"1px solid #333", background:"#0d1117", color:"#fff", fontSize:14, marginBottom:12, display:"block" }}
      />

      <button
        onClick={analyse}
        disabled={stage === "loading"}
        style={{ background:"linear-gradient(135deg,#2979ff,#00e676)", border:"none", borderRadius:10, padding:"12px 28px", color:"#000", fontWeight:800, fontSize:14, cursor:"pointer" }}>
        {stage === "loading" ? "Analysing..." : "Analyse Restaurant"}
      </button>

      {error && <p style={{ color:"#ff5252", marginTop:16 }}>⚠️ {error}</p>}

      {result && (
        <div style={{ marginTop:24, background:"#0d1117", borderRadius:16, padding:24, border:"1px solid #1e2535" }}>
          <h2 style={{ color:"#00e676", marginBottom:8 }}>{result.restaurant.name}</h2>
          <p style={{ color:"#888", marginBottom:16 }}>{result.restaurant.address}</p>
          <p style={{ color:"#448aff", marginBottom:8 }}>⭐ {result.restaurant.rating} ({result.restaurant.totalReviews} reviews)</p>
          <p style={{ color:"#00e676", fontSize:24, fontWeight:800, marginBottom:16 }}>Health Score: {result.analysis?.healthScore}%</p>

          <div style={{ marginBottom:16 }}>
            <h3 style={{ color:"#fff", marginBottom:8 }}>AI Conclusion</h3>
            <p style={{ color:"#888", lineHeight:1.7 }}>{result.analysis?.forOwner?.conclusion}</p>
          </div>

          <div style={{ marginBottom:16 }}>
            <h3 style={{ color:"#ff5252", marginBottom:8 }}>🚨 Urgent Action</h3>
            <p style={{ color:"#888" }}>{result.analysis?.forOwner?.urgentAction}</p>
          </div>

          <div style={{ marginBottom:16 }}>
            <h3 style={{ color:"#fff", marginBottom:8 }}>🍽️ Best Dishes</h3>
            <p style={{ color:"#00e676" }}>{(result.analysis?.bestDishes||[]).join(", ")||"—"}</p>
          </div>

          <div style={{ marginBottom:16 }}>
            <h3 style={{ color:"#fff", marginBottom:8 }}>❌ Top Complaints</h3>
            {(result.analysis?.topComplaints||[]).map((c,i) => (
              <p key={i} style={{ color:"#ff5252", marginBottom:4 }}>• {c.issue} ({c.count} mentions)</p>
            ))}
          </div>

          <div style={{ marginBottom:16 }}>
            <h3 style={{ color:"#fff", marginBottom:8 }}>✅ Top Praises</h3>
            {(result.analysis?.topPraises||[]).map((p,i) => (
              <p key={i} style={{ color:"#00e676", marginBottom:4 }}>• {p.aspect} ({p.count} mentions)</p>
            ))}
          </div>

          <div>
            <h3 style={{ color:"#fff", marginBottom:8 }}>👥 For Customers</h3>
            <p style={{ color:"#448aff", marginBottom:4 }}>Must Try: {result.analysis?.forCustomer?.mustTry||"—"}</p>
            <p style={{ color:"#ff5252", marginBottom:4 }}>Avoid: {result.analysis?.forCustomer?.avoid||"—"}</p>
            <p style={{ color:"#888" }}>Best Time: {result.analysis?.bestTimeToVisit||"—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

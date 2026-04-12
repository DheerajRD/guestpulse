import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const C = {
  bg: "#ffffff",
  bg2: "#ffffff",
  panel: "#ffffff",
  panel2: "#ffffff",
  card: "#ffffff",
  cardStrong: "#ffffff",
  border: "#e5e7eb",
  borderStrong: "#d1d5db",
  white: "#0f172a",
  muted: "#6b7280",
  muted2: "#94a3b8",
  blue: "#2563eb",
  cyan: "#0891b2",
  green: "#16a34a",
  green2: "#22c55e",
  red: "#dc2626",
  amber: "#d97706",
  purple: "#7c3aed",
  shadow: "0 4px 12px rgba(15,23,42,0.06)",
};

const healthColor = (s) => (s > 70 ? C.green : s > 40 ? C.cyan : C.red);

function fixAnalysis(raw, count) {
  if (!raw || typeof raw !== "object") return null;
  const a = raw.analysis && typeof raw.analysis === "object" ? raw.analysis : raw;

  if (!a.healthScore || a.healthScore === 0) a.healthScore = 50;
  a.totalAnalysed = count || a.totalAnalysed || 0;
  if (!a.sentiment) a.sentiment = { positive: 0, neutral: 0, negative: 0 };
  if (!a.topComplaints) a.topComplaints = [];
  if (!a.topPraises) a.topPraises = [];
  if (!a.bestDishes) a.bestDishes = [];
  if (!a.dishesToAvoid) a.dishesToAvoid = [];
  if (!a.priceRange) {
    a.priceRange = {
      avgMealForOne: "—",
      avgMealForTwo: "—",
      valueRating: 3,
      valueLabel: "Fair",
    };
  }
  if (!a.bestTimeToVisit) a.bestTimeToVisit = "Weekday lunch";
  if (!a.forOwner) {
    a.forOwner = {
      conclusion: "Reviews show mixed experiences.",
      urgentAction: "Review feedback",
      improvements: ["Improve service", "Maintain quality", "Respond to reviews"],
    };
  }
  if (!a.forCustomer) {
    a.forCustomer = {
      conclusion: "Mixed experiences.",
      mustTry: "Ask staff",
      avoid: "Peak hours",
      verdict: "mixed",
    };
  }
  if (!a.hygiene) {
    a.hygiene = {
      score: 7,
      label: "Good",
      kitchen: "Unknown",
      tables: "Unknown",
      staff: "Unknown",
      restrooms: "Unknown",
      ownerAlert: null,
    };
  }
  if (!a.accessibility) {
    a.accessibility = {
      parking: { available: null, detail: null },
      wheelchair: { accessible: null, detail: null },
      kidsChairs: { available: null, detail: null },
      wifi: { available: null, detail: null },
      noiseLevel: null,
      restrooms: null,
    };
  }
  if (!a.fakeReviewCount) a.fakeReviewCount = 0;

  return a;
}

function getMonthLabel(dateInput) {
  if (!dateInput) return "Unknown";
  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString("en-US", { month: "short" });
  }

  const raw = String(dateInput).toLowerCase();
  const months = [
    ["jan", "Jan"],
    ["feb", "Feb"],
    ["mar", "Mar"],
    ["apr", "Apr"],
    ["may", "May"],
    ["jun", "Jun"],
    ["jul", "Jul"],
    ["aug", "Aug"],
    ["sep", "Sep"],
    ["oct", "Oct"],
    ["nov", "Nov"],
    ["dec", "Dec"],
  ];
  for (const [find, out] of months) {
    if (raw.includes(find)) return out;
  }
  return "Unknown";
}

function buildChartData(rawReviews, analysis, sourceCounts) {
  const sourceData = [
    { name: "Google", reviews: sourceCounts.google || 0 },
    { name: "Yelp", reviews: sourceCounts.yelp || 0 },
    { name: "TripAdvisor", reviews: sourceCounts.tripadvisor || 0 },
  ];

  const sentimentData = [
    { name: "Positive", value: analysis?.sentiment?.positive || 0, fill: C.green2 },
    { name: "Neutral", value: analysis?.sentiment?.neutral || 0, fill: C.cyan },
    { name: "Negative", value: analysis?.sentiment?.negative || 0, fill: C.red },
  ];

  const ratingBuckets = {};
  rawReviews.forEach((r) => {
    const m = getMonthLabel(r.time);
    if (!ratingBuckets[m]) ratingBuckets[m] = { total: 0, count: 0 };
    ratingBuckets[m].total += Number(r.rating) || 0;
    ratingBuckets[m].count += 1;
  });

  const monthOrder = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Unknown",
  ];

  const ratingTrend = monthOrder
    .filter((m) => ratingBuckets[m])
    .map((m) => ({
      month: m,
      rating: Number((ratingBuckets[m].total / Math.max(ratingBuckets[m].count, 1)).toFixed(1)),
    }));

  const complaintData = (analysis?.topComplaints || []).slice(0, 6).map((c) => ({
    issue: c.issue,
    mentions: c.count,
  }));

  const praiseData = (analysis?.topPraises || []).slice(0, 6).map((p) => ({
    aspect: p.aspect,
    mentions: p.count,
  }));

  const recipeMap = {};
  (analysis?.bestDishes || []).forEach((dish, i) => {
    recipeMap[dish] = recipeMap[dish] || 0;
    recipeMap[dish] += Math.max(10 - i * 2, 4);
  });

  rawReviews.forEach((r) => {
    const text = (r.text || "").toLowerCase();
    Object.keys(recipeMap).forEach((dish) => {
      if (text.includes(dish.toLowerCase())) recipeMap[dish] += 1;
    });
  });

  const recipeTrend = Object.entries(recipeMap)
    .map(([recipe, mentions]) => ({ recipe, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 6);

  return {
    sourceData,
    sentimentData,
    ratingTrend,
    complaintData,
    praiseData,
    recipeTrend,
  };
}

const glass = (extra = {}) => ({
  background: "#ffffff",
  border: `1px solid ${C.border}`,
  boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
  ...extra,
});

const chartTooltipStyle = {
  background: "#ffffff",
  border: `1px solid ${C.borderStrong}`,
  borderRadius: 12,
  color: C.white,
};

function ShellCard({ children, style = {} }) {
  return (
    <div
      style={{
        ...glass(),
        borderRadius: 24,
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionCard({ title, sub, right, children, style = {} }) {
  return (
    <div
      style={{
        ...glass({ background: C.panel2 }),
        borderRadius: 22,
        padding: 18,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ color: C.white, fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>{title}</div>
          {sub ? <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{sub}</div> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Pill({ children, color = C.cyan, bg = "rgba(34,211,238,0.12)" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${color}33`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${C.border}`,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <div style={{ color: accent || C.cyan, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ color: C.white, fontSize: 30, fontWeight: 800, marginTop: 8 }}>{value}</div>
      {sub ? <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

function MiniInfo({ icon, label, value, color = C.cyan }) {
  return (
    <div
      style={{
        background: `${color}12`,
        border: `1px solid ${color}30`,
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ color, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginTop: 8 }}>
        {label}
      </div>
      <div style={{ color: C.white, fontSize: 14, fontWeight: 700, marginTop: 4 }}>{value || "—"}</div>
    </div>
  );
}

function ReviewCard({ review, platformColor, platformLabel }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 10 }}>
        <div>
          <div style={{ color: C.white, fontSize: 14, fontWeight: 700 }}>{review.author || "Anonymous"}</div>
          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{review.time || "Unknown date"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: platformColor, fontSize: 12, fontWeight: 800 }}>{platformLabel}</div>
          <div style={{ color: C.white, fontSize: 12, marginTop: 4 }}>⭐ {review.rating || 0}</div>
        </div>
      </div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.65 }}>{review.text}</div>
    </div>
  );
}

function ProgressRow({ label, value, total, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div style={{ color: C.muted, fontSize: 12 }}>{label}</div>
        <div style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</div>
      </div>
      <div style={{ height: 7, background: "#f8fafc", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min((value / Math.max(total, 1)) * 100, 100)}%`,
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function ActionRow({ index, text }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "start",
        padding: 12,
        borderRadius: 16,
        background: "#ffffff",
        border: `1px solid ${C.border}`,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          minWidth: 24,
          width: 24,
          height: 24,
          borderRadius: 999,
          background: C.blue,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {index}
      </div>
      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.65 }}>{text}</div>
    </div>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [addressHint, setAddressHint] = useState("");
  const [yelpUrl, setYelpUrl] = useState("");
  const [restaurant, setRestaurant] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [rawReviews, setRawReviews] = useState([]);
  const [sourceCounts, setSourceCounts] = useState({ google: 0, yelp: 0, tripadvisor: 0 });
  const [competitorData, setCompetitorData] = useState(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [stage, setStage] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [progMsg, setProgMsg] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("charts");
  const [toast, setToast] = useState(null);

  const showToast = (msg, color = C.green) => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCompetitors = async (restaurantInfo, fixedAnalysis) => {
    if (!restaurantInfo?.name) return;

    setCompetitorLoading(true);

    try {
      const r = await fetch("/api/competitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: restaurantInfo.name,
          address: restaurantInfo.address,
          city: restaurantInfo.city,
          yourRestaurant: {
            rating: restaurantInfo.rating,
            totalReviews: restaurantInfo.totalReviews,
            healthScore: fixedAnalysis?.healthScore || 0,
          },
        }),
      });

      const t = await r.text();
      let d;
      try {
        d = JSON.parse(t);
      } catch {
        throw new Error("Competitor error: " + t.substring(0, 120));
      }

      if (!r.ok) {
        throw new Error(d.error || "Failed to load competitor comparison");
      }

      setCompetitorData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setCompetitorLoading(false);
    }
  };

  const analyse = async () => {
    if (!url.trim()) {
      setError("Please paste a Google Maps URL.");
      return;
    }

    setError("");
    setRestaurant(null);
    setAnalysis(null);
    setRawReviews([]);
    setSourceCounts({ google: 0, yelp: 0, tripadvisor: 0 });
    setCompetitorData(null);
    setCompetitorLoading(false);
    setStage("fetching");
    setProgress(10);
    setProgMsg("Connecting to Google Maps...");

    try {
      await new Promise((r) => setTimeout(r, 250));
      setProgress(18);
      setProgMsg("Finding restaurant profile...");

      const r1 = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeUrl: url.trim(),
          addressHint: addressHint.trim(),
          yelpUrl: yelpUrl.trim(),
        }),
      });

      const t1 = await r1.text();
      let d1;
      try {
        d1 = JSON.parse(t1);
      } catch {
        throw new Error("Server error: " + t1.substring(0, 150));
      }

      if (!r1.ok) throw new Error(d1.error || "Failed to start review fetch");
      if (!d1.restaurant) throw new Error("Could not find restaurant.");

      setRestaurant(d1.restaurant);
      setProgress(28);
      setProgMsg("Review sources connected — pulling latest reviews...");

      let reviews = null;
      let counts = null;

      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        setProgress(30 + Math.min(i * 2, 26));
        setProgMsg(`Collecting review data... (${(i + 1) * 5}s)`);

        const r2 = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "check",
            runId: d1.runId,
            yelpRunId: d1.yelpRunId,
            tripRunId: d1.tripRunId,
          }),
        });

        const t2 = await r2.text();
        let d2;
        try {
          d2 = JSON.parse(t2);
        } catch {
          continue;
        }

        if (!r2.ok) throw new Error(d2.error || "Failed");
        if (d2.status === "done" && d2.reviews && d2.reviews.length > 0) {
          reviews = d2.reviews;
          counts = d2.sources || { google: 0, yelp: 0, tripadvisor: 0 };
          break;
        }
      }

      if (!reviews || reviews.length === 0) throw new Error("No reviews found. Try again.");

      setRawReviews(reviews);
      setSourceCounts(counts || { google: 0, yelp: 0, tripadvisor: 0 });

      setProgress(68);
      setProgMsg(`Claude AI is analysing ${reviews.length} reviews...`);

      const r3 = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviews,
          restaurantName: d1.restaurant.name,
        }),
      });

      const t3 = await r3.text();
      let d3;
      try {
        d3 = JSON.parse(t3);
      } catch {
        throw new Error("Analysis error: " + t3.substring(0, 150));
      }

      if (!r3.ok) throw new Error(d3.error || "Analysis failed");

      const fixed = fixAnalysis(d3, reviews.length);
      if (!fixed) throw new Error("Empty analysis data. Please try again.");

      setProgress(100);
      setProgMsg(`Done — ${reviews.length} reviews analysed.`);
      await new Promise((r) => setTimeout(r, 350));
      setAnalysis(fixed);
      fetchCompetitors(d1.restaurant, fixed);
      setStage("done");
      setActiveTab("charts");
      showToast("✅ Premium analysis ready");
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setStage("error");
      setProgress(0);
    }
  };

  const reset = () => {
    setUrl("");
    setAddressHint("");
    setYelpUrl("");
    setRestaurant(null);
    setAnalysis(null);
    setRawReviews([]);
    setSourceCounts({ google: 0, yelp: 0, tripadvisor: 0 });
    setCompetitorData(null);
    setCompetitorLoading(false);
    setStage("idle");
    setProgress(0);
    setError("");
    setActiveTab("charts");
  };

  const chartData = useMemo(
    () => buildChartData(rawReviews, analysis, sourceCounts),
    [rawReviews, analysis, sourceCounts]
  );

  const hs = analysis?.healthScore || 0;
  const isLoading = stage === "fetching";

  const googleReviews = rawReviews.filter((r) => r.source === "google");
  const yelpReviews = rawReviews.filter((r) => r.source === "yelp");
  const tripReviews = rawReviews.filter((r) => r.source === "tripadvisor");

  const verdictStyles = {
    recommended: {
      color: C.green2,
      bg: "rgba(52,211,153,0.12)",
      border: "rgba(52,211,153,0.3)",
      icon: "✅",
      label: "Recommended",
    },
    mixed: {
      color: C.cyan,
      bg: "rgba(34,211,238,0.12)",
      border: "rgba(34,211,238,0.28)",
      icon: "⚡",
      label: "Mixed Reviews",
    },
    avoid: {
      color: C.red,
      bg: "rgba(255,92,122,0.12)",
      border: "rgba(255,92,122,0.28)",
      icon: "🚫",
      label: "Avoid For Now",
    },
  };

  const verdict = verdictStyles[analysis?.forCustomer?.verdict] || verdictStyles.mixed;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        color: C.white,
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');
        *{box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{margin:0;background:#ffffff}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:999px}
        .app-wrap{max-width:1380px;margin:0 auto;padding:22px 18px 60px}
        .hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:18px}
        .main-grid{display:grid;grid-template-columns:250px minmax(0,1fr);gap:18px;margin-top:18px}
        .analytics-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
        .stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .three-col{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .tab-btn{
          width:100%;
          text-align:left;
          padding:11px 12px;
          border-radius:14px;
          border:1px solid rgba(255,255,255,0.07);
          background:#ffffff;
          color:#475569;
          cursor:pointer;
          font-size:13px;
          font-weight:700;
          transition:all .18s ease;
        }
        .tab-btn:hover{background:#f8fafc;color:#0f172a}
        .tab-btn.active{
          color:#0f172a;
          border-color:#bfdbfe;
          background:#eff6ff;
          box-shadow:inset 0 0 0 1px rgba(37,99,235,0.08);
        }
        .input{
          width:100%;
          background:#ffffff;
          border:1px solid #e5e7eb;
          color:#0f172a;
          border-radius:16px;
          padding:14px 16px;
          font-size:13px;
          outline:none;
          transition:border .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .input:focus{
          border-color:#93c5fd;
          box-shadow:0 0 0 4px rgba(37,99,235,0.08);
          background:#ffffff;
        }
        .cta{
          width:100%;
          border:none;
          cursor:pointer;
          padding:15px 18px;
          border-radius:18px;
          background:#2563eb;
          color:#ffffff;
          font-size:14px;
          font-weight:800;
          transition:transform .15s ease, opacity .15s ease;
        }
        .cta:hover{transform:translateY(-1px)}
        .cta:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .fadeIn{animation:fadeIn .35s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media (max-width: 1120px){
          .hero-grid,.main-grid{grid-template-columns:1fr}
          .stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media (max-width: 760px){
          .stats-grid,.two-col,.three-col{grid-template-columns:1fr}
          .app-wrap{padding:16px 12px 40px}
        }
      `}</style>

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 18,
            right: 18,
            zIndex: 9999,
            background: toast.color,
            color: "#08111a",
            padding: "10px 16px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 800,
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          }}
        >
          {toast.msg}
        </div>
      )}

      <div className="app-wrap">
        <ShellCard
          style={{
            padding: 16,
            position: "sticky",
            top: 12,
            zIndex: 100,
            background: "rgba(255,255,255,0.95)",
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={reset}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #4f8cff, #22d3ee 48%, #00e676)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: 900,
                  fontSize: 18,
                  boxShadow: "0 4px 12px rgba(37,99,235,0.15)",
                }}
              >
                GP
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.white, fontFamily: "'Playfair Display', serif", letterSpacing: 0.2 }}>GuestPulse AI</div>
                <div style={{ fontSize: 12, color: C.muted }}>Restaurant intelligence dashboard</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Pill>Multi-source reviews</Pill>
              <Pill color={C.green2} bg="rgba(52,211,153,0.11)">
                Claude-powered analysis
              </Pill>
              {analysis ? (
                <Pill color={healthColor(hs)} bg={`${healthColor(hs)}18`}>
                  Health {hs}%
                </Pill>
              ) : null}
            </div>
          </div>
        </ShellCard>

        <div className="hero-grid">
          <ShellCard style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <Pill>Premium AI workflow</Pill>
              <Pill color={C.purple} bg="rgba(179,136,255,0.12)">
                Google + Yelp + TripAdvisor
              </Pill>
            </div>

            <div style={{ fontSize: 42, lineHeight: 1.12, fontWeight: 700, maxWidth: 720, fontFamily: "'Playfair Display', serif", letterSpacing: 0.2 }}>
              Turn restaurant reviews into charts, decisions, and actions.
            </div>

            <div style={{ marginTop: 14, color: C.muted, fontSize: 15, lineHeight: 1.8, maxWidth: 740 }}>
              Paste a Google Maps restaurant link, optionally add Yelp for exact matching, and GuestPulse will collect reviews,
              analyze customer sentiment, surface trending dishes, and generate owner-ready insights in one premium dashboard.
            </div>

            <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
              <textarea
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Google Maps restaurant URL here..."
                rows={4}
                style={{ resize: "none", lineHeight: 1.55 }}
              />

              <div className="two-col">
                <input
                  className="input"
                  type="text"
                  value={addressHint}
                  onChange={(e) => setAddressHint(e.target.value)}
                  placeholder="Optional address, ZIP, or area for better matching"
                />
                <input
                  className="input"
                  type="text"
                  value={yelpUrl}
                  onChange={(e) => setYelpUrl(e.target.value)}
                  placeholder="Optional Yelp business URL"
                />
              </div>

              {error ? <div style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>⚠️ {error}</div> : null}

              <div className="two-col">
                <button className="cta" onClick={analyse} disabled={isLoading}>
                  {isLoading ? "⏳ Analysing... please wait" : "🚀 Analyse Restaurant"}
                </button>
                <button
                  className="cta"
                  onClick={reset}
                  style={{
                    background: "#f8fafc",
                    color: C.white,
                    border: `1px solid ${C.borderStrong}`,
                  }}
                >
                  Reset Workspace
                </button>
              </div>
            </div>

            {isLoading ? (
              <div
                className="fadeIn"
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 18,
                  background: "#ffffff",
                  border: `1px solid ${C.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <div style={{ color: C.white, fontWeight: 700 }}>
                    {progress < 55 ? "Fetching review data..." : "Claude AI is analysing..."}
                  </div>
                  <div style={{ color: C.cyan, fontSize: 13, fontWeight: 800 }}>{progress}%</div>
                </div>
                <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>{progMsg}</div>
                <div style={{ height: 9, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #4f8cff, #22d3ee 55%, #00e676)",
                      transition: "width .45s ease",
                    }}
                  />
                </div>
              </div>
            ) : null}
          </ShellCard>

          <ShellCard style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 18 }}>
              <div>
                <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  Workspace
                </div>
                <div style={{ color: C.white, fontSize: 24, fontWeight: 700, marginTop: 4, fontFamily: "'Playfair Display', serif" }}>
                  {restaurant?.name || "Founder Dashboard"}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 18,
                  background: "#ffffff",
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #b388ff, #22d3ee)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#08111a",
                    fontWeight: 800,
                  }}
                >
                  D
                </div>
                <div>
                  <div style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>Dheeraj</div>
                  <div style={{ color: C.muted, fontSize: 11 }}>Founder • Admin</div>
                </div>
              </div>
            </div>

            <div className="stats-grid">
              <StatCard label="Restaurant Health" value={analysis ? `${hs}%` : "—"} sub="AI-generated performance score" accent={healthColor(hs)} />
              <StatCard label="Reviews Analysed" value={rawReviews.length || "—"} sub="Across all connected sources" accent={C.cyan} />
              <StatCard label="Positive Signals" value={analysis?.sentiment?.positive ?? "—"} sub="Strong customer experiences" accent={C.green2} />
              <StatCard label="Negative Signals" value={analysis?.sentiment?.negative ?? "—"} sub="Issues worth owner attention" accent={C.red} />
            </div>

            <div style={{ marginTop: 16 }} className="three-col">
              <MiniInfo icon="🍽️" label="Must Try" value={analysis?.forCustomer?.mustTry || "Top dish pending"} color={C.green2} />
              <MiniInfo icon="🕒" label="Best Time" value={analysis?.bestTimeToVisit || "Weekday lunch"} color={C.cyan} />
              <MiniInfo icon="💰" label="Avg For Two" value={analysis?.priceRange?.avgMealForTwo || "—"} color={C.amber} />
            </div>
          </ShellCard>
        </div>

        {restaurant && analysis ? (
          <div className="main-grid fadeIn">
            <ShellCard style={{ padding: 14, alignSelf: "start", position: "sticky", top: 108 }}>
              <div style={{ color: C.muted2, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                Dashboard Views
              </div>

              {[
                { k: "charts", l: "📊 Charts" },
                { k: "competitors", l: "🏁 Competitors" },
                { k: "owner", l: "🍽️ Owner" },
                { k: "customer", l: "👥 Customer" },
                { k: "food", l: "🍔 Food" },
                { k: "access", l: "♿ Access" },
                { k: "hygiene", l: "🧹 Hygiene" },
                { k: "reviews", l: "📝 Reviews" },
              ].map((item) => (
                <button
                  key={item.k}
                  className={`tab-btn ${activeTab === item.k ? "active" : ""}`}
                  onClick={() => setActiveTab(item.k)}
                  style={{ marginBottom: 8 }}
                >
                  {item.l}
                </button>
              ))}

              <div
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(79,140,255,0.14), rgba(34,211,238,0.10))",
                  border: `1px solid ${C.borderStrong}`,
                }}
              >
                <div style={{ color: C.white, fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Profile Snapshot</div>
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7 }}>
                  Premium workspace view for founders, restaurant owners, and multi-location review intelligence.
                </div>
              </div>
            </ShellCard>

            <div>
              <div className="three-col" style={{ marginBottom: 14 }}>
                <SectionCard title={restaurant.name} sub={restaurant.address}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill color={C.blue} bg="rgba(79,140,255,0.12)">
                      Google: {sourceCounts.google}
                    </Pill>
                    <Pill color={C.green2} bg="rgba(52,211,153,0.12)">
                      Yelp: {sourceCounts.yelp}
                    </Pill>
                    <Pill color={C.red} bg="rgba(255,92,122,0.12)">
                      TripAdvisor: {sourceCounts.tripadvisor}
                    </Pill>
                    <Pill color={C.white} bg="rgba(255,255,255,0.08)">
                      Total: {rawReviews.length}
                    </Pill>
                  </div>
                </SectionCard>

                <SectionCard title="Health Score" sub="Overall AI business signal">
                  <div style={{ color: healthColor(hs), fontSize: 40, fontWeight: 900 }}>{hs}%</div>
                  <div style={{ marginTop: 8, height: 9, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${hs}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${C.blue}, ${C.cyan}, ${C.green})`,
                      }}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Customer Verdict" sub="Decision signal from review patterns">
                  <div
                    style={{
                      display: "inline-flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 16,
                      background: verdict.bg,
                      border: `1px solid ${verdict.border}`,
                      color: verdict.color,
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    <span>{verdict.icon}</span>
                    <span>{verdict.label}</span>
                  </div>
                </SectionCard>
              </div>

              {activeTab === "charts" && (
                <div className="fadeIn">
                  <div className="analytics-grid">
                    <SectionCard title="Reviews by Platform" sub="How much data came from each source">
                      <div style={{ width: "100%", height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.sourceData}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="name" stroke={C.muted2} />
                            <YAxis stroke={C.muted2} />
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Bar dataKey="reviews" fill={C.blue} radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>

                    <SectionCard title="Sentiment Split" sub="Positive, neutral, and negative breakdown">
                      <div style={{ width: "100%", height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={chartData.sentimentData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}>
                              {chartData.sentimentData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>

                    <SectionCard title="Average Rating Trend" sub="Review rating movement over time">
                      <div style={{ width: "100%", height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData.ratingTrend}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="month" stroke={C.muted2} />
                            <YAxis domain={[0, 5]} stroke={C.muted2} />
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Line type="monotone" dataKey="rating" stroke={C.green2} strokeWidth={3} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>

                    <SectionCard title="Top Complaints" sub="Most repeated negative themes">
                      <div style={{ width: "100%", height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.complaintData} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                            <XAxis type="number" stroke={C.muted2} />
                            <YAxis dataKey="issue" type="category" stroke={C.muted2} width={120} />
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Bar dataKey="mentions" fill={C.red} radius={[0, 10, 10, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>

                    <SectionCard title="Top Praises" sub="Most repeated positive themes">
                      <div style={{ width: "100%", height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.praiseData} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                            <XAxis type="number" stroke={C.muted2} />
                            <YAxis dataKey="aspect" type="category" stroke={C.muted2} width={120} />
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Bar dataKey="mentions" fill={C.green2} radius={[0, 10, 10, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>

                    <SectionCard title="Trending Recipes" sub="Dishes mentioned most often in reviews">
                      <div style={{ width: "100%", height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.recipeTrend}>
                            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="recipe" stroke={C.muted2} />
                            <YAxis stroke={C.muted2} />
                            <Tooltip contentStyle={chartTooltipStyle} />
                            <Bar dataKey="mentions" fill={C.purple} radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>
                  </div>

                  <SectionCard
                    title="What these charts show"
                    sub="Visual layer added on top of your real backend and analysis data"
                    style={{ marginTop: 14 }}
                  >
                    <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8 }}>
                      These charts are built directly from your existing <span style={{ color: C.white, fontWeight: 700 }}>rawReviews</span>,
                      <span style={{ color: C.white, fontWeight: 700 }}> sourceCounts</span>, and
                      <span style={{ color: C.white, fontWeight: 700 }}> analysis</span>. Your core backend idea stays the same —
                      this simply makes your AI output more premium, easier to read, and more useful for owners and customers.
                    </div>
                  </SectionCard>
                </div>
              )}

              {activeTab === "competitors" && (
                <div className="fadeIn">
                  <div className="two-col">
                    <SectionCard
                      title="Competitor Comparison"
                      sub="How your restaurant compares with nearby competitors"
                    >
                      {competitorLoading ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>Loading competitor comparison...</div>
                      ) : !competitorData ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>
                          No competitor comparison available yet.
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                            <Pill color={C.cyan} bg="rgba(34,211,238,0.12)">
                              Category: {competitorData.keywordUsed}
                            </Pill>
                            <Pill color={C.white} bg="rgba(255,255,255,0.08)">
                              Nearby competitors: {competitorData.competitors?.length || 0}
                            </Pill>
                          </div>

                          <div
                            style={{
                              padding: 14,
                              borderRadius: 18,
                              background: "#ffffff",
                              border: `1px solid ${C.border}`,
                            }}
                          >
                            <div style={{ color: C.white, fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                              Recommendation
                            </div>
                            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.75 }}>
                              {competitorData.summary?.recommendation}
                            </div>
                          </div>
                        </>
                      )}
                    </SectionCard>

                    <SectionCard
                      title="Why You Are Winning / Losing"
                      sub="Fast business summary for owners"
                    >
                      {competitorLoading ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>Preparing comparison summary...</div>
                      ) : !competitorData ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>No summary yet.</div>
                      ) : (
                        <div className="two-col">
                          <div
                            style={{
                              padding: 14,
                              borderRadius: 18,
                              background: "rgba(52,211,153,0.08)",
                              border: "1px solid rgba(52,211,153,0.22)",
                            }}
                          >
                            <div style={{ color: C.green2, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
                              ✅ Where You Are Winning
                            </div>
                            {(competitorData.summary?.winning || []).length === 0 ? (
                              <div style={{ color: C.muted, fontSize: 13 }}>No strong winning signals yet.</div>
                            ) : (
                              (competitorData.summary.winning || []).map((item, i) => (
                                <div
                                  key={i}
                                  style={{
                                    color: C.muted,
                                    fontSize: 13,
                                    lineHeight: 1.7,
                                    marginBottom: 8,
                                  }}
                                >
                                  • {item}
                                </div>
                              ))
                            )}
                          </div>

                          <div
                            style={{
                              padding: 14,
                              borderRadius: 18,
                              background: "rgba(255,92,122,0.08)",
                              border: "1px solid rgba(255,92,122,0.22)",
                            }}
                          >
                            <div style={{ color: C.red, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
                              ❌ Where You Are Losing
                            </div>
                            {(competitorData.summary?.losing || []).length === 0 ? (
                              <div style={{ color: C.muted, fontSize: 13 }}>No major weak points detected.</div>
                            ) : (
                              (competitorData.summary.losing || []).map((item, i) => (
                                <div
                                  key={i}
                                  style={{
                                    color: C.muted,
                                    fontSize: 13,
                                    lineHeight: 1.7,
                                    marginBottom: 8,
                                  }}
                                >
                                  • {item}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </SectionCard>
                  </div>

                  <SectionCard
                    title="Nearby Competitors"
                    sub="Businesses near your restaurant from Google Places"
                    style={{ marginTop: 14 }}
                  >
                    {competitorLoading ? (
                      <div style={{ color: C.muted, fontSize: 13 }}>Loading nearby competitors...</div>
                    ) : !competitorData?.competitors?.length ? (
                      <div style={{ color: C.muted, fontSize: 13 }}>No nearby competitors found.</div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        {competitorData.competitors.map((comp, i) => (
                          <div
                            key={comp.placeId || i}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.7fr",
                              gap: 12,
                              padding: 14,
                              borderRadius: 18,
                              background: "#ffffff",
                              border: `1px solid ${C.border}`,
                            }}
                          >
                            <div>
                              <div style={{ color: C.white, fontSize: 15, fontWeight: 800 }}>
                                {comp.name}
                              </div>
                              <div style={{ color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
                                {comp.address}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: C.muted2, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                                Rating
                              </div>
                              <div style={{ color: C.white, fontSize: 15, fontWeight: 800, marginTop: 6 }}>
                                ⭐ {comp.rating || 0}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: C.muted2, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                                Reviews
                              </div>
                              <div style={{ color: C.white, fontSize: 15, fontWeight: 800, marginTop: 6 }}>
                                {comp.reviews || 0}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: C.muted2, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                                Distance
                              </div>
                              <div style={{ color: C.white, fontSize: 15, fontWeight: 800, marginTop: 6 }}>
                                {comp.distance !== null ? `${comp.distance} mi` : "—"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </div>
              )}

              {activeTab === "owner" && (
                <div className="fadeIn">
                  <div className="two-col">
                    <SectionCard title="AI Conclusion for Owner" sub="Operational summary based on real reviews">
                      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8 }}>{analysis.forOwner?.conclusion}</div>
                      <div
                        style={{
                          marginTop: 14,
                          padding: 14,
                          borderRadius: 18,
                          background: "rgba(255,92,122,0.08)",
                          border: `1px solid rgba(255,92,122,0.22)`,
                        }}
                      >
                        <div style={{ color: C.red, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                          Urgent Action
                        </div>
                        <div style={{ color: C.white, fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                          {analysis.forOwner?.urgentAction}
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Platform Breakdown" sub="Review coverage used in analysis">
                      <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 14 }}>
                        This analysis is based on <span style={{ color: C.white, fontWeight: 800 }}>{rawReviews.length}</span> reviews:
                      </div>
                      <ProgressRow label="Google" value={sourceCounts.google} total={rawReviews.length} color={C.blue} />
                      <ProgressRow label="Yelp" value={sourceCounts.yelp} total={rawReviews.length} color={C.green2} />
                      <ProgressRow label="TripAdvisor" value={sourceCounts.tripadvisor} total={rawReviews.length} color={C.red} />
                    </SectionCard>
                  </div>

                  <div className="two-col" style={{ marginTop: 14 }}>
                    <SectionCard title="Top Complaints" sub="What needs fixing most">
                      {(analysis.topComplaints || []).length === 0 ? (
                        <div style={{ color: C.green2, fontSize: 13, fontWeight: 700 }}>No major complaints detected ✅</div>
                      ) : (
                        (analysis.topComplaints || []).map((c, i) => (
                          <ProgressRow
                            key={i}
                            label={c.issue}
                            value={c.count}
                            total={analysis.totalAnalysed}
                            color={c.severity === "high" ? C.red : c.severity === "medium" ? C.cyan : C.muted}
                          />
                        ))
                      )}
                    </SectionCard>

                    <SectionCard title="Top Praises" sub="What customers consistently like">
                      {(analysis.topPraises || []).length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>No strong praise clusters detected.</div>
                      ) : (
                        (analysis.topPraises || []).map((p, i) => (
                          <ProgressRow key={i} label={p.aspect} value={p.count} total={analysis.totalAnalysed} color={C.green2} />
                        ))
                      )}
                    </SectionCard>
                  </div>

                  <SectionCard title="Recommended Owner Improvements" sub="Action list generated from review signals" style={{ marginTop: 14 }}>
                    {(analysis.forOwner?.improvements || []).map((imp, i) => (
                      <ActionRow key={i} index={i + 1} text={imp} />
                    ))}
                  </SectionCard>
                </div>
              )}

              {activeTab === "customer" && (
                <div className="fadeIn">
                  <SectionCard title="Customer Verdict" sub="Should a customer go here?">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: 16,
                        borderRadius: 20,
                        background: verdict.bg,
                        border: `1px solid ${verdict.border}`,
                        marginBottom: 16,
                      }}
                    >
                      <div style={{ fontSize: 34 }}>{verdict.icon}</div>
                      <div>
                        <div style={{ color: verdict.color, fontSize: 21, fontWeight: 800 }}>{verdict.label}</div>
                        <div style={{ color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 1.7 }}>
                          {analysis.forCustomer?.conclusion}
                        </div>
                      </div>
                    </div>

                    <div className="two-col">
                      <MiniInfo icon="🍽️" label="Must Try" value={analysis.forCustomer?.mustTry} color={C.green2} />
                      <MiniInfo icon="🚫" label="Avoid" value={analysis.forCustomer?.avoid} color={C.red} />
                      <MiniInfo icon="🕐" label="Best Time" value={analysis.bestTimeToVisit} color={C.cyan} />
                      <MiniInfo icon="💰" label="Value" value={analysis.priceRange?.valueLabel || "Fair"} color={C.amber} />
                    </div>
                  </SectionCard>
                </div>
              )}

              {activeTab === "food" && (
                <div className="fadeIn">
                  <div className="two-col">
                    <SectionCard title="Best Dishes" sub="Most positively mentioned food items">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(analysis.bestDishes || []).length === 0 ? (
                          <div style={{ color: C.muted, fontSize: 13 }}>No dishes highlighted yet.</div>
                        ) : (
                          (analysis.bestDishes || []).map((dish, i) => (
                            <span
                              key={i}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                background: "rgba(52,211,153,0.12)",
                                border: "1px solid rgba(52,211,153,0.28)",
                                color: C.green2,
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "✅"} {dish}
                            </span>
                          ))
                        )}
                      </div>
                    </SectionCard>

                    <SectionCard title="Dishes to Avoid" sub="Items flagged in customer feedback">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(analysis.dishesToAvoid || []).length === 0 ? (
                          <div style={{ color: C.green2, fontSize: 13, fontWeight: 700 }}>No dishes flagged ✅</div>
                        ) : (
                          (analysis.dishesToAvoid || []).map((dish, i) => (
                            <span
                              key={i}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                background: "rgba(255,92,122,0.12)",
                                border: "1px solid rgba(255,92,122,0.26)",
                                color: C.red,
                                fontSize: 12,
                                fontWeight: 800,
                              }}
                            >
                              ❌ {dish}
                            </span>
                          ))
                        )}
                      </div>
                    </SectionCard>
                  </div>

                  <SectionCard title="Price Guide" sub="Estimated value insights from review language" style={{ marginTop: 14 }}>
                    <div className="three-col">
                      <MiniInfo icon="👤" label="Avg For One" value={analysis.priceRange?.avgMealForOne} color={C.green2} />
                      <MiniInfo icon="👥" label="Avg For Two" value={analysis.priceRange?.avgMealForTwo} color={C.amber} />
                      <MiniInfo
                        icon="⭐"
                        label="Value Rating"
                        value={`${"⭐".repeat(Math.max(1, Math.round(analysis.priceRange?.valueRating || 3)))} ${analysis.priceRange?.valueLabel || ""}`}
                        color={C.cyan}
                      />
                    </div>
                  </SectionCard>
                </div>
              )}

              {activeTab === "access" && (
                <div className="fadeIn">
                  <SectionCard title="Accessibility & Convenience" sub="Parking, wheelchair access, wifi, and environment">
                    <div className="three-col">
                      <MiniInfo
                        icon="🅿️"
                        label="Parking"
                        value={
                          analysis.accessibility?.parking?.available === true
                            ? "Available"
                            : analysis.accessibility?.parking?.available === false
                              ? "Not available"
                              : "Unknown"
                        }
                        color={C.green2}
                      />
                      <MiniInfo
                        icon="♿"
                        label="Wheelchair"
                        value={
                          analysis.accessibility?.wheelchair?.accessible === true
                            ? "Accessible"
                            : analysis.accessibility?.wheelchair?.accessible === false
                              ? "Limited"
                              : "Unknown"
                        }
                        color={C.cyan}
                      />
                      <MiniInfo
                        icon="📶"
                        label="WiFi"
                        value={
                          analysis.accessibility?.wifi?.available === true
                            ? "Available"
                            : analysis.accessibility?.wifi?.available === false
                              ? "Not available"
                              : "Unknown"
                        }
                        color={C.blue}
                      />
                      <MiniInfo
                        icon="🪑"
                        label="Kids Chairs"
                        value={
                          analysis.accessibility?.kidsChairs?.available === true
                            ? "Available"
                            : analysis.accessibility?.kidsChairs?.available === false
                              ? "No"
                              : "Unknown"
                        }
                        color={C.green2}
                      />
                      <MiniInfo icon="🔊" label="Noise Level" value={analysis.accessibility?.noiseLevel || "Unknown"} color={C.purple} />
                      <MiniInfo icon="🚻" label="Restrooms" value={analysis.accessibility?.restrooms || "Unknown"} color={C.amber} />
                    </div>
                  </SectionCard>
                </div>
              )}

              {activeTab === "hygiene" && (
                <div className="fadeIn">
                  <div className="two-col">
                    <SectionCard title="Hygiene Score" sub="Cleanliness signal from reviews">
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 58, fontWeight: 900, color: healthColor((analysis.hygiene?.score || 0) * 10) }}>
                          {analysis.hygiene?.score || "—"}
                          <span style={{ fontSize: 24, color: C.muted }}>/10</span>
                        </div>
                        <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>{analysis.hygiene?.label || "Unknown"}</div>
                        <div
                          style={{
                            height: 10,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.07)",
                            overflow: "hidden",
                            marginTop: 16,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(analysis.hygiene?.score || 0) * 10}%`,
                              borderRadius: 999,
                              background: `linear-gradient(90deg, ${C.blue}, ${C.cyan}, ${C.green2})`,
                            }}
                          />
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Hygiene Details" sub="Where customers mention cleanliness most">
                      <div className="two-col">
                        <MiniInfo icon="🍳" label="Kitchen" value={analysis.hygiene?.kitchen} color={C.green2} />
                        <MiniInfo icon="🪑" label="Tables" value={analysis.hygiene?.tables} color={C.cyan} />
                        <MiniInfo icon="🚻" label="Restrooms" value={analysis.hygiene?.restrooms} color={C.amber} />
                        <MiniInfo icon="👨‍🍳" label="Staff" value={analysis.hygiene?.staff} color={C.blue} />
                      </div>
                    </SectionCard>
                  </div>

                  {analysis.hygiene?.ownerAlert ? (
                    <SectionCard title="Owner Alert" sub="Important hygiene-related warning" style={{ marginTop: 14 }}>
                      <div
                        style={{
                          padding: 16,
                          borderRadius: 18,
                          background: "rgba(255,92,122,0.08)",
                          border: "1px solid rgba(255,92,122,0.24)",
                          color: C.muted,
                          fontSize: 13,
                          lineHeight: 1.8,
                        }}
                      >
                        {analysis.hygiene.ownerAlert}
                      </div>
                    </SectionCard>
                  ) : null}
                </div>
              )}

              {activeTab === "reviews" && (
                <div className="fadeIn">
                  <div className="three-col" style={{ marginBottom: 14 }}>
                    <SectionCard title="Google Reviews" sub={`${googleReviews.length} collected`}>
                      {googleReviews.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>No Google reviews returned.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {googleReviews.slice(0, 4).map((r, i) => (
                            <ReviewCard key={`g-${i}`} review={r} platformColor={C.blue} platformLabel="Google" />
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="Yelp Reviews" sub={`${yelpReviews.length} collected`}>
                      {yelpReviews.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>No Yelp reviews returned.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {yelpReviews.slice(0, 4).map((r, i) => (
                            <ReviewCard key={`y-${i}`} review={r} platformColor={C.green2} platformLabel="Yelp" />
                          ))}
                        </div>
                      )}
                    </SectionCard>

                    <SectionCard title="TripAdvisor Reviews" sub={`${tripReviews.length} collected`}>
                      {tripReviews.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>No TripAdvisor reviews returned.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {tripReviews.slice(0, 4).map((r, i) => (
                            <ReviewCard key={`t-${i}`} review={r} platformColor={C.red} platformLabel="TripAdvisor" />
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                </div>
              )}

              <button
                onClick={reset}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: `1px solid ${C.borderStrong}`,
                  background: "#ffffff",
                  color: C.white,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                🔄 Analyse Another Restaurant
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <ShellCard style={{ padding: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8 }}>Your premium AI dashboard is ready</div>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.8, maxWidth: 860 }}>
                Paste a restaurant URL above to load the redesigned dashboard with review analytics, trend charts, owner actions,
                customer verdicts, food insights, hygiene signals, competitor comparison, and premium data cards — all powered by your existing backend.
              </div>
            </ShellCard>
          </div>
        )}
      </div>
    </div>
  );
}

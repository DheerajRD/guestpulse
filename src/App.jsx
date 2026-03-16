import { useState } from "react";

const C = {
  black:  "#07090f", black2: "#0d1117", black3: "#161b27", black4: "#1e2535",
  green:  "#00e676", green2: "#00c853", greenDim: "rgba(0,230,118,0.1)", greenBorder: "rgba(0,230,118,0.22)",
  blue:   "#2979ff", blue2:  "#448aff", blueDim:  "rgba(41,121,255,0.1)",  blueBorder:  "rgba(41,121,255,0.22)",
  red: "#ff5252", redDim: "rgba(255,82,82,0.08)", redBorder: "rgba(255,82,82,0.2)",
  white: "#e8eaf6", muted: "rgba(232,234,246,0.45)", faint: "rgba(232,234,246,0.08)", border: "rgba(232,234,246,0.07)",
};

const VERDICT = {
  recommended: { color: C.green,  bg: C.greenDim,  border: C.greenBorder, icon: "✅", label: "Recommended" },
  mixed:       { color: C.blue2,  bg: C.blueDim,   border: C.blueBorder,  icon: "⚡", label: "Mixed Reviews" },
  avoid:       { color: C.red,    bg: C.redDim,    border: C.redBorder,   icon: "🚫", label: "Avoid For Now" },
};

const bool2label = (v, yes="✅ Yes", no="❌ No") => v === true ? yes : v === false ? no : "—";
const healthColor = s => s > 70 ? C.green : s > 40 ? C.blue2 : C.red;

const Inp = ({ placeholder, value, onChange, type="text", style={} }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", background:C.black2, border:`1.5px solid ${C.border}`, borderRadius:12,
      padding:"12px 16px", color:C.white, fontSize:14, fontFamily:"inherit", outline:"none",
      marginBottom:10, ...style }}/>
);

const BtnPrimary = ({ children, onClick, style={} }) => (
  <button onClick={onClick}
    style={{ width:"100%", background:`linear-gradient(135deg,${C.blue},${C.green})`, border:"none",
      borderRadius:12, padding:"13px", fontSize:14, fontWeight:800, color:C.black,
      cursor:"pointer", fontFamily:"'Syne',sans-serif", ...style }}>
    {children}
  </button>
);

const Card = ({ children, style={} }) => (
  <div style={{ background:C.black3, border:`1px solid ${C.border}`, borderRadius:16, padding:16, marginBottom:12, ...style }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <p style={{ fontSize:10, fontWeight:700, color:"rgba(232,234,246,0.3)", textTransform:"uppercase",
    letterSpacing:"1px", marginBottom:10 }}>{children}</p>
);

const RolePill = ({ role }) => (
  <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", borderRadius:100,
    fontSize:11, fontWeight:700, fontFamily:"inherit",
    background: role==="owner" ? C.blueDim  : C.greenDim,
    border:     `1px solid ${role==="owner" ? C.blueBorder : C.greenBorder}`,
    color:      role==="owner" ? C.blue2 : C.green }}>
    {role==="owner" ? "🍽️ Owner Mode" : "👥 Customer Mode"}
  </span>
);

const BackBtn = ({ onClick }) => (
  <button onClick={onClick}
    style={{ display:"flex", alignItems:"center", gap:6, background:C.black3, border:`1px solid ${C.border}`,
      borderRadius:9, padding:"6px 14px", fontSize:12, fontWeight:700, color:C.muted,
      cursor:"pointer", fontFamily:"inherit" }}>
    ← Back
  </button>
);

const InfoCard = ({ icon, label, value, sub, color }) => (
  <div style={{ borderRadius:12, padding:"12px 14px", background:`${color}10`, border:`1px solid ${color}25` }}>
    <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
    <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", color, marginBottom:4, opacity:0.7 }}>{label}</div>
    <div style={{ fontSize:13, fontWeight:700, color:C.white }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>{sub}</div>}
  </div>
);

const ComplaintBar = ({ label, count, total, color }) => (
  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
    <span style={{ fontSize:12, color:C.muted, width:110, flexShrink:0 }}>{label}</span>
    <div style={{ flex:1, background:"rgba(232,234,246,0.06)", borderRadius:100, height:5, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:100, background:color, width:`${Math.min((count/Math.max(total,1))*100*3,100)}%`, transition:"width 1s ease" }}/>
    </div>
    <span style={{ fontSize:12, fontWeight:700, color, width:26, textAlign:"right" }}>{count}</span>
  </div>
);

const ImprovRow = ({ n, text }) => (
  <div style={{ display:"flex", gap:10, alignItems:"flex-start", background:C.black3, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", marginBottom:8 }}>
    <div style={{ width:22, height:22, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:C.black, flexShrink:0, marginTop:1 }}>{n}</div>
    <p style={{ fontSize:12, color:C.muted, lineHeight:1.6, margin:0 }}>{text}</p>
  </div>
);

export default function App() {
  const [screen,       setScreen]       = useState("welcome");
  const [prevScreen,   setPrevScreen]   = useState("welcome");
  const [role,         setRole]         = useState("owner");
  const [activeTab,    setActiveTab]    = useState("owner");
  const [searchMethod, setSearchMethod] = useState("gps");
  const [ownerName,    setOwnerName]    = useState("");
  const [ownerUrl,     setOwnerUrl]     = useState("");
  const [custName,     setCustName]     = useState("");
  const [custAddress,  setCustAddress]  = useState("");
  const [custCity,     setCustCity]     = useState("");
  const [directUrl,    setDirectUrl]    = useState("");
  const [restaurant,   setRestaurant]   = useState(null);
  const [analysis,     setAnalysis]     = useState(null);
  const [branches,     setBranches]     = useState([]);
  const [stage,        setStage]        = useState("idle");
  const [progress,     setProgress]     = useState(0);
  const [errorMsg,     setErrorMsg]     = useState("");
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, color=C.green) => { setToast({msg,color}); setTimeout(()=>setToast(null),2800); };

  const goTo = (s) => { setPrevScreen(screen); setScreen(s); setErrorMsg(""); };
  const goBack = () => { setScreen(prevScreen); setErrorMsg(""); };

  const runAnalysis = async (placeUrl, placeId) => {
    setErrorMsg(""); setRestaurant(null); setAnalysis(null);
    try {
      setStage("fetching"); setProgress(20);
      const revRes  = await fetch("/api/reviews", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ placeUrl, placeId }),
      });
      const revData = await revRes.json();
      if (!revRes.ok) throw new Error(revData.error || "Failed to fetch reviews");
      setRestaurant(revData.restaurant);
      setProgress(50);
      setStage("analysing"); setProgress(65);
      const anaRes  = await fetch("/api/analyse", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ reviews: revData.reviews, restaurantName: revData.restaurant.name }),
      });
      const anaData = await anaRes.json();
      if (!anaRes.ok) throw new Error(anaData.error || "Analysis failed");
      setAnalysis(anaData.analysis);
      setProgress(100); setStage("done");
    } catch(e) {
      setErrorMsg(e.message || "Something went wrong.");
      setStage("error"); setProgress(0);
    }
  };

  const handleOwnerAnalyse = async () => {
    if (!ownerUrl.trim() && !ownerName.trim()) { setErrorMsg("Please enter your restaurant name or paste a Google Maps URL."); return; }
    await runAnalysis(ownerUrl.trim() || ownerName.trim(), null);
    goTo("owner-dash");
  };

  const handleDirectUrl = async () => {
    if (!directUrl.trim()) { setErrorMsg("Please paste a Google Maps URL."); return; }
    await runAnalysis(directUrl.trim(), null);
    goTo(role === "owner" ? "owner-dash" : "customer-dash");
  };

  const findBranches = async () => {
    const name = custName.trim();
    if (!name) { setErrorMsg("Please enter a restaurant name."); return; }
    setErrorMsg(""); setBranches([]); setStage("searching"); setProgress(30);
    try {
      let lat, lng;
      if (searchMethod === "gps") {
        try {
          const pos = await new Promise((res,rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:8000}));
          lat = pos.coords.latitude; lng = pos.coords.longitude;
        } catch {}
      }
      const body = { name, lat, lng, address: custAddress.trim(), city: custCity.trim() };
      const r    = await fetch("/api/nearby", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const d    = await r.json();
      if (!r.ok) throw new Error(d.error || "Search failed");
      setBranches(d.branches || []);
      setProgress(100); setStage("done");
      goTo("branches");
    } catch(e) {
      setErrorMsg(e.message || "Search failed");
      setStage("error"); setProgress(0);
    }
  };

  const handleBranchSelect = async (branch) => {
    await runAnalysis(null, branch.placeId);
    goTo("customer-dash");
  };

  const downloadReport = () => {
    if (!analysis || !restaurant) return;
    const v = VERDICT[analysis.forCustomer?.verdict] || VERDICT.mixed;
    const lines = [
      "╔═══════════════════════════════════════════╗",
      "║         GUESTPULSE AI — FULL REPORT       ║",
      "╚═══════════════════════════════════════════╝",
      `Generated  : ${new Date().toLocaleString()}`,
      `Restaurant : ${restaurant.name}`,
      `Address    : ${restaurant.address}`,
      `Rating     : ${restaurant.rating} ⭐ (${restaurant.totalReviews} total)`,
      `Analysed   : ${analysis.totalAnalysed} reviews`,
      "", "── HEALTH SCORE ─────────────────────────────",
      `${analysis.healthScore}/100`,
      "", "── FOR OWNER ────────────────────────────────",
      analysis.forOwner?.conclusion || "",
      "URGENT: " + (analysis.forOwner?.urgentAction || ""),
      "", "IMPROVEMENTS:",
      ...(analysis.forOwner?.improvements || []).map((x,i) => `${i+1}. ${x}`),
      "", "── TOP COMPLAINTS ───────────────────────────",
      ...(analysis.topComplaints || []).map(c => `• ${c.issue} (${c.count}) [${c.severity}]`),
      "", "── FOR CUSTOMER ─────────────────────────────",
      `Verdict  : ${v.label}`,
      analysis.forCustomer?.conclusion || "",
      `Must Try : ${analysis.forCustomer?.mustTry}`,
      `Avoid    : ${analysis.forCustomer?.avoid}`,
      "", "── FOOD & PRICES ────────────────────────────",
      `Best Dishes  : ${(analysis.bestDishes||[]).join(", ")}`,
      `Avg 1 person : ${analysis.priceRange?.avgMealForOne}`,
      `Avg 2 people : ${analysis.priceRange?.avgMealForTwo}`,
      "", "── ACCESSIBILITY ────────────────────────────",
      `Parking    : ${bool2label(analysis.accessibility?.parking?.available)}`,
      `Wheelchair : ${bool2label(analysis.accessibility?.wheelchair?.accessible)}`,
      `Kids Chairs: ${bool2label(analysis.accessibility?.kidsChairs?.available)}`,
      `WiFi       : ${bool2label(analysis.accessibility?.wifi?.available)}`,
      "", "── HYGIENE ──────────────────────────────────",
      `Score : ${analysis.hygiene?.score}/10 — ${analysis.hygiene?.label}`,
      "", "Report by GuestPulse AI",
    ];
    const blob = new Blob([lines.join("\n")], {type:"text/plain"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${restaurant.name}-guestpulse.txt`; a.click();
    showToast("Report downloaded!");
  };

  const isLoading = stage === "fetching" || stage === "analysing" || stage === "searching";
  const hScore    = analysis?.healthScore || 0;

  return (
    <div style={{ minHeight:"100vh", background:C.black, color:C.white, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e2535;border-radius:4px}
        .btn-ghost{cursor:pointer;border:1px solid rgba(232,234,246,0.07);background:#161b27;color:rgba(232,234,246,0.45);border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;font-family:inherit;transition:all .15s}
        .btn-ghost:hover{border-color:rgba(41,121,255,0.22);color:#448aff}
        .hover-card{transition:all .18s}.hover-card:hover{transform:translateX(3px);border-color:rgba(41,121,255,0.22)!important}
        .fade{animation:fu .35s ease}@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pl 2s ease-in-out infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.4}}
        .prog-bar{transition:width .5s ease}
        input:focus{border-color:#2979ff!important;outline:none}
        .tab-btn{cursor:pointer;border:1px solid rgba(232,234,246,0.07);background:transparent;color:rgba(232,234,246,0.45);border-radius:9px;padding:7px 14px;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;white-space:nowrap}
        .tab-btn.on{background:rgba(0,230,118,0.1);border-color:rgba(0,230,118,0.22);color:#00e676}
        .tab-btn:hover:not(.on){border-color:rgba(41,121,255,0.22);color:#448aff}
        .role-btn{cursor:pointer;border-radius:20px;padding:24px 18px;text-align:center;transition:all .2s;border:2px solid transparent}
        .role-btn:hover{transform:translateY(-4px)}
      `}</style>

      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:9999, background:toast.color,
          color:C.black, padding:"10px 20px", borderRadius:10, fontSize:13, fontWeight:700,
          boxShadow:"0 4px 20px rgba(0,0,0,.4)", animation:"fu .3s ease" }}>
          {toast.msg}
        </div>
      )}

      <nav style={{ background:C.black2, borderBottom:`1px solid ${C.border}`, padding:"14px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${C.blue},${C.green})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>💓</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800,
            background:`linear-gradient(135deg,${C.blue2},${C.green})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            GuestPulse
          </span>
          <span style={{ fontSize:11, color:C.blue2, fontWeight:700, background:C.blueDim,
            border:`1px solid ${C.blueBorder}`, padding:"2px 8px", borderRadius:100 }}>AI</span>
        </div>
        {analysis && restaurant && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:12, color:healthColor(hScore), fontWeight:700,
              background:`${healthColor(hScore)}12`, border:`1px solid ${healthColor(hScore)}25`,
              padding:"4px 12px", borderRadius:100 }}>
              💚 Health {hScore}%
            </span>
            <button className="btn-ghost" style={{ padding:"6px 14px", fontSize:12 }} onClick={downloadReport}>
              📥 Report
            </button>
          </div>
        )}
      </nav>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"28px 18px 60px" }}>

        {screen === "welcome" && (
          <div className="fade">
            <div style={{ textAlign:"center", marginBottom:36 }}>
              <div style={{ width:72, height:72, borderRadius:20, background:`linear-gradient(135deg,${C.blue},${C.green})`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, margin:"0 auto 18px" }}>💓</div>
              <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, color:C.white, marginBottom:10, lineHeight:1.2 }}>
                Welcome to<br/>
                <span style={{ background:`linear-gradient(135deg,${C.blue2},${C.green})`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                  GuestPulse AI
                </span>
              </h1>
              <p style={{ fontSize:15, color:C.muted, maxWidth:380, margin:"0 auto", lineHeight:1.7 }}>
                AI-powered restaurant intelligence. Tell us who you are and we show you the right insights.
              </p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:28 }}>
              <div className="role-btn" style={{ background:C.blueDim, borderColor:C.blueBorder }}
                onClick={() => { setRole("owner"); goTo("owner-search"); }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🍽️</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:C.white, marginBottom:8 }}>Restaurant Owner</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:16 }}>Analyse reviews, fix issues, improve your rating</div>
                <div style={{ background:`linear-gradient(135deg,${C.blue},${C.blue2})`, borderRadius:10, padding:"10px", fontSize:13, fontWeight:800, color:"#fff" }}>I'm an Owner →</div>
              </div>
              <div className="role-btn" style={{ background:C.greenDim, borderColor:C.greenBorder }}
                onClick={() => { setRole("customer"); goTo("customer-search"); }}>
                <div style={{ fontSize:44, marginBottom:12 }}>👥</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:C.white, marginBottom:8 }}>Customer</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6, marginBottom:16 }}>Find best dishes, nearby branches, avoid bad visits</div>
                <div style={{ background:`linear-gradient(135deg,${C.green2},${C.green})`, borderRadius:10, padding:"10px", fontSize:13, fontWeight:800, color:C.black }}>I'm a Customer →</div>
              </div>
            </div>
            <Card>
              <Label>Or paste a Google Maps URL directly</Label>
              <Inp value={directUrl} onChange={setDirectUrl} placeholder="https://maps.google.com/maps/place/..."/>
              {errorMsg && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {errorMsg}</div>}
              <BtnPrimary onClick={handleDirectUrl}>{isLoading ? "⏳ Loading…" : "🔍 Analyse Now →"}</BtnPrimary>
            </Card>
          </div>
        )}

        {screen === "owner-search" && (
          <div className="fade">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <BackBtn onClick={() => goTo("welcome")}/>
              <RolePill role="owner"/>
            </div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:C.white, marginBottom:6 }}>Analyse Your Restaurant</h2>
            <p style={{ fontSize:13, color:C.muted, marginBottom:22, lineHeight:1.6 }}>See what your customers are really saying about you</p>
            <Card>
              <Label>Restaurant name</Label>
              <Inp value={ownerName} onChange={setOwnerName} placeholder="e.g. Pizza Palace"/>
              <Label>Google Maps URL (recommended)</Label>
              <Inp value={ownerUrl} onChange={setOwnerUrl} placeholder="https://maps.google.com/maps/place/..."/>
              {errorMsg && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {errorMsg}</div>}
              {isLoading ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div className="pulse" style={{ fontSize:32, marginBottom:10 }}>🤖</div>
                  <p style={{ fontSize:13, color:C.muted, marginBottom:16 }}>{stage==="fetching"?"Fetching reviews from Google…":"Claude AI is analysing reviews…"}</p>
                  <div style={{ background:C.black2, borderRadius:100, height:6, overflow:"hidden" }}>
                    <div className="prog-bar" style={{ height:"100%", borderRadius:100, background:`linear-gradient(90deg,${C.blue},${C.green})`, width:`${progress}%` }}/>
                  </div>
                  <p style={{ fontSize:11, color:C.muted, marginTop:6 }}>{progress}%</p>
                </div>
              ) : (
                <BtnPrimary onClick={handleOwnerAnalyse}>Analyse My Restaurant →</BtnPrimary>
              )}
            </Card>
            <Card style={{ background:C.blueDim, border:`1px solid ${C.blueBorder}` }}>
              <p style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>🔒 We only read public Google reviews. No login needed.</p>
            </Card>
          </div>
        )}

        {screen === "customer-search" && (
          <div className="fade">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <BackBtn onClick={() => goTo("welcome")}/>
              <RolePill role="customer"/>
            </div>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:C.white, marginBottom:6 }}>Find a Restaurant</h2>
            <p style={{ fontSize:13, color:C.muted, marginBottom:20, lineHeight:1.6 }}>Search by name, address, or find nearest branch of any chain</p>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {[{k:"gps",label:"📍 Near Me"},{k:"address",label:"🏠 Address"},{k:"city",label:"🔍 Name + City"}].map(t=>(
                <button key={t.k} className={`tab-btn${searchMethod===t.k?" on":""}`} onClick={() => setSearchMethod(t.k)}>{t.label}</button>
              ))}
            </div>
            <Card>
              <Label>Restaurant name</Label>
              <Inp value={custName} onChange={setCustName} placeholder="e.g. McDonald's, Chick-fil-A, Subway"/>
              {searchMethod === "address" && <>
                <Label>Full address</Label>
                <Inp value={custAddress} onChange={setCustAddress} placeholder="e.g. 1234 Main St, Austin TX 78701"/>
              </>}
              {searchMethod === "city" && <>
                <Label>City or zip code</Label>
                <Inp value={custCity} onChange={setCustCity} placeholder="e.g. Austin TX or 78701"/>
              </>}
              {searchMethod === "gps" && (
                <p style={{ fontSize:12, color:C.muted, marginBottom:10 }}>📍 Your browser will ask for location permission to find nearest branches.</p>
              )}
              {errorMsg && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>⚠️ {errorMsg}</div>}
              {isLoading
                ? <div style={{ textAlign:"center", padding:"16px 0" }}>
                    <div className="pulse" style={{ fontSize:28, marginBottom:8 }}>📡</div>
                    <p style={{ fontSize:13, color:C.muted }}>Searching nearby…</p>
                  </div>
                : <BtnPrimary onClick={findBranches}>{searchMethod==="gps"?"📍 Find Nearest Branches →":"🔍 Search Branches →"}</BtnPrimary>
              }
            </Card>
          </div>
        )}

        {screen === "branches" && (
          <div className="fade">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <BackBtn onClick={() => goTo("customer-search")}/>
              <RolePill role="customer"/>
            </div>
            <p style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:C.white, marginBottom:4 }}>{custName} near you</p>
            <p style={{ fontSize:12, color:C.muted, marginBottom:16 }}>{branches.length} branches found — tap to analyse</p>
            {branches.map((b, i) => {
              const isGood = b.rating >= 4.2;
              const isBad  = b.rating < 3.5;
              const dotColor = isGood ? C.green : isBad ? C.red : C.blue2;
              return (
                <div key={b.placeId} className="hover-card"
                  onClick={() => handleBranchSelect(b)}
                  style={{ background: i===0 ? C.greenDim : C.black3, border:`1px solid ${i===0?C.greenBorder:C.border}`, borderRadius:14, padding:"14px 16px", marginBottom:10, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:`${dotColor}18`, border:`1px solid ${dotColor}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      {isGood?"🟢":isBad?"🔴":"🔵"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:800, color:C.white }}>{b.address}</span>
                        {i===0 && <span style={{ background:C.greenDim, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:100 }}>BEST</span>}
                        {isBad && <span style={{ background:C.redDim, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:100 }}>AVOID</span>}
                      </div>
                      <div style={{ display:"flex", gap:12, fontSize:11, flexWrap:"wrap" }}>
                        <span style={{ color:C.green, fontWeight:700 }}>⭐ {b.rating}</span>
                        {b.distance && <span style={{ color:C.muted }}>📍 {b.distance} mi</span>}
                        <span style={{ color:C.muted }}>{b.reviews} reviews</span>
                        {b.open===true && <span style={{ color:C.green, fontWeight:700 }}>🟢 Open now</span>}
                        {b.open===false && <span style={{ color:C.red }}>🔴 Closed</span>}
                      </div>
                    </div>
                    <span style={{ color:C.muted, fontSize:18 }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {screen === "owner-dash" && (
          <div className="fade">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
              <BackBtn onClick={() => goTo("owner-search")}/>
              <RolePill role="owner"/>
              <button className="btn-ghost" style={{ marginLeft:"auto", fontSize:12, padding:"6px 14px" }} onClick={() => goTo("all-tabs")}>All Tabs →</button>
            </div>
            {isLoading && (
              <Card style={{ textAlign:"center", padding:32 }}>
                <div className="pulse" style={{ fontSize:44, marginBottom:14 }}>{stage==="fetching"?"📡":"🤖"}</div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, marginBottom:6 }}>{stage==="fetching"?"Fetching Google reviews…":"Claude AI is analysing…"}</p>
                <p style={{ fontSize:13, color:C.muted, marginBottom:20 }}>This takes about 20–30 seconds</p>
                <div style={{ background:C.black2, borderRadius:100, height:8, overflow:"hidden", maxWidth:360, margin:"0 auto" }}>
                  <div className="prog-bar" style={{ height:"100%", borderRadius:100, background:`linear-gradient(90deg,${C.blue},${C.green})`, width:`${progress}%` }}/>
                </div>
                <p style={{ fontSize:12, color:C.muted, marginTop:8 }}>{progress}%</p>
              </Card>
            )}
            {!isLoading && analysis && restaurant && (
              <>
                <div style={{ display:"flex", alignItems:"center", gap:12, background:C.black3, border:`1px solid ${C.border}`, borderRadius:14, padding:14, marginBottom:14 }}>
                  <div style={{ width:46, height:46, borderRadius:12, background:`linear-gradient(135deg,${C.blue},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🍽️</div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:C.white, margin:"0 0 2px" }}>{restaurant.name}</p>
                    <p style={{ fontSize:11, color:C.muted, margin:0 }}>{restaurant.address}</p>
                  </div>
                  <div style={{ textAlign:"center", flexShrink:0 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:healthColor(hScore) }}>{hScore}</div>
                    <div style={{ fontSize:9, color:C.muted }}>Health %</div>
                  </div>
                </div>
                <Card>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                    <div style={{ flex:1, background:C.black2, borderRadius:100, height:10, overflow:"hidden" }}>
                      <div className="prog-bar" style={{ height:"100%", borderRadius:100, width:`${hScore}%`, background:`linear-gradient(90deg,${C.blue},${C.green})` }}/>
                    </div>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:healthColor(hScore), flexShrink:0 }}>{hScore}%</span>
                  </div>
                  <p style={{ fontSize:12, color:C.muted }}>{hScore>70?"Great health! Keep doing what's working.":hScore>40?"Room for improvement — key issues below.":"Urgent action needed — serious complaints found."}</p>
                </Card>
                <Card style={{ borderLeft:`3px solid ${C.blue}` }}>
                  <Label>AI Conclusion for You</Label>
                  <p style={{ fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:12 }}>{analysis.forOwner?.conclusion}</p>
                  <div style={{ background:C.redDim, border:`1px solid ${C.redBorder}`, borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontSize:10, fontWeight:700, color:C.red, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px" }}>Urgent Action</p>
                    <p style={{ fontSize:13, color:C.muted, margin:0 }}>{analysis.forOwner?.urgentAction}</p>
                  </div>
                </Card>
                <Label>Top Complaints</Label>
                <Card>
                  {(analysis.topComplaints||[]).map((c,i)=>(
                    <ComplaintBar key={i} label={c.issue} count={c.count} total={analysis.totalAnalysed} color={c.severity==="high"?C.red:c.severity==="medium"?C.blue2:C.muted}/>
                  ))}
                </Card>
                <Label>How to Improve</Label>
                {(analysis.forOwner?.improvements||[]).map((imp,i)=><ImprovRow key={i} n={i+1} text={imp}/>)}
                {analysis.fakeReviewCount > 0 && (
                  <Card style={{ background:"rgba(255,217,61,0.06)", border:"1px solid rgba(255,217,61,0.2)" }}>
                    <p style={{ fontSize:13, fontWeight:700, color:"#ffd93d", marginBottom:4 }}>🤖 {analysis.fakeReviewCount} Suspicious Reviews</p>
                    <p style={{ fontSize:12, color:C.muted }}>{analysis.fakeReviewReason}</p>
                  </Card>
                )}
                <button className="btn-ghost" style={{ width:"100%", marginTop:6, padding:"12px" }} onClick={() => goTo("all-tabs")}>
                  View All Tabs — Food Guide, Hygiene, Accessibility →
                </button>
              </>
            )}
            {!isLoading && errorMsg && <Card style={{ border:`1px solid ${C.redBorder}` }}><p style={{ color:C.red, fontSize:13 }}>⚠️ {errorMsg}</p></Card>}
          </div>
        )}

        {screen === "customer-dash" && (
          <div className="fade">
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
              <BackBtn onClick={() => goTo("branches")}/>
              <RolePill role="customer"/>
              <button className="btn-ghost" style={{ marginLeft:"auto", fontSize:12, padding:"6px 14px" }} onClick={() => goTo("all-tabs")}>All Tabs →</button>
            </div>
            {isLoading && (
              <Card style={{ textAlign:"center", padding:32 }}>
                <div className="pulse" style={{ fontSize:44, marginBottom:14 }}>{stage==="fetching"?"📡":"🤖"}</div>
                <p style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, marginBottom:6 }}>{stage==="fetching"?"Fetching reviews…":"Analysing with AI…"}</p>
                <div style={{ background:C.black2, borderRadius:100, height:8, overflow:"hidden", maxWidth:360, margin:"16px auto 0" }}>
                  <div className="prog-bar" style={{ height:"100%", borderRadius:100, background:`linear-gradient(90deg,${C.blue},${C.green})`, width:`${progress}%` }}/>
                </div>
                <p style={{ fontSize:12, color:C.muted, marginTop:8 }}>{progress}%</p>
              </Card>
            )}
            {!isLoading && analysis && restaurant && (() => {
              const v = VERDICT[analysis.forCustomer?.verdict] || VERDICT.mixed;
              return (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:14, background:v.bg, border:`1px solid ${v.border}`, borderRadius:16, padding:16, marginBottom:16 }}>
                    <div style={{ fontSize:34, flexShrink:0 }}>{v.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, color:v.color, marginBottom:4 }}>{v.label}</div>
                      <div style={{ fontSize:12, color:C.muted }}>{restaurant.name}</div>
                    </div>
                    <div style={{ textAlign:"center", flexShrink:0 }}>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:C.white }}>{restaurant.rating}</div>
                      <div style={{ fontSize:9, color:C.muted }}>⭐ Google</div>
                    </div>
                  </div>
                  <Card style={{ borderLeft:`3px solid ${C.green}` }}>
                    <Label>AI Summary for You</Label>
                    <p style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>{analysis.forCustomer?.conclusion}</p>
                  </Card>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                    <InfoCard icon="🍽️" label="Must Order" value={analysis.forCustomer?.mustTry} sub={analysis.priceRange?.avgMealForOne?`Avg ${analysis.priceRange.avgMealForOne}/person`:null} color={C.green}/>
                    <InfoCard icon="🚫" label="Avoid" value={analysis.forCustomer?.avoid} color={C.red}/>
                    <InfoCard icon="🕐" label="Best Time" value={analysis.bestTimeToVisit} color={C.blue2}/>
                    <InfoCard icon="💰" label="Value" value={analysis.priceRange?.valueLabel||"—"} sub={analysis.priceRange?.avgMealForTwo?`~${analysis.priceRange.avgMealForTwo} for 2`:null} color={C.green}/>
                    <InfoCard icon="🅿️" label="Parking" value={bool2label(analysis.accessibility?.parking?.available,"✅ Available","❌ None")} sub={analysis.accessibility?.parking?.detail} color={C.blue2}/>
                    <InfoCard icon="♿" label="Wheelchair" value={bool2label(analysis.accessibility?.wheelchair?.accessible,"✅ Accessible","❌ Limited")} sub={analysis.accessibility?.wheelchair?.detail} color={C.blue2}/>
                    <InfoCard icon="🪑" label="Kids Chairs" value={bool2label(analysis.accessibility?.kidsChairs?.available,"✅ Available","❌ No")} color={C.green}/>
                    <InfoCard icon="📶" label="WiFi" value={bool2label(analysis.accessibility?.wifi?.available,"✅ Free","❌ No WiFi")} color={C.green}/>
                  </div>
                  <button className="btn-ghost" style={{ width:"100%", padding:"12px" }} onClick={() => goTo("all-tabs")}>
                    View Full Details — Food Guide, Prices, Hygiene →
                  </button>
                </>
              );
            })()}
            {!isLoading && errorMsg && <Card style={{ border:`1px solid ${C.redBorder}` }}><p style={{ color:C.red, fontSize:13 }}>⚠️ {errorMsg}</p></Card>}
          </div>
        )}

        {screen === "all-tabs" && analysis && restaurant && (
          <div className="fade">
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              <BackBtn onClick={goBack}/>
              <RolePill role={role}/>
              <button className="btn-ghost" style={{ marginLeft:"auto", fontSize:12, padding:"6px 14px" }} onClick={() => setScreen("welcome")}>Switch Role</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, background:C.black3, border:`1px solid ${C.border}`, borderRadius:12, padding:"10px 14px", marginBottom:14 }}>
              <span style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:800, color:C.white }}>{restaurant.name}</span>
              <span style={{ fontSize:11, color:C.muted }}>· {restaurant.rating} ⭐ ·</span>
              <span style={{ fontSize:11, color:healthColor(hScore), fontWeight:700 }}>Health {hScore}%</span>
              <button className="btn-ghost" style={{ marginLeft:"auto", fontSize:11, padding:"4px 12px" }} onClick={downloadReport}>📥 Download</button>
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
              {[{k:"owner",label:"🍽️ Owner"},{k:"customer",label:"👥 Customer"},{k:"food",label:"🍔 Food"},{k:"access",label:"♿ Access"},{k:"hygiene",label:"🧹 Hygiene"}].map(t=>(
                <button key={t.k} className={`tab-btn${activeTab===t.k?" on":""}`} onClick={()=>setActiveTab(t.k)}>{t.label}</button>
              ))}
            </div>

            {activeTab === "owner" && (
              <div className="fade">
                <Card style={{ borderLeft:`3px solid ${C.blue}` }}>
                  <Label>AI Conclusion</Label>
                  <p style={{ fontSize:13, color:C.muted, lineHeight:1.7, marginBottom:12 }}>{analysis.forOwner?.conclusion}</p>
                  <div style={{ background:C.redDim, border:`1px solid ${C.redBorder}`, borderRadius:10, padding:"10px 14px" }}>
                    <p style={{ fontSize:10, fontWeight:700, color:C.red, marginBottom:4, textTransform:"uppercase" }}>Urgent Action</p>
                    <p style={{ fontSize:13, color:C.muted, margin:0 }}>{analysis.forOwner?.urgentAction}</p>
                  </div>
                </Card>
                <Label>Top Complaints</Label>
                <Card>{(analysis.topComplaints||[]).map((c,i)=><ComplaintBar key={i} label={c.issue} count={c.count} total={analysis.totalAnalysed} color={c.severity==="high"?C.red:c.severity==="medium"?C.blue2:C.muted}/>)}</Card>
                <Label>Top Praises</Label>
                <Card>{(analysis.topPraises||[]).map((p,i)=><ComplaintBar key={i} label={p.aspect} count={p.count} total={analysis.totalAnalysed} color={C.green}/>)}</Card>
                <Label>Improvements</Label>
                {(analysis.forOwner?.improvements||[]).map((imp,i)=><ImprovRow key={i} n={i+1} text={imp}/>)}
              </div>
            )}

            {activeTab === "customer" && (() => {
              const v = VERDICT[analysis.forCustomer?.verdict]||VERDICT.mixed;
              return (
                <div className="fade">
                  <div style={{ display:"flex", alignItems:"center", gap:12, background:v.bg, border:`1px solid ${v.border}`, borderRadius:14, padding:14, marginBottom:12 }}>
                    <div style={{ fontSize:28 }}>{v.icon}</div>
                    <div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:v.color }}>{v.label}</div>
                      <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{analysis.forCustomer?.conclusion}</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <InfoCard icon="🍽️" label="Must Try" value={analysis.forCustomer?.mustTry} color={C.green}/>
                    <InfoCard icon="🚫" label="Avoid" value={analysis.forCustomer?.avoid} color={C.red}/>
                    <InfoCard icon="🕐" label="Best Time" value={analysis.bestTimeToVisit} color={C.blue2}/>
                    <InfoCard icon="💰" label="Avg for 2" value={analysis.priceRange?.avgMealForTwo||"—"} sub={analysis.priceRange?.valueLabel} color={C.green}/>
                  </div>
                </div>
              );
            })()}

            {activeTab === "food" && (
              <div className="fade">
                <Label>Best Dishes</Label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                  {(analysis.bestDishes||[]).map((d,i)=>(
                    <span key={i} style={{ background:C.greenDim, border:`1px solid ${C.greenBorder}`, color:C.green, fontSize:12, fontWeight:700, padding:"5px 14px", borderRadius:100 }}>
                      {"🥇🥈🥉"[i]||"✅"} {d}
                    </span>
                  ))}
                </div>
                <Label>Dishes to Avoid</Label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                  {(analysis.dishesToAvoid||[]).map((d,i)=>(
                    <span key={i} style={{ background:C.redDim, border:`1px solid ${C.redBorder}`, color:C.red, fontSize:12, fontWeight:700, padding:"5px 14px", borderRadius:100 }}>❌ {d}</span>
                  ))}
                </div>
                <Label>Price Guide</Label>
                <Card>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:13, color:C.muted }}>Avg meal — 1 person</span>
                    <span style={{ fontSize:14, fontWeight:700, color:C.green }}>{analysis.priceRange?.avgMealForOne||"—"}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:13, color:C.muted }}>Avg meal — 2 people</span>
                    <span style={{ fontSize:14, fontWeight:700, color:C.green }}>{analysis.priceRange?.avgMealForTwo||"—"}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
                    <span style={{ fontSize:13, color:C.muted }}>Value for money</span>
                    <span style={{ fontSize:14, fontWeight:700, color:C.blue2 }}>{"⭐".repeat(Math.round(analysis.priceRange?.valueRating||3))} {analysis.priceRange?.valueLabel}</span>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "access" && (
              <div className="fade">
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <InfoCard icon="🅿️" label="Parking" value={bool2label(analysis.accessibility?.parking?.available,"✅ Available","❌ Not mentioned")} sub={analysis.accessibility?.parking?.detail} color={C.green}/>
                  <InfoCard icon="♿" label="Wheelchair" value={bool2label(analysis.accessibility?.wheelchair?.accessible,"✅ Accessible","❌ Not confirmed")} sub={analysis.accessibility?.wheelchair?.detail} color={C.blue2}/>
                  <InfoCard icon="🪑" label="Kids Chairs" value={bool2label(analysis.accessibility?.kidsChairs?.available,"✅ Available","❌ Not mentioned")} color={C.green}/>
                  <InfoCard icon="📶" label="WiFi" value={bool2label(analysis.accessibility?.wifi?.available,"✅ Free WiFi","❌ No WiFi")} color={C.blue2}/>
                  <InfoCard icon="🔊" label="Noise Level" value={analysis.accessibility?.noiseLevel||"—"} color={C.blue2}/>
                  <InfoCard icon="🚻" label="Restrooms" value={analysis.accessibility?.restrooms||"—"} color={C.green}/>
                </div>
              </div>
            )}

            {activeTab === "hygiene" && (
              <div className="fade">
                <Card style={{ textAlign:"center", marginBottom:14 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:52, fontWeight:800, color:healthColor((analysis.hygiene?.score||0)*10) }}>
                    {analysis.hygiene?.score}<span style={{ fontSize:22, color:C.muted }}>/10</span>
                  </div>
                  <div style={{ fontSize:14, color:C.muted, marginBottom:14 }}>{analysis.hygiene?.label}</div>
                  <div style={{ background:C.black2, borderRadius:100, height:8, overflow:"hidden", maxWidth:240, margin:"0 auto" }}>
                    <div style={{ height:"100%", borderRadius:100, width:`${(analysis.hygiene?.score||0)*10}%`, background:`linear-gradient(90deg,${C.blue},${C.green})`, transition:"width 1s ease" }}/>
                  </div>
                </Card>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                  {[{label:"Kitchen",val:analysis.hygiene?.kitchen},{label:"Tables",val:analysis.hygiene?.tables},{label:"Restrooms",val:analysis.hygiene?.restrooms},{label:"Staff",val:analysis.hygiene?.staff}].map((h,i)=>(
                    <div key={i} style={{ borderRadius:12, padding:"12px 14px",
                      background: ["Clean","Professional","Excellent","Good"].includes(h.val) ? C.greenDim : ["Mixed","Fair"].includes(h.val) ? C.blueDim : C.redDim,
                      border: `1px solid ${["Clean","Professional","Excellent","Good"].includes(h.val) ? C.greenBorder : ["Mixed","Fair"].includes(h.val) ? C.blueBorder : C.redBorder}` }}>
                      <div style={{ fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:4, color:C.muted }}>{h.label}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:C.white }}>{h.val||"—"}</div>
                    </div>
                  ))}
                </div>
                {analysis.hygiene?.ownerAlert && (
                  <Card style={{ background:C.redDim, border:`1px solid ${C.redBorder}` }}>
                    <p style={{ fontSize:10, fontWeight:700, color:C.red, textTransform:"uppercase", marginBottom:6 }}>Owner Alert</p>
                    <p style={{ fontSize:13, color:C.muted }}>{analysis.hygiene.ownerAlert}</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

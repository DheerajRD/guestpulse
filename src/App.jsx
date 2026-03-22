import { useState } from "react";

const C = {
  black:"#07090f",black2:"#0d1117",black3:"#161b27",
  green:"#00e676",green2:"#00c853",greenDim:"rgba(0,230,118,0.1)",greenBorder:"rgba(0,230,118,0.22)",
  blue:"#2979ff",blue2:"#448aff",blueDim:"rgba(41,121,255,0.1)",blueBorder:"rgba(41,121,255,0.22)",
  red:"#ff5252",redDim:"rgba(255,82,82,0.08)",redBorder:"rgba(255,82,82,0.2)",
  white:"#e8eaf6",muted:"rgba(232,234,246,0.45)",border:"rgba(232,234,246,0.07)",
};
const healthColor=s=>s>70?C.green:s>40?C.blue2:C.red;
const bool2label=(v,yes="Yes",no="No")=>v===true?"✅ "+yes:v===false?"❌ "+no:"—";
const VERDICT={
  recommended:{color:C.green,bg:C.greenDim,border:C.greenBorder,icon:"✅",label:"Recommended"},
  mixed:{color:C.blue2,bg:C.blueDim,border:C.blueBorder,icon:"⚡",label:"Mixed Reviews"},
  avoid:{color:C.red,bg:C.redDim,border:C.redBorder,icon:"🚫",label:"Avoid For Now"},
};
function fixAnalysis(raw,count){
  if(!raw||typeof raw!=="object")return null;
  const a=(raw.analysis&&typeof raw.analysis==="object")?raw.analysis:raw;
  if(!a.healthScore||a.healthScore===0)a.healthScore=50;
  a.totalAnalysed=count||a.totalAnalysed||0;
  if(!a.sentiment)a.sentiment={positive:0,neutral:0,negative:0};
  if(!a.topComplaints)a.topComplaints=[];
  if(!a.topPraises)a.topPraises=[];
  if(!a.bestDishes)a.bestDishes=[];
  if(!a.dishesToAvoid)a.dishesToAvoid=[];
  if(!a.priceRange)a.priceRange={avgMealForOne:"—",avgMealForTwo:"—",valueRating:3,valueLabel:"Fair"};
  if(!a.bestTimeToVisit)a.bestTimeToVisit="Weekday lunch";
  if(!a.forOwner)a.forOwner={conclusion:"Reviews show mixed experiences.",urgentAction:"Review feedback",improvements:["Improve service","Maintain quality","Respond to reviews"]};
  if(!a.forCustomer)a.forCustomer={conclusion:"Mixed experiences.",mustTry:"Ask staff",avoid:"Peak hours",verdict:"mixed"};
  if(!a.hygiene)a.hygiene={score:7,label:"Good",kitchen:"Unknown",tables:"Unknown",staff:"Unknown",restrooms:"Unknown",ownerAlert:null};
  if(!a.accessibility)a.accessibility={parking:{available:null,detail:null},wheelchair:{accessible:null,detail:null},kidsChairs:{available:null,detail:null},wifi:{available:null,detail:null},noiseLevel:null,restrooms:null};
  if(!a.fakeReviewCount)a.fakeReviewCount=0;
  return a;
}
const Card=({children,style={}})=><div style={{background:C.black3,border:`1px solid ${C.border}`,borderRadius:16,padding:16,marginBottom:12,...style}}>{children}</div>;
const Lbl=({children})=><p style={{fontSize:10,fontWeight:700,color:"rgba(232,234,246,0.3)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:10}}>{children}</p>;
const BackBtn=({onClick})=><button onClick={onClick} style={{display:"flex",alignItems:"center",gap:6,background:C.black3,border:`1px solid ${C.border}`,borderRadius:9,padding:"6px 14px",fontSize:12,fontWeight:700,color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>← Back</button>;
const InfoCard=({icon,label,value,sub,color})=><div style={{borderRadius:12,padding:"12px 14px",background:`${color}10`,border:`1px solid ${color}25`}}><div style={{fontSize:20,marginBottom:6}}>{icon}</div><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",color,marginBottom:4,opacity:0.7}}>{label}</div><div style={{fontSize:13,fontWeight:700,color:C.white}}>{value||"—"}</div>{sub&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>{sub}</div>}</div>;
const Bar=({label,count,total,color})=><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><span style={{fontSize:12,color:C.muted,width:110,flexShrink:0}}>{label}</span><div style={{flex:1,background:"rgba(232,234,246,0.06)",borderRadius:100,height:5,overflow:"hidden"}}><div style={{height:"100%",borderRadius:100,background:color,width:`${Math.min((count/Math.max(total,1))*300,100)}%`,transition:"width 1s ease"}}/></div><span style={{fontSize:12,fontWeight:700,color,width:26,textAlign:"right"}}>{count}</span></div>;
const ImpRow=({n,text})=><div style={{display:"flex",gap:10,alignItems:"flex-start",background:C.black3,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",marginBottom:8}}><div style={{width:22,height:22,borderRadius:"50%",background:`linear-gradient(135deg,${C.blue},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:C.black,flexShrink:0}}>{n}</div><p style={{fontSize:12,color:C.muted,lineHeight:1.6,margin:0}}>{text}</p></div>;

const EmailSection=({analysis,restaurant,showToast})=>{
  const [ae,setAe]=useState("");const [re,setRe]=useState("");const [st,setSt]=useState("idle");const [msg,setMsg]=useState("");
  const send=async(type,email)=>{
    if(!email.trim()){setMsg("Please enter your email.");return;}
    if(!email.includes("@")){setMsg("Please enter a valid email.");return;}
    setSt("sending");setMsg("");
    try{
      const r=await fetch("/api/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,email:email.trim(),restaurantName:restaurant?.name,analysis,restaurant})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Failed");
      setSt("sent");setMsg(type==="alert"?"✅ Alert sent! Check inbox.":"✅ Report sent! Check inbox.");
      showToast(type==="alert"?"🚨 Alert sent!":"📊 Report sent!");
    }catch(e){setSt("error");setMsg("⚠️ "+(e.message||"Failed"));}
  };
  return(
    <Card style={{marginTop:12}}>
      <Lbl>📧 Email Notifications</Lbl>
      <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <p style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:4}}>🚨 Review Alert</p>
        <p style={{fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.5}}>Get emailed instantly when a bad review appears.</p>
        <div style={{display:"flex",gap:8}}>
          <input value={ae} onChange={e=>setAe(e.target.value)} placeholder="your@email.com" style={{flex:1,background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.white,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={()=>send("alert",ae)} disabled={st==="sending"} style={{background:`linear-gradient(135deg,${C.red},#ff1744)`,border:"none",borderRadius:10,padding:"0 16px",fontSize:12,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",opacity:st==="sending"?0.6:1}}>{st==="sending"?"…":"Send 🚨"}</button>
        </div>
      </div>
      <div>
        <p style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:4}}>📊 Weekly Report</p>
        <p style={{fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.5}}>Get full AI analysis sent to your email.</p>
        <div style={{display:"flex",gap:8}}>
          <input value={re} onChange={e=>setRe(e.target.value)} placeholder="your@email.com" style={{flex:1,background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.white,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={()=>send("report",re)} disabled={st==="sending"} style={{background:`linear-gradient(135deg,${C.blue},${C.green})`,border:"none",borderRadius:10,padding:"0 16px",fontSize:12,fontWeight:700,color:C.black,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",opacity:st==="sending"?0.6:1}}>{st==="sending"?"…":"Send 📊"}</button>
        </div>
      </div>
      {msg&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,fontSize:13,background:st==="sent"?C.greenDim:C.redDim,border:`1px solid ${st==="sent"?C.greenBorder:C.redBorder}`,color:st==="sent"?C.green:C.red}}>{msg}</div>}
    </Card>
  );
};

export default function App(){
  const [screen,setScreen]=useState("welcome");
  const [prev,setPrev]=useState("welcome");
  const [role,setRole]=useState("owner");
  const [tab,setTab]=useState("owner");
  const [sm,setSm]=useState("gps");
  const [ownerUrl,setOwnerUrl]=useState("");
  const [custName,setCustName]=useState("");
  const [custAddr,setCustAddr]=useState("");
  const [custCity,setCustCity]=useState("");
  const [directUrl,setDirectUrl]=useState("");
  const [restaurant,setRestaurant]=useState(null);
  const [analysis,setAnalysis]=useState(null);
  const [branches,setBranches]=useState([]);
  const [stage,setStage]=useState("idle");
  const [progress,setProgress]=useState(0);
  const [progressMsg,setProgressMsg]=useState("");
  const [err,setErr]=useState("");
  const [toast,setToast]=useState(null);

  const showToast=(msg,color=C.green)=>{setToast({msg,color});setTimeout(()=>setToast(null),2800);};
  const goTo=s=>{setPrev(screen);setScreen(s);setErr("");};
  const goBack=()=>{setScreen(prev);setErr("");};

  const runAnalysis=async(placeUrl,placeId)=>{
    setErr("");setRestaurant(null);setAnalysis(null);
    try{
      setStage("fetching");setProgress(10);setProgressMsg("Connecting to Google Maps...");
      await new Promise(r=>setTimeout(r,300));
      setProgress(25);setProgressMsg("Finding restaurant...");
      const r1=await fetch("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({placeUrl,placeId})});
      const t1=await r1.text();
      let d1;try{d1=JSON.parse(t1);}catch(e){throw new Error("Server error: "+t1.substring(0,100));}
      if(!r1.ok)throw new Error(d1.error||"Failed to fetch reviews");
      if(!d1.reviews||d1.reviews.length===0)throw new Error("No reviews found.");
      setRestaurant(d1.restaurant);
      setProgress(55);setProgressMsg("Reading "+d1.reviews.length+" recent reviews...");
      await new Promise(r=>setTimeout(r,200));
      setStage("analysing");setProgress(70);setProgressMsg("Claude AI is finding patterns...");
      const r2=await fetch("/api/analyse",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reviews:d1.reviews,restaurantName:d1.restaurant.name})});
      const t2=await r2.text();
      let d2;try{d2=JSON.parse(t2);}catch(e){throw new Error("Analysis error: "+t2.substring(0,100));}
      if(!r2.ok)throw new Error(d2.error||"Analysis failed");
      const fixed=fixAnalysis(d2,d1.reviews.length);
      if(!fixed)throw new Error("Empty analysis data.");
      setProgress(100);setProgressMsg("Done!");
      await new Promise(r=>setTimeout(r,300));
      setAnalysis(fixed);setStage("done");
    }catch(e){
      setErr(e.message||"Something went wrong.");
      setStage("error");setProgress(0);
    }
  };

  const handleOwner=async()=>{
    if(!ownerUrl.trim()){setErr("Please paste your Google Maps URL.");return;}
    goTo("loading");
    await runAnalysis(ownerUrl.trim(),null);
    goTo("owner-dash");
  };
  const handleDirect=async()=>{
    if(!directUrl.trim()){setErr("Please paste a Google Maps URL.");return;}
    goTo("loading");
    await runAnalysis(directUrl.trim(),null);
    goTo(role==="owner"?"owner-dash":"customer-dash");
  };
  const findBranches=async()=>{
    if(!custName.trim()){setErr("Please enter a restaurant name.");return;}
    setErr("");setBranches([]);setStage("searching");
    try{
      let lat,lng;
      if(sm==="gps"){try{const p=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000}));lat=p.coords.latitude;lng=p.coords.longitude;}catch{}}
      const r=await fetch("/api/nearby",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:custName.trim(),lat,lng,address:custAddr.trim(),city:custCity.trim()})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Search failed");
      setBranches(d.branches||[]);setStage("done");goTo("branches");
    }catch(e){setErr(e.message);setStage("error");}
  };
  const selectBranch=async b=>{goTo("loading");await runAnalysis(null,b.placeId);goTo("customer-dash");};

  const downloadReport=()=>{
    if(!analysis||!restaurant)return;
    const v=VERDICT[analysis.forCustomer?.verdict]||VERDICT.mixed;
    const lines=["GUESTPULSE AI — FULL REPORT","","Generated: "+new Date().toLocaleString(),"Restaurant: "+restaurant.name,"Rating: "+restaurant.rating+" ("+restaurant.totalReviews+" total)","Analysed: "+analysis.totalAnalysed+" recent reviews","","HEALTH SCORE: "+analysis.healthScore+"/100","","FOR OWNER:",analysis.forOwner?.conclusion||"","URGENT: "+(analysis.forOwner?.urgentAction||""),"","IMPROVEMENTS:",...(analysis.forOwner?.improvements||[]).map((x,i)=>(i+1)+". "+x),"","TOP COMPLAINTS:",...(analysis.topComplaints||[]).map(c=>"- "+c.issue+" ("+c.count+")"),"","FOR CUSTOMER:","Verdict: "+v.label,analysis.forCustomer?.conclusion||"","Must Try: "+(analysis.forCustomer?.mustTry||"—"),"Avoid: "+(analysis.forCustomer?.avoid||"—"),"","BEST DISHES: "+(analysis.bestDishes||[]).join(", "),"PRICE (1 person): "+(analysis.priceRange?.avgMealForOne||"—"),"PRICE (2 people): "+(analysis.priceRange?.avgMealForTwo||"—"),"","Report by GuestPulse AI"];
    const blob=new Blob([lines.join("\n")],{type:"text/plain"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=restaurant.name+"-guestpulse.txt";a.click();
    showToast("Report downloaded!");
  };

  const hs=analysis?.healthScore||0;

  return(
    <div style={{minHeight:"100vh",background:C.black,color:C.white,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1e2535;border-radius:4px}
        .syne{font-family:'Syne',sans-serif}
        .fade{animation:fu .4s ease}@keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pl 1.8s ease-in-out infinite}@keyframes pl{0%,100%{opacity:1}50%{opacity:.35}}
        .prog{transition:width .4s ease}
        .bmain{width:100%;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#2979ff,#00e676);color:#07090f;font-size:14px;font-weight:800;cursor:pointer;font-family:'Syne',sans-serif;transition:transform .15s}
        .bmain:hover{transform:translateY(-2px)}
        .bghost{cursor:pointer;border:1px solid rgba(232,234,246,0.07);background:#161b27;color:rgba(232,234,246,0.45);border-radius:10px;padding:8px 16px;font-size:13px;font-weight:700;font-family:inherit;transition:all .15s}
        .bghost:hover{border-color:rgba(41,121,255,0.3);color:#448aff}
        .rcard{cursor:pointer;border-radius:18px;padding:22px 18px;text-align:center;transition:all .2s;border:2px solid transparent}
        .rcard:hover{transform:translateY(-4px)}
        .tbtn{cursor:pointer;border:1px solid rgba(232,234,246,0.07);background:transparent;color:rgba(232,234,246,0.4);border-radius:9px;padding:7px 14px;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;white-space:nowrap}
        .tbtn.on{background:rgba(0,230,118,0.1);border-color:rgba(0,230,118,0.22);color:#00e676}
        .hup{transition:all .18s}.hup:hover{transform:translateX(3px);border-color:rgba(41,121,255,0.3)!important}
        input{outline:none}input:focus{border-color:#2979ff!important}
      `}</style>

      {toast&&<div style={{position:"fixed",top:20,right:20,zIndex:9999,background:toast.color,color:C.black,padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,.5)",animation:"fu .3s ease"}}>{toast.msg}</div>}

      <nav style={{background:C.black2,borderBottom:`1px solid ${C.border}`,padding:"13px 22px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>goTo("welcome")}>
          <div style={{width:32,height:32,borderRadius:9,background:`linear-gradient(135deg,${C.blue},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💓</div>
          <span className="syne" style={{fontSize:17,fontWeight:800,background:`linear-gradient(135deg,${C.blue2},${C.green})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>GuestPulse</span>
          <span style={{fontSize:11,color:C.blue2,fontWeight:700,background:C.blueDim,border:`1px solid ${C.blueBorder}`,padding:"2px 8px",borderRadius:100}}>AI</span>
        </div>
        {analysis&&restaurant&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:healthColor(hs),fontWeight:700,background:`${healthColor(hs)}12`,border:`1px solid ${healthColor(hs)}25`,padding:"4px 12px",borderRadius:100}}>💚 {hs}%</span>
            <button className="bghost" style={{padding:"5px 12px",fontSize:11}} onClick={downloadReport}>📥</button>
          </div>
        )}
      </nav>

      <div style={{maxWidth:680,margin:"0 auto",padding:"28px 18px 80px"}}>

        {screen==="welcome"&&(
          <div className="fade">
            <div style={{textAlign:"center",marginBottom:36,paddingTop:20}}>
              <div style={{width:76,height:76,borderRadius:22,background:`linear-gradient(135deg,${C.blue},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px"}}>💓</div>
              <h1 className="syne" style={{fontSize:34,fontWeight:800,color:C.white,marginBottom:10,lineHeight:1.2}}>
                Know your restaurant<br/>
                <span style={{background:`linear-gradient(135deg,${C.blue2},${C.green})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>in 60 seconds</span>
              </h1>
              <p style={{fontSize:15,color:C.muted,maxWidth:360,margin:"0 auto",lineHeight:1.7}}>Paste any Google Maps link. Our AI reads every recent review and tells you exactly what to fix and what customers love.</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div className="rcard" style={{background:C.blueDim,borderColor:C.blueBorder}} onClick={()=>{setRole("owner");goTo("owner-search");}}>
                <div style={{fontSize:40,marginBottom:10}}>🍽️</div>
                <div className="syne" style={{fontSize:15,fontWeight:800,color:C.white,marginBottom:6}}>Restaurant Owner</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:14}}>Fix issues, improve your rating</div>
                <div style={{background:`linear-gradient(135deg,${C.blue},${C.blue2})`,borderRadius:10,padding:"9px",fontSize:13,fontWeight:800,color:"#fff"}}>I'm an Owner →</div>
              </div>
              <div className="rcard" style={{background:C.greenDim,borderColor:C.greenBorder}} onClick={()=>{setRole("customer");goTo("customer-search");}}>
                <div style={{fontSize:40,marginBottom:10}}>👥</div>
                <div className="syne" style={{fontSize:15,fontWeight:800,color:C.white,marginBottom:6}}>Customer</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:14}}>Find best dishes nearby</div>
                <div style={{background:`linear-gradient(135deg,${C.green2},${C.green})`,borderRadius:10,padding:"9px",fontSize:13,fontWeight:800,color:C.black}}>I'm a Customer →</div>
              </div>
            </div>
            <Card>
              <Lbl>Or paste a Google Maps URL directly</Lbl>
              <input value={directUrl} onChange={e=>setDirectUrl(e.target.value)} placeholder="https://maps.google.com/maps/place/..." style={{width:"100%",background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.white,fontSize:14,fontFamily:"inherit",marginBottom:10}}/>
              {err&&<div style={{color:C.red,fontSize:13,marginBottom:10}}>⚠️ {err}</div>}
              <button className="bmain" onClick={handleDirect}>🔍 Analyse Now →</button>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:16}}>
              {[{e:"🤖",t:"AI powered",d:"Claude reads every review"},{e:"⚡",t:"60 seconds",d:"Fast analysis always"},{e:"🎯",t:"Actionable",d:"Know exactly what to fix"}].map((f,i)=>(
                <div key={i} style={{background:C.black3,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:6}}>{f.e}</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:3}}>{f.t}</div>
                  <div style={{fontSize:11,color:C.muted}}>{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen==="owner-search"&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <BackBtn onClick={()=>goTo("welcome")}/>
              <span style={{background:C.blueDim,border:`1px solid ${C.blueBorder}`,color:C.blue2,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:100}}>🍽️ Owner Mode</span>
            </div>
            <h2 className="syne" style={{fontSize:24,fontWeight:800,color:C.white,marginBottom:6}}>Analyse Your Restaurant</h2>
            <p style={{fontSize:13,color:C.muted,marginBottom:24,lineHeight:1.6}}>Paste your Google Maps link — we read your recent reviews and tell you exactly what to fix</p>
            <Card>
              <Lbl>Your Google Maps URL</Lbl>
              <input value={ownerUrl} onChange={e=>setOwnerUrl(e.target.value)} placeholder="https://maps.google.com/maps/place/your-restaurant..." style={{width:"100%",background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.white,fontSize:14,fontFamily:"inherit",marginBottom:12}}/>
              {err&&<div style={{color:C.red,fontSize:13,marginBottom:10}}>⚠️ {err}</div>}
              <button className="bmain" onClick={handleOwner}>Analyse My Restaurant →</button>
            </Card>
            <Card style={{background:C.blueDim,border:`1px solid ${C.blueBorder}`}}>
              <p style={{fontSize:12,color:C.muted,lineHeight:1.6}}>🔒 We read public Google reviews only. No login needed. Results in 30–60 seconds.</p>
            </Card>
          </div>
        )}

        {screen==="customer-search"&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <BackBtn onClick={()=>goTo("welcome")}/>
              <span style={{background:C.greenDim,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:100}}>👥 Customer Mode</span>
            </div>
            <h2 className="syne" style={{fontSize:24,fontWeight:800,color:C.white,marginBottom:6}}>Find a Restaurant</h2>
            <p style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.6}}>Search by name or paste a Google Maps link</p>
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {[{k:"gps",l:"📍 Near Me"},{k:"address",l:"🏠 Address"},{k:"city",l:"🔍 Name+City"}].map(t=>(
                <button key={t.k} className={`tbtn${sm===t.k?" on":""}`} onClick={()=>setSm(t.k)}>{t.l}</button>
              ))}
            </div>
            <Card>
              <Lbl>Restaurant name</Lbl>
              <input value={custName} onChange={e=>setCustName(e.target.value)} placeholder="e.g. McDonald's, Chick-fil-A..." style={{width:"100%",background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.white,fontSize:14,fontFamily:"inherit",marginBottom:10}}/>
              {sm==="address"&&<><Lbl>Full address</Lbl><input value={custAddr} onChange={e=>setCustAddr(e.target.value)} placeholder="e.g. 1234 Main St, Austin TX" style={{width:"100%",background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.white,fontSize:14,fontFamily:"inherit",marginBottom:10}}/></>}
              {sm==="city"&&<><Lbl>City or zip</Lbl><input value={custCity} onChange={e=>setCustCity(e.target.value)} placeholder="e.g. Austin TX or 78701" style={{width:"100%",background:C.black2,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 16px",color:C.white,fontSize:14,fontFamily:"inherit",marginBottom:10}}/></>}
              {sm==="gps"&&<p style={{fontSize:12,color:C.muted,marginBottom:10}}>📍 Browser will ask for location permission.</p>}
              {err&&<div style={{color:C.red,fontSize:13,marginBottom:10}}>⚠️ {err}</div>}
              <button className="bmain" onClick={findBranches} style={{background:`linear-gradient(135deg,${C.green2},${C.green})`,color:C.black}}>
                {sm==="gps"?"📍 Find Nearest Branches →":"🔍 Search Branches →"}
              </button>
            </Card>
          </div>
        )}

        {screen==="loading"&&(
          <div className="fade" style={{textAlign:"center",paddingTop:60}}>
            <div className="pulse" style={{fontSize:64,marginBottom:20}}>{stage==="fetching"?"📡":"🤖"}</div>
            <h2 className="syne" style={{fontSize:22,fontWeight:800,color:C.white,marginBottom:8}}>{stage==="fetching"?"Reading your reviews...":"Claude AI is analysing..."}</h2>
            <p style={{fontSize:13,color:C.muted,marginBottom:28,lineHeight:1.6}}>{progressMsg||"Please wait 30–60 seconds"}</p>
            <div style={{background:C.black3,borderRadius:100,height:8,overflow:"hidden",maxWidth:360,margin:"0 auto 10px"}}>
              <div className="prog" style={{height:"100%",borderRadius:100,background:`linear-gradient(90deg,${C.blue},${C.green})`,width:`${progress}%`}}/>
            </div>
            <p style={{fontSize:12,color:C.muted}}>{progress}%</p>
            {err&&(
              <div style={{marginTop:20,padding:"12px 16px",borderRadius:12,background:C.redDim,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:13}}>
                ⚠️ {err}<br/>
                <button className="bghost" style={{marginTop:10,fontSize:12}} onClick={()=>goTo(role==="owner"?"owner-search":"customer-search")}>← Try Again</button>
              </div>
            )}
          </div>
        )}

        {screen==="branches"&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <BackBtn onClick={()=>goTo("customer-search")}/>
              <span style={{background:C.greenDim,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:100}}>👥 Customer Mode</span>
            </div>
            <p className="syne" style={{fontSize:18,fontWeight:800,color:C.white,marginBottom:4}}>{custName} near you</p>
            <p style={{fontSize:12,color:C.muted,marginBottom:16}}>{branches.length} branches found — tap to analyse</p>
            {branches.map((b,i)=>{
              const g=b.rating>=4.2,bd=b.rating<3.5,dc=g?C.green:bd?C.red:C.blue2;
              return(
                <div key={b.placeId} className="hup" onClick={()=>selectBranch(b)}
                  style={{background:i===0?C.greenDim:C.black3,border:`1px solid ${i===0?C.greenBorder:C.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10,cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:10,background:`${dc}18`,border:`1px solid ${dc}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{g?"🟢":bd?"🔴":"🔵"}</div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                        <span className="syne" style={{fontSize:14,fontWeight:800,color:C.white}}>{b.address}</span>
                        {i===0&&<span style={{background:C.greenDim,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:100}}>BEST</span>}
                        {bd&&<span style={{background:C.redDim,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:100}}>AVOID</span>}
                      </div>
                      <div style={{display:"flex",gap:12,fontSize:11,flexWrap:"wrap"}}>
                        <span style={{color:C.green,fontWeight:700}}>⭐ {b.rating}</span>
                        {b.distance&&<span style={{color:C.muted}}>📍 {b.distance} mi</span>}
                        <span style={{color:C.muted}}>{b.reviews} reviews</span>
                        {b.open===true&&<span style={{color:C.green,fontWeight:700}}>🟢 Open</span>}
                        {b.open===false&&<span style={{color:C.red}}>🔴 Closed</span>}
                      </div>
                    </div>
                    <span style={{color:C.muted,fontSize:18}}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {screen==="owner-dash"&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              <BackBtn onClick={()=>goTo("owner-search")}/>
              <span style={{background:C.blueDim,border:`1px solid ${C.blueBorder}`,color:C.blue2,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:100}}>🍽️ Owner Mode</span>
              <button className="bghost" style={{marginLeft:"auto",fontSize:11,padding:"5px 12px"}} onClick={()=>goTo("all-tabs")}>All Tabs →</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,background:C.black3,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:14}}>
              <div style={{width:46,height:46,borderRadius:12,background:`linear-gradient(135deg,${C.blue},${C.green})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🍽️</div>
              <div style={{flex:1}}>
                <p className="syne" style={{fontSize:16,fontWeight:800,color:C.white,margin:"0 0 2px"}}>{restaurant.name}</p>
                <p style={{fontSize:11,color:C.muted,margin:0}}>{restaurant.address}</p>
              </div>
              <div style={{textAlign:"center",flexShrink:0}}>
                <div className="syne" style={{fontSize:24,fontWeight:800,color:healthColor(hs)}}>{hs}%</div>
                <div style={{fontSize:9,color:C.muted}}>Health</div>
              </div>
            </div>
            <Card>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                <div style={{flex:1,background:C.black2,borderRadius:100,height:10,overflow:"hidden"}}>
                  <div className="prog" style={{height:"100%",borderRadius:100,width:`${hs}%`,background:`linear-gradient(90deg,${C.blue},${C.green})`}}/>
                </div>
                <span className="syne" style={{fontSize:20,fontWeight:800,color:healthColor(hs),flexShrink:0}}>{hs}%</span>
              </div>
              <p style={{fontSize:12,color:C.muted}}>{hs>70?"Great health! Keep doing what works.":hs>40?"Room for improvement — see issues below.":"Urgent attention needed."}</p>
            </Card>
            <Card style={{borderLeft:`3px solid ${C.blue}`,borderRadius:"0 14px 14px 0"}}>
              <Lbl>AI Conclusion for You</Lbl>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:12}}>{analysis.forOwner?.conclusion}</p>
              <div style={{background:C.redDim,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 14px"}}>
                <p style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px"}}>Urgent Action</p>
                <p style={{fontSize:13,color:C.muted,margin:0}}>{analysis.forOwner?.urgentAction}</p>
              </div>
            </Card>
            <Lbl>Top Complaints</Lbl>
            <Card>{analysis.topComplaints?.length===0?<p style={{fontSize:13,color:C.green}}>No major complaints ✅</p>:(analysis.topComplaints||[]).map((c,i)=><Bar key={i} label={c.issue} count={c.count} total={analysis.totalAnalysed} color={c.severity==="high"?C.red:c.severity==="medium"?C.blue2:C.muted}/>)}</Card>
            <Lbl>How to Improve</Lbl>
            {(analysis.forOwner?.improvements||[]).map((imp,i)=><ImpRow key={i} n={i+1} text={imp}/>)}
            {analysis.fakeReviewCount>0&&<Card style={{background:"rgba(255,217,61,0.06)",border:"1px solid rgba(255,217,61,0.2)"}}><p style={{fontSize:13,fontWeight:700,color:"#ffd93d",marginBottom:4}}>🤖 {analysis.fakeReviewCount} Suspicious Reviews</p><p style={{fontSize:12,color:C.muted}}>{analysis.fakeReviewReason}</p></Card>}
{!analysis&&!err&&<Card style={{textAlign:"center",padding:32}}><div className="pulse" style={{fontSize:44,marginBottom:14}}>🤖</div><p style={{fontSize:14,color:C.muted}}>Analysing reviews...</p></Card>}
{!analysis&&err&&<Card style={{background:C.redDim,border:`1px solid ${C.redBorder}`}}><p style={{color:C.red,fontSize:13}}>⚠️ {err}</p><button className="bghost" style={{marginTop:10,fontSize:12}} onClick={()=>goTo("owner-search")}>← Try Again</button></Card>}            <EmailSection analysis={analysis} restaurant={restaurant} showToast={showToast}/>
          </div>
        )}

        {screen==="customer-dash"&&(()=>{
          const v=VERDICT[analysis.forCustomer?.verdict]||VERDICT.mixed;
          return(
            <div className="fade">
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                <BackBtn onClick={()=>goTo("branches")}/>
                <span style={{background:C.greenDim,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:100}}>👥 Customer Mode</span>
                <button className="bghost" style={{marginLeft:"auto",fontSize:11,padding:"5px 12px"}} onClick={()=>goTo("all-tabs")}>All Tabs →</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:14,background:v.bg,border:`1px solid ${v.border}`,borderRadius:16,padding:16,marginBottom:16}}>
                <div style={{fontSize:36,flexShrink:0}}>{v.icon}</div>
                <div style={{flex:1}}>
                  <div className="syne" style={{fontSize:20,fontWeight:800,color:v.color,marginBottom:4}}>{v.label}</div>
                  <div style={{fontSize:12,color:C.muted}}>{restaurant.name}</div>
                </div>
                <div style={{textAlign:"center",flexShrink:0}}>
                  <div className="syne" style={{fontSize:22,fontWeight:800,color:C.white}}>{restaurant.rating}</div>
                  <div style={{fontSize:9,color:C.muted}}>⭐ Google</div>
                </div>
              </div>
              <Card style={{borderLeft:`3px solid ${C.green}`,borderRadius:"0 14px 14px 0"}}>
                <Lbl>AI Summary for You</Lbl>
                <p style={{fontSize:13,color:C.muted,lineHeight:1.7}}>{analysis.forCustomer?.conclusion}</p>
              </Card>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                <InfoCard icon="🍽️" label="Must Order" value={analysis.forCustomer?.mustTry} sub={analysis.priceRange?.avgMealForOne?`Avg ${analysis.priceRange.avgMealForOne}/person`:null} color={C.green}/>
                <InfoCard icon="🚫" label="Avoid" value={analysis.forCustomer?.avoid} color={C.red}/>
                <InfoCard icon="🕐" label="Best Time" value={analysis.bestTimeToVisit} color={C.blue2}/>
                <InfoCard icon="💰" label="Value" value={analysis.priceRange?.valueLabel||"—"} sub={analysis.priceRange?.avgMealForTwo?`~${analysis.priceRange.avgMealForTwo} for 2`:null} color={C.green}/>
                <InfoCard icon="🅿️" label="Parking" value={bool2label(analysis.accessibility?.parking?.available,"Available","None")} sub={analysis.accessibility?.parking?.detail} color={C.blue2}/>
                <InfoCard icon="♿" label="Wheelchair" value={bool2label(analysis.accessibility?.wheelchair?.accessible,"Accessible","Limited")} sub={analysis.accessibility?.wheelchair?.detail} color={C.blue2}/>
                <InfoCard icon="🪑" label="Kids Chairs" value={bool2label(analysis.accessibility?.kidsChairs?.available,"Available","No")} color={C.green}/>
                <InfoCard icon="📶" label="WiFi" value={bool2label(analysis.accessibility?.wifi?.available,"Free WiFi","No WiFi")} color={C.green}/>
              </div>
              <button className="bghost" style={{width:"100%",padding:"12px"}} onClick={()=>goTo("all-tabs")}>View Full Details — Food Guide, Prices, Hygiene →</button>
            </div>
          );
        })()}

        {screen==="all-tabs"&&analysis&&restaurant&&(
          <div className="fade">
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              <BackBtn onClick={goBack}/>
              <span style={{background:role==="owner"?C.blueDim:C.greenDim,border:`1px solid ${role==="owner"?C.blueBorder:C.greenBorder}`,color:role==="owner"?C.blue2:C.green,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:100}}>{role==="owner"?"🍽️ Owner Mode":"👥 Customer Mode"}</span>
              <button className="bghost" style={{marginLeft:"auto",fontSize:11,padding:"5px 12px"}} onClick={()=>setScreen("welcome")}>Switch Role</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,background:C.black3,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",marginBottom:14}}>
              <span className="syne" style={{fontSize:14,fontWeight:800,color:C.white}}>{restaurant.name}</span>
              <span style={{fontSize:11,color:C.muted}}>· {restaurant.rating} ⭐ ·</span>
              <span style={{fontSize:11,color:healthColor(hs),fontWeight:700}}>Health {hs}%</span>
              <button className="bghost" style={{marginLeft:"auto",fontSize:11,padding:"4px 10px"}} onClick={downloadReport}>📥</button>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {[{k:"owner",l:"🍽️ Owner"},{k:"customer",l:"👥 Customer"},{k:"food",l:"🍔 Food"},{k:"access",l:"♿ Access"},{k:"hygiene",l:"🧹 Hygiene"},{k:"email",l:"📧 Alerts"}].map(t=>(
                <button key={t.k} className={`tbtn${tab===t.k?" on":""}`} onClick={()=>setTab(t.k)}>{t.l}</button>
              ))}
            </div>

            {tab==="owner"&&(
              <div className="fade">
                <Card style={{borderLeft:`3px solid ${C.blue}`,borderRadius:"0 14px 14px 0"}}>
                  <Lbl>AI Conclusion</Lbl>
                  <p style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:12}}>{analysis.forOwner?.conclusion}</p>
                  <div style={{background:C.redDim,border:`1px solid ${C.redBorder}`,borderRadius:10,padding:"10px 14px"}}>
                    <p style={{fontSize:10,fontWeight:700,color:C.red,marginBottom:4,textTransform:"uppercase"}}>Urgent Action</p>
                    <p style={{fontSize:13,color:C.muted,margin:0}}>{analysis.forOwner?.urgentAction}</p>
                  </div>
                </Card>
                <Lbl>Top Complaints</Lbl>
                <Card>{(analysis.topComplaints||[]).map((c,i)=><Bar key={i} label={c.issue} count={c.count} total={analysis.totalAnalysed} color={c.severity==="high"?C.red:c.severity==="medium"?C.blue2:C.muted}/>)}{analysis.topComplaints?.length===0&&<p style={{fontSize:13,color:C.green}}>No major complaints ✅</p>}</Card>
                <Lbl>Top Praises</Lbl>
                <Card>{(analysis.topPraises||[]).map((p,i)=><Bar key={i} label={p.aspect} count={p.count} total={analysis.totalAnalysed} color={C.green}/>)}{analysis.topPraises?.length===0&&<p style={{fontSize:13,color:C.muted}}>No specific praises detected</p>}</Card>
                <Lbl>Improvements</Lbl>
                {(analysis.forOwner?.improvements||[]).map((imp,i)=><ImpRow key={i} n={i+1} text={imp}/>)}
              </div>
            )}

            {tab==="customer"&&(()=>{
              const v=VERDICT[analysis.forCustomer?.verdict]||VERDICT.mixed;
              return(
                <div className="fade">
                  <div style={{display:"flex",alignItems:"center",gap:12,background:v.bg,border:`1px solid ${v.border}`,borderRadius:14,padding:14,marginBottom:12}}>
                    <div style={{fontSize:28}}>{v.icon}</div>
                    <div><div className="syne" style={{fontSize:16,fontWeight:800,color:v.color}}>{v.label}</div><div style={{fontSize:12,color:C.muted,marginTop:3,lineHeight:1.6}}>{analysis.forCustomer?.conclusion}</div></div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <InfoCard icon="🍽️" label="Must Try" value={analysis.forCustomer?.mustTry} color={C.green}/>
                    <InfoCard icon="🚫" label="Avoid" value={analysis.forCustomer?.avoid} color={C.red}/>
                    <InfoCard icon="🕐" label="Best Time" value={analysis.bestTimeToVisit} color={C.blue2}/>
                    <InfoCard icon="💰" label="Avg for 2" value={analysis.priceRange?.avgMealForTwo||"—"} sub={analysis.priceRange?.valueLabel} color={C.green}/>
                  </div>
                </div>
              );
            })()}

            {tab==="food"&&(
              <div className="fade">
                <Lbl>Best Dishes</Lbl>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{(analysis.bestDishes||[]).map((d,i)=><span key={i} style={{background:C.greenDim,border:`1px solid ${C.greenBorder}`,color:C.green,fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:100}}>{"🥇🥈🥉"[i]||"✅"} {d}</span>)}{analysis.bestDishes?.length===0&&<p style={{fontSize:13,color:C.muted}}>Not mentioned</p>}</div>
                <Lbl>Dishes to Avoid</Lbl>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{(analysis.dishesToAvoid||[]).map((d,i)=><span key={i} style={{background:C.redDim,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:700,padding:"5px 14px",borderRadius:100}}>❌ {d}</span>)}{analysis.dishesToAvoid?.length===0&&<p style={{fontSize:13,color:C.green}}>No dishes flagged ✅</p>}</div>
                <Lbl>Price Guide</Lbl>
                <Card>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.muted}}>Avg meal — 1 person</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>{analysis.priceRange?.avgMealForOne||"—"}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}><span style={{fontSize:13,color:C.muted}}>Avg meal — 2 people</span><span style={{fontSize:14,fontWeight:700,color:C.green}}>{analysis.priceRange?.avgMealForTwo||"—"}</span></div>
                  <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{fontSize:13,color:C.muted}}>Value for money</span><span style={{fontSize:14,fontWeight:700,color:C.blue2}}>{"⭐".repeat(Math.round(analysis.priceRange?.valueRating||3))} {analysis.priceRange?.valueLabel}</span></div>
                </Card>
              </div>
            )}

            {tab==="access"&&(
              <div className="fade">
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <InfoCard icon="🅿️" label="Parking" value={bool2label(analysis.accessibility?.parking?.available,"Available","Not mentioned")} sub={analysis.accessibility?.parking?.detail} color={C.green}/>
                  <InfoCard icon="♿" label="Wheelchair" value={bool2label(analysis.accessibility?.wheelchair?.accessible,"Accessible","Not confirmed")} sub={analysis.accessibility?.wheelchair?.detail} color={C.blue2}/>
                  <InfoCard icon="🪑" label="Kids Chairs" value={bool2label(analysis.accessibility?.kidsChairs?.available,"Available","Not mentioned")} color={C.green}/>
                  <InfoCard icon="📶" label="WiFi" value={bool2label(analysis.accessibility?.wifi?.available,"Free WiFi","No WiFi")} color={C.blue2}/>
                  <InfoCard icon="🔊" label="Noise Level" value={analysis.accessibility?.noiseLevel||"—"} color={C.blue2}/>
                  <InfoCard icon="🚻" label="Restrooms" value={analysis.accessibility?.restrooms||"—"} color={C.green}/>
                </div>
              </div>
            )}

            {tab==="hygiene"&&(
              <div className="fade">
                <Card style={{textAlign:"center",marginBottom:14}}>
                  <div className="syne" style={{fontSize:52,fontWeight:800,color:healthColor((analysis.hygiene?.score||0)*10)}}>{analysis.hygiene?.score||"—"}<span style={{fontSize:22,color:C.muted}}>/10</span></div>
                  <div style={{fontSize:14,color:C.muted,marginBottom:14}}>{analysis.hygiene?.label||"—"}</div>
                  <div style={{background:C.black2,borderRadius:100,height:8,overflow:"hidden",maxWidth:240,margin:"0 auto"}}><div style={{height:"100%",borderRadius:100,width:`${(analysis.hygiene?.score||0)*10}%`,background:`linear-gradient(90deg,${C.blue},${C.green})`,transition:"width 1s ease"}}/></div>
                </Card>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  {[{l:"Kitchen",v:analysis.hygiene?.kitchen},{l:"Tables",v:analysis.hygiene?.tables},{l:"Restrooms",v:analysis.hygiene?.restrooms},{l:"Staff",v:analysis.hygiene?.staff}].map((h,i)=>{
                    const g=["Clean","Professional","Excellent","Good"].includes(h.v),m=["Mixed","Fair"].includes(h.v);
                    return(<div key={i} style={{borderRadius:12,padding:"12px 14px",background:g?C.greenDim:m?C.blueDim:C.redDim,border:`1px solid ${g?C.greenBorder:m?C.blueBorder:C.redBorder}`}}><div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4,color:C.muted}}>{h.l}</div><div style={{fontSize:14,fontWeight:700,color:C.white}}>{h.v||"—"}</div></div>);
                  })}
                </div>
                {analysis.hygiene?.ownerAlert&&<Card style={{background:C.redDim,border:`1px solid ${C.redBorder}`}}><p style={{fontSize:10,fontWeight:700,color:C.red,textTransform:"uppercase",marginBottom:6}}>Owner Alert</p><p style={{fontSize:13,color:C.muted}}>{analysis.hygiene.ownerAlert}</p></Card>}
              </div>
            )}

            {tab==="email"&&<div className="fade"><EmailSection analysis={analysis} restaurant={restaurant} showToast={showToast}/></div>}
          </div>
        )}

      </div>
    </div>
  );
}

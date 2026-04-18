import { useState, useRef } from "react";

const ISSUES = [
  { id: "economy", label: "Economy & Jobs", icon: "💼" },
  { id: "healthcare", label: "Healthcare", icon: "🏥" },
  { id: "immigration", label: "Immigration", icon: "🌍" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "climate", label: "Climate & Energy", icon: "🌱" },
  { id: "guns", label: "Gun Policy", icon: "🔫" },
  { id: "housing", label: "Housing", icon: "🏠" },
  { id: "taxes", label: "Taxes", icon: "💰" },
  { id: "criminal_justice", label: "Criminal Justice", icon: "⚖️" },
  { id: "foreign_policy", label: "Foreign Policy", icon: "🕊️" },
];

const SAMPLE_ELECTIONS = [
  "2024 US Presidential Election",
  "2026 US Midterm Elections",
  "Custom / Local Election",
];

const VOICE_FORMATS = [
  { id: "social", label: "Social Media Post", icon: "📱", desc: "Short, shareable, impactful" },
  { id: "letter", label: "Letter to Representative", icon: "✉️", desc: "Formal, persuasive, actionable" },
  { id: "argument", label: "Dinner Table Argument", icon: "🍽️", desc: "Conversational, fact-based, respectful" },
  { id: "essay", label: "Personal Essay", icon: "📝", desc: "Reflective, storytelling, authentic" },
];

export default function InformedVote() {
  const [step, setStep] = useState(0);
  const [election, setElection] = useState("");
  const [customElection, setCustomElection] = useState("");
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [rankedIssues, setRankedIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [followUp, setFollowUp] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [userOpinion, setUserOpinion] = useState("");
  const [voiceFormat, setVoiceFormat] = useState("");
  const [voiceResult, setVoiceResult] = useState(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const toggleIssue = (id) => {
    setSelectedIssues((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const goToRanking = () => {
    setRankedIssues(ISSUES.filter((i) => selectedIssues.includes(i.id)));
    setStep(2);
  };

  const handleDragStart = (idx) => { dragItem.current = idx; };
  const handleDragEnter = (idx) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    const items = [...rankedIssues];
    const d = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, d);
    dragItem.current = null; dragOverItem.current = null;
    setRankedIssues(items);
  };
  const moveUp = (i) => { if(!i) return; const a=[...rankedIssues]; [a[i-1],a[i]]=[a[i],a[i-1]]; setRankedIssues(a); };
  const moveDown = (i) => { if(i>=rankedIssues.length-1) return; const a=[...rankedIssues]; [a[i],a[i+1]]=[a[i+1],a[i]]; setRankedIssues(a); };

  const analyze = async () => {
    setLoading(true); setError(null);
    const name = election === "Custom / Local Election" ? customElection : election;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 4000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `You are an unbiased political analyst. The user wants to vote informed in: "${name}". Their top issues ranked: ${rankedIssues.map(i=>i.label).join(", ")}. Search the web for latest info. Return JSON only (no markdown, no backticks): {"election_name":"string","candidates":[{"name":"string","party":"string","positions":[{"issue":"string","stance":"string (2-3 sentences)","evidence":"string","impact":"string"}]}],"key_differences":["string"],"election_context":"string"}. Be factual and unbiased.` }],
        }),
      });
      const data = await r.json();
      const text = data.content.filter(i=>i.type==="text").map(i=>i.text).join("");
      setResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
      setStep(3);
    } catch(e) { setError("Something went wrong. Please try again."); }
    setLoading(false);
  };

  const askFollowUp = async () => {
    if(!followUp.trim()) return;
    setFollowUpLoading(true); setFollowUpAnswer(null);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          tools:[{type:"web_search_20250305",name:"web_search"}],
          messages:[{role:"user",content:`Context: researching "${result?.election_name}". Data: ${JSON.stringify(result)}. Question: "${followUp}". Answer concisely, factually, unbiased.`}],
        }),
      });
      const data = await r.json();
      setFollowUpAnswer(data.content.filter(i=>i.type==="text").map(i=>i.text).join(""));
    } catch(e) { setFollowUpAnswer("Sorry, something went wrong."); }
    setFollowUpLoading(false);
  };

  const generateVoice = async () => {
    if(!userOpinion.trim()||!voiceFormat) return;
    setVoiceLoading(true); setVoiceResult(null);
    const fmts = { social:"a social media post (punchy, under 280 chars)", letter:"a formal letter to a political representative", argument:"talking points for a respectful dinner conversation", essay:"a short personal essay (3-4 paragraphs)" };
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1500,
          messages:[{role:"user",content:`The user researched "${result?.election_name}" and formed this opinion:\n"${userOpinion}"\n\nContext: ${JSON.stringify(result)}\n\nHelp them express this as ${fmts[voiceFormat]}. Keep their authentic voice. Strengthen with facts from research. Make it compelling. Don't change their opinion. Output only the final text.`}],
        }),
      });
      const data = await r.json();
      setVoiceResult(data.content.filter(i=>i.type==="text").map(i=>i.text).join(""));
    } catch(e) { setVoiceResult("Sorry, something went wrong."); }
    setVoiceLoading(false);
  };

  const copyText = () => { navigator.clipboard.writeText(voiceResult); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const reset = () => { setStep(0);setElection("");setCustomElection("");setSelectedIssues([]);setRankedIssues([]);setResult(null);setExpandedIssue(null);setFollowUp("");setFollowUpAnswer(null);setUserOpinion("");setVoiceFormat("");setVoiceResult(null); };

  if (step === 0) return (
    <div style={S.container}>
      <div style={S.hero}>
        <div style={S.logoMark}>✓</div>
        <h1 style={S.title}>Informed Vote</h1>
        <p style={S.subtitle}>Vote smart in 5 minutes. Get an unbiased, personalized comparison of candidates — then find your voice and make it heard.</p>
        <p style={S.tagline}>No bias. No fluff. Your voice, amplified.</p>
        <button style={S.primaryBtn} onClick={()=>setStep(1)}>Get Started →</button>
      </div>
      <div style={S.features}>
        {[["🎯","Personalized","Prioritized by your issues"],["⚖️","Unbiased","AI analysis, no agenda"],["📢","Find Your Voice","Turn opinions into expression"]].map(([icon,t,d])=>(
          <div key={t} style={S.featureCard}><span style={S.featureIcon}>{icon}</span><h3 style={S.featureTitle}>{t}</h3><p style={S.featureDesc}>{d}</p></div>
        ))}
      </div>
    </div>
  );

  if (step === 1) return (
    <div style={S.container}><div style={S.stepContainer}>
      <div style={S.stepInd}>Step 1 of 4</div>
      <h2 style={S.stepTitle}>What election are you voting in?</h2>
      <div style={S.elGrid}>
        {SAMPLE_ELECTIONS.map(e=><button key={e} style={{...S.elCard,...(election===e?S.elCardActive:{})}} onClick={()=>setElection(e)}>{e}</button>)}
      </div>
      {election==="Custom / Local Election"&&<input style={S.input} placeholder="e.g. 2026 Pittsburgh Mayor Race..." value={customElection} onChange={e=>setCustomElection(e.target.value)}/>}
      <div style={S.navRow}>
        <button style={S.secBtn} onClick={()=>setStep(0)}>← Back</button>
        <button style={{...S.primaryBtn,opacity:!election||(election==="Custom / Local Election"&&!customElection)?0.4:1}} disabled={!election||(election==="Custom / Local Election"&&!customElection)} onClick={()=>setStep(2)}>Next →</button>
      </div>
    </div></div>
  );

  if (step === 2 && !rankedIssues.length) return (
    <div style={S.container}><div style={S.stepContainer}>
      <div style={S.stepInd}>Step 2 of 4</div>
      <h2 style={S.stepTitle}>What issues matter most to you?</h2>
      <p style={S.stepDesc}>Select up to 5 issues.</p>
      <div style={S.issueGrid}>
        {ISSUES.map(i=><button key={i.id} style={{...S.chip,...(selectedIssues.includes(i.id)?S.chipActive:{})}} onClick={()=>toggleIssue(i.id)}><span>{i.icon}</span> {i.label}</button>)}
      </div>
      <p style={{fontSize:13,color:"#64748b"}}>{selectedIssues.length}/5 selected</p>
      <div style={S.navRow}>
        <button style={S.secBtn} onClick={()=>setStep(1)}>← Back</button>
        <button style={{...S.primaryBtn,opacity:selectedIssues.length<2?0.4:1}} disabled={selectedIssues.length<2} onClick={goToRanking}>Rank My Issues →</button>
      </div>
    </div></div>
  );

  if (step === 2 && rankedIssues.length) return (
    <div style={S.container}><div style={S.stepContainer}>
      <div style={S.stepInd}>Step 2 of 4 — Rank</div>
      <h2 style={S.stepTitle}>Rank by importance</h2>
      <p style={S.stepDesc}>Use arrows to reorder. #1 = most important.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {rankedIssues.map((issue,idx)=>(
          <div key={issue.id} style={S.rankItem} draggable onDragStart={()=>handleDragStart(idx)} onDragEnter={()=>handleDragEnter(idx)} onDragEnd={handleDragEnd} onDragOver={e=>e.preventDefault()}>
            <span style={S.rankNum}>#{idx+1}</span><span style={{fontSize:20}}>{issue.icon}</span><span style={{flex:1,fontSize:15,color:"#e2e8f0"}}>{issue.label}</span>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              <button style={S.arrBtn} onClick={()=>moveUp(idx)} disabled={!idx}>▲</button>
              <button style={S.arrBtn} onClick={()=>moveDown(idx)} disabled={idx>=rankedIssues.length-1}>▼</button>
            </div>
          </div>
        ))}
      </div>
      <div style={S.navRow}>
        <button style={S.secBtn} onClick={()=>setRankedIssues([])}>← Back</button>
        <button style={S.primaryBtn} onClick={analyze}>Analyze Candidates →</button>
      </div>
    </div></div>
  );

  if (loading) return (
    <div style={S.container}><div style={{textAlign:"center"}}>
      <div style={S.spinner}></div>
      <h2 style={{fontSize:22,fontWeight:600,color:"#f1f5f9",margin:"0 0 8px"}}>Researching candidates...</h2>
      <p style={{fontSize:14,color:"#64748b"}}>Searching real positions and voting records. ~15-30 seconds.</p>
    </div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  );

  if (error) return (
    <div style={S.container}><div style={S.stepContainer}>
      <h2 style={S.stepTitle}>⚠️ {error}</h2>
      <button style={S.primaryBtn} onClick={analyze}>Try Again</button>
    </div></div>
  );

  if (step === 3 && result) return (
    <div style={S.container}><div style={S.results}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={S.stepInd}>Step 3 of 4 — Results</div>
        <h2 style={S.resTitle}>{result.election_name}</h2>
        <p style={{fontSize:15,color:"#94a3b8",lineHeight:1.6,maxWidth:600,margin:"0 auto"}}>{result.election_context}</p>
      </div>
      <div style={S.section}>
        <h3 style={S.secTitle}>🔑 Key Differences</h3>
        {result.key_differences?.map((d,i)=><div key={i} style={S.diffItem}><span style={{color:"#7c3aed",marginRight:8,fontWeight:700}}>→</span>{d}</div>)}
      </div>
      <h3 style={S.secTitle}>📊 Candidate Comparison</h3>
      <p style={{fontSize:14,color:"#64748b",margin:"0 0 16px"}}>Ordered by YOUR priorities. Click to expand.</p>
      {rankedIssues.map(issue=>{
        const exp=expandedIssue===issue.id;
        return <div key={issue.id} style={S.issueBlock}>
          <button style={S.issueHead} onClick={()=>setExpandedIssue(exp?null:issue.id)}>
            <span>{issue.icon} {issue.label}</span><span>{exp?"▼":"▶"}</span>
          </button>
          {exp&&<div style={S.compGrid}>
            {result.candidates?.map(c=>{
              const p=c.positions?.find(p=>p.issue.toLowerCase().includes(issue.label.toLowerCase().split(" ")[0])||issue.label.toLowerCase().includes(p.issue.toLowerCase().split(" ")[0]));
              return <div key={c.name} style={S.candCard}>
                <div style={S.candName}>{c.name}<span style={S.badge}>{c.party}</span></div>
                {p?<>
                  <div style={{marginBottom:12}}><div style={S.lbl}>Position</div><div style={{fontSize:14,color:"#cbd5e1",lineHeight:1.5}}>{p.stance}</div></div>
                  <div style={{marginBottom:12}}><div style={S.lbl}>Evidence</div><div style={{fontSize:13,color:"#94a3b8",lineHeight:1.5,fontStyle:"italic"}}>{p.evidence}</div></div>
                  <div><div style={S.lbl}>Impact on You</div><div style={{fontSize:13,color:"#86efac",lineHeight:1.5}}>{p.impact}</div></div>
                </>:<p style={{fontSize:14,color:"#475569",fontStyle:"italic"}}>No specific position found.</p>}
              </div>;
            })}
          </div>}
        </div>;
      })}
      <div style={S.section}>
        <h3 style={S.secTitle}>💬 Have a question?</h3>
        <div style={{display:"flex",gap:8}}>
          <input style={S.fuInput} placeholder="e.g. What's their stance on student loans?" value={followUp} onChange={e=>setFollowUp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askFollowUp()}/>
          <button style={S.fuBtn} onClick={askFollowUp} disabled={followUpLoading}>{followUpLoading?"...":"Ask"}</button>
        </div>
        {followUpAnswer&&<div style={S.fuAnswer}>{followUpAnswer}</div>}
      </div>
      <div style={{textAlign:"center",marginTop:32}}>
        <button style={S.primaryBtn} onClick={()=>setStep(4)}>Find Your Voice →</button>
      </div>
    </div></div>
  );

  if (step === 4) return (
    <div style={S.container}><div style={S.results}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={S.stepInd}>Step 4 of 4 — Find Your Voice</div>
        <h2 style={S.resTitle}>Make Your Voice Heard</h2>
        <p style={{fontSize:15,color:"#94a3b8",lineHeight:1.6,maxWidth:600,margin:"0 auto"}}>Now that you're informed, express your opinion. Write what you think — messy, raw, any language — and we'll help you turn it into something powerful.</p>
      </div>
      <div style={S.section}>
        <h3 style={S.secTitle}>✍️ What's your take?</h3>
        <textarea style={S.textarea} placeholder="Write your honest opinion here... it can be messy, informal, even in Spanglish." value={userOpinion} onChange={e=>setUserOpinion(e.target.value)} rows={5}/>
      </div>
      <div style={S.section}>
        <h3 style={S.secTitle}>📣 How do you want to express it?</h3>
        <div style={S.fmtGrid}>
          {VOICE_FORMATS.map(f=><button key={f.id} style={{...S.fmtCard,...(voiceFormat===f.id?S.fmtCardActive:{})}} onClick={()=>setVoiceFormat(f.id)}>
            <span style={{fontSize:24}}>{f.icon}</span><div style={{fontSize:14,fontWeight:600,color:"#e2e8f0",marginTop:8}}>{f.label}</div><div style={{fontSize:12,color:"#64748b",marginTop:4}}>{f.desc}</div>
          </button>)}
        </div>
      </div>
      {!voiceResult&&<div style={{textAlign:"center",marginTop:24}}>
        <button style={{...S.primaryBtn,opacity:!userOpinion.trim()||!voiceFormat?0.4:1}} disabled={!userOpinion.trim()||!voiceFormat||voiceLoading} onClick={generateVoice}>{voiceLoading?"Crafting your voice...":"Amplify My Voice →"}</button>
      </div>}
      {voiceResult&&<div style={S.voiceRes}>
        <h3 style={S.secTitle}>🎤 Your Voice, Amplified</h3>
        <div style={S.voiceText}>{voiceResult}</div>
        <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
          <button style={S.copyBtn} onClick={copyText}>{copied?"✓ Copied!":"📋 Copy to Clipboard"}</button>
          <button style={S.secBtn} onClick={()=>{setVoiceResult(null);setVoiceFormat("");}}>Try Different Format</button>
        </div>
      </div>}
      <div style={S.navRow}>
        <button style={S.secBtn} onClick={()=>setStep(3)}>← Back to Results</button>
        <button style={S.secBtn} onClick={reset}>Start Over</button>
      </div>
    </div></div>
  );

  return null;
}

const S = {
  container: { minHeight:"100vh", background:"linear-gradient(135deg,#0a0e1a 0%,#111827 50%,#0a0e1a 100%)", color:"#e2e8f0", fontFamily:"'Sora','Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px" },
  hero: { textAlign:"center", maxWidth:600, marginBottom:48 },
  logoMark: { width:64,height:64,borderRadius:16, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex",alignItems:"center",justifyContent:"center", fontSize:32,fontWeight:700,color:"#fff", margin:"0 auto 24px", boxShadow:"0 0 40px rgba(99,102,241,0.3)" },
  title: { fontSize:48,fontWeight:800,margin:"0 0 16px", background:"linear-gradient(135deg,#60a5fa,#a78bfa)", WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-1px" },
  subtitle: { fontSize:18,color:"#94a3b8",lineHeight:1.6,margin:"0 0 8px" },
  tagline: { fontSize:14,color:"#64748b",fontStyle:"italic",margin:"0 0 32px" },
  primaryBtn: { background:"linear-gradient(135deg,#3b82f6,#7c3aed)",color:"#fff",border:"none", padding:"14px 32px",borderRadius:12,fontSize:16,fontWeight:600,cursor:"pointer", boxShadow:"0 4px 20px rgba(99,102,241,0.3)" },
  secBtn: { background:"rgba(255,255,255,0.05)",color:"#94a3b8", border:"1px solid rgba(255,255,255,0.1)",padding:"12px 24px", borderRadius:12,fontSize:14,fontWeight:500,cursor:"pointer" },
  features: { display:"flex",gap:20,flexWrap:"wrap",justifyContent:"center" },
  featureCard: { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)", borderRadius:16,padding:"24px 20px",width:180,textAlign:"center" },
  featureIcon: { fontSize:28,display:"block",marginBottom:8 },
  featureTitle: { fontSize:16,fontWeight:600,margin:"0 0 4px",color:"#e2e8f0" },
  featureDesc: { fontSize:13,color:"#64748b",margin:0,lineHeight:1.4 },
  stepContainer: { maxWidth:560,width:"100%" },
  stepInd: { fontSize:13,color:"#7c3aed",fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:1 },
  stepTitle: { fontSize:28,fontWeight:700,margin:"0 0 8px",color:"#f1f5f9" },
  stepDesc: { fontSize:15,color:"#64748b",margin:"0 0 24px" },
  elGrid: { display:"flex",flexDirection:"column",gap:12,marginBottom:16 },
  elCard: { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)", borderRadius:12,padding:"16px 20px",color:"#e2e8f0",fontSize:16,cursor:"pointer",textAlign:"left" },
  elCardActive: { background:"rgba(99,102,241,0.15)",borderColor:"#6366f1",boxShadow:"0 0 20px rgba(99,102,241,0.15)" },
  input: { width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)", borderRadius:12,padding:"14px 16px",color:"#e2e8f0",fontSize:15,outline:"none",marginBottom:16,boxSizing:"border-box" },
  navRow: { display:"flex",justifyContent:"space-between",marginTop:24 },
  issueGrid: { display:"flex",flexWrap:"wrap",gap:10,marginBottom:12 },
  chip: { background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)", borderRadius:100,padding:"10px 18px",color:"#94a3b8",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6 },
  chipActive: { background:"rgba(99,102,241,0.2)",borderColor:"#6366f1",color:"#c7d2fe" },
  rankItem: { display:"flex",alignItems:"center",gap:12, background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)", borderRadius:12,padding:"12px 16px",cursor:"grab" },
  rankNum: { fontSize:14,fontWeight:700,color:"#7c3aed",minWidth:30 },
  arrBtn: { background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:10,padding:"2px 6px" },
  spinner: { width:48,height:48,border:"3px solid rgba(255,255,255,0.1)",borderTopColor:"#6366f1", borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 24px" },
  results: { maxWidth:800,width:"100%" },
  resTitle: { fontSize:32,fontWeight:800,margin:"0 0 12px", background:"linear-gradient(135deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" },
  section: { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)", borderRadius:16,padding:24,marginBottom:16 },
  secTitle: { fontSize:18,fontWeight:700,margin:"0 0 12px",color:"#f1f5f9" },
  diffItem: { fontSize:14,color:"#cbd5e1",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",lineHeight:1.5 },
  issueBlock: { marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,0.06)" },
  issueHead: { width:"100%",background:"rgba(255,255,255,0.04)",border:"none",padding:"14px 20px", color:"#e2e8f0",fontSize:16,fontWeight:600,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" },
  compGrid: { display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16,padding:16,background:"rgba(0,0,0,0.2)" },
  candCard: { background:"rgba(255,255,255,0.03)",borderRadius:12,padding:20,border:"1px solid rgba(255,255,255,0.06)" },
  candName: { fontSize:18,fontWeight:700,color:"#f1f5f9",marginBottom:12,display:"flex",alignItems:"center",gap:8 },
  badge: { fontSize:11,background:"rgba(99,102,241,0.2)",color:"#a5b4fc",padding:"3px 10px",borderRadius:100,fontWeight:500 },
  lbl: { fontSize:11,color:"#7c3aed",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:4 },
  fuInput: { flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)", borderRadius:12,padding:"12px 16px",color:"#e2e8f0",fontSize:14,outline:"none" },
  fuBtn: { background:"linear-gradient(135deg,#3b82f6,#7c3aed)",color:"#fff",border:"none", padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer" },
  fuAnswer: { marginTop:16,fontSize:14,color:"#cbd5e1",lineHeight:1.6,background:"rgba(255,255,255,0.03)",borderRadius:12,padding:16 },
  textarea: { width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)", borderRadius:12,padding:"14px 16px",color:"#e2e8f0",fontSize:15,outline:"none", resize:"vertical",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box" },
  fmtGrid: { display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12 },
  fmtCard: { background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)", borderRadius:12,padding:16,cursor:"pointer",textAlign:"center" },
  fmtCardActive: { background:"rgba(99,102,241,0.15)",borderColor:"#6366f1",boxShadow:"0 0 20px rgba(99,102,241,0.15)" },
  voiceRes: { background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)", borderRadius:16,padding:24,marginTop:24 },
  voiceText: { fontSize:15,color:"#e2e8f0",lineHeight:1.7, background:"rgba(0,0,0,0.2)",borderRadius:12,padding:20,whiteSpace:"pre-wrap" },
  copyBtn: { background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff",border:"none", padding:"12px 24px",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer" },
};

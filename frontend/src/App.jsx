import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const API = '/api';
const fmt = (n) => n != null ? parseFloat(n).toLocaleString('en-US', { style:'currency', currency:'USD' }) : '—';
const fmtDate = (d) => { if(!d) return '—'; const p=String(d).split('T')[0].split('-'); return new Date(p[0],p[1]-1,p[2]).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const fmtMonths = (m) => { const y=Math.floor(m/12),mo=m%12; return [y>0&&`${y}yr`,mo>0&&`${mo}mo`].filter(Boolean).join(' '); };

const LOAN_TYPES = [
  {id:'mortgage',label:'Mortgage',icon:'🏠',hasEscrow:true},
  {id:'arm',label:'ARM',icon:'📈',hasEscrow:true},
  {id:'heloc',label:'HELOC',icon:'🏦',hasEscrow:false},
  {id:'auto',label:'Auto Loan',icon:'🚗',hasEscrow:false},
  {id:'personal',label:'Personal',icon:'👤',hasEscrow:false},
];
const loanTypeInfo = (id) => LOAN_TYPES.find(t=>t.id===id)||LOAN_TYPES[0];

const THEMES = [
  {id:'light',label:'☀️ Light',desc:'Warm cream'},
  {id:'dark',label:'🌙 Dark',desc:'Dark navy'},
  {id:'slate',label:'🌊 Slate',desc:'Cool blue'},
  {id:'greenred',label:'🟢 Green & Red',desc:'Fresh green/red'},
  {id:'midnight',label:'🌌 Midnight',desc:'Deep space blue'},
  {id:'forest',label:'🌲 Forest',desc:'Earthy greens'},
  {id:'ocean',label:'🐋 Ocean',desc:'Ocean blues'},
];

function authFetch(url, opts={}) {
  const token = localStorage.getItem('miq-token');
  return fetch(url, {...opts, headers:{...(opts.headers||{}),'Authorization':`Bearer ${token}`,...(opts.body&&!(opts.body instanceof FormData)?{'Content-Type':'application/json'}:{})}});
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = {
  app:{display:'flex',minHeight:'100vh'},
  sidebar:{width:248,background:'var(--sidebar-bg)',color:'var(--sidebar-text)',display:'flex',flexDirection:'column',padding:'0 0 0',flexShrink:0,position:'sticky',top:0,height:'100vh',overflow:'auto'},
  logo:{padding:'24px 20px 16px',borderBottom:'1px solid rgba(255,255,255,0.1)',marginBottom:4},
  logoTitle:{fontSize:21,color:'var(--gold-light)',fontFamily:"'DM Serif Display',serif"},
  logoSub:{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:2,letterSpacing:'0.08em',textTransform:'uppercase'},
  navGroup:{padding:'10px 12px 2px',fontSize:10,color:'rgba(255,255,255,0.3)',letterSpacing:'0.12em',textTransform:'uppercase',marginTop:6},
  navItem:(a,color)=>({padding:'8px 16px',display:'flex',alignItems:'center',gap:9,cursor:'pointer',borderRadius:7,margin:'1px 6px',background:a?'rgba(201,151,58,0.15)':'transparent',color:a?(color||'var(--gold-light)'):'rgba(255,255,255,0.6)',fontSize:13,fontWeight:a?600:400,borderLeft:a?`3px solid ${color||'var(--gold)'}`:'3px solid transparent',transition:'all 0.15s'}),
  navDivider:{height:1,background:'rgba(255,255,255,0.07)',margin:'6px 12px'},
  githubLink:{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',margin:'0 6px 4px',borderRadius:7,color:'rgba(255,255,255,0.35)',fontSize:12,textDecoration:'none',cursor:'pointer',transition:'color 0.15s'},
  main:{flex:1,padding:'32px 40px',overflow:'auto',background:'var(--cream)'},
  pageHeader:{marginBottom:28},
  pageTitle:{fontSize:28,color:'var(--ink)'},
  pageSub:{color:'var(--warm-gray)',marginTop:4,fontSize:14},
  card:{background:'var(--card)',borderRadius:'var(--radius)',padding:'20px 24px',boxShadow:'var(--shadow)',border:'1px solid var(--border)'},
  statCard:(c)=>({background:'var(--card)',borderRadius:'var(--radius)',padding:'20px 24px',boxShadow:'var(--shadow)',border:'1px solid var(--border)',borderTop:`3px solid ${c||'var(--gold)'}`}),
  statLabel:{fontSize:12,color:'var(--warm-gray)',textTransform:'uppercase',letterSpacing:'0.08em'},
  statValue:{fontSize:24,fontFamily:"'DM Serif Display',serif",marginTop:4,color:'var(--ink)'},
  statSub:{fontSize:12,color:'var(--warm-gray)',marginTop:4},
  sectionTitle:{fontSize:18,marginBottom:16,color:'var(--ink)'},
  btn:(v)=>({padding:v==='sm'?'7px 14px':'10px 20px',fontSize:v==='sm'?13:14,fontWeight:500,borderRadius:8,cursor:'pointer',background:v==='danger'?'var(--terracotta)':v==='ghost'||v==='outline'?'transparent':'var(--gold)',color:v==='ghost'?'var(--warm-gray)':v==='outline'?'var(--gold)':'white',border:v==='outline'?'1px solid var(--gold)':v==='ghost'?'1px solid var(--border)':'none'}),
  input:{padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:14,background:'var(--surface)',color:'var(--ink)',width:'100%',outline:'none'},
  label:{fontSize:12,color:'var(--warm-gray)',marginBottom:5,display:'block',fontWeight:500},
  table:{width:'100%',borderCollapse:'collapse',fontSize:13},
  th:{padding:'10px 12px',textAlign:'left',borderBottom:'2px solid var(--border)',color:'var(--warm-gray)',fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em'},
  td:{padding:'10px 12px',borderBottom:'1px solid var(--border)',verticalAlign:'middle',color:'var(--ink)'},
  badge:(c)=>({display:'inline-block',padding:'2px 8px',borderRadius:4,fontSize:11,background:c==='green'?'#E8F5E9':c==='orange'?'#FFF3E0':c==='blue'?'#E3F2FD':c==='red'?'#FEEBEA':'#F3E5F5',color:c==='green'?'var(--sage)':c==='orange'?'var(--terracotta)':c==='blue'?'#1565C0':c==='red'?'#C41C1C':'#6A1B9A',fontWeight:600}),
  uploadZone:{border:'2px dashed var(--gold)',borderRadius:'var(--radius)',padding:'24px',textAlign:'center',cursor:'pointer',background:'rgba(201,151,58,0.04)'},
};
function Field({label,children}){return <div><label style={s.label}>{label}</label>{children}</div>;}
// ─── PASSWORD RESET ───────────────────────────────────────────────────────────
function ResetPasswordPage({token,onDone}){
  const [status,setStatus]=useState('loading');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [error,setError]=useState('');
  const [username,setUsername]=useState('');
  useEffect(()=>{
    fetch(`/api/auth/validate-reset-token?token=${token}`)
      .then(r=>r.json()).then(d=>{if(d.valid){setUsername(d.username);setStatus('valid');}else setStatus('invalid');})
      .catch(()=>setStatus('invalid'));
  },[token]);
  const submit=async()=>{
    setError('');
    if(password!==confirm){setError('Passwords do not match');return;}
    if(password.length<6){setError('Min 6 characters');return;}
    const r=await fetch('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,newPassword:password})});
    const d=await r.json();
    if(!r.ok){setError(d.error);return;}
    setStatus('success');
  };
  const wrap=(content)=>(<div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'var(--cream)'}}><div style={{...s.card,width:360,padding:'40px'}}>{content}</div></div>);
  if(status==='loading')return wrap(<div style={{textAlign:'center',color:'var(--warm-gray)'}}>Validating token...</div>);
  if(status==='invalid')return wrap(<div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:12}}>⛔</div><h2 style={{color:'var(--ink)',marginBottom:8}}>Invalid or Expired Token</h2><p style={{color:'var(--warm-gray)',fontSize:13,marginBottom:20}}>Generate a new reset token from your server.</p><button style={s.btn()} onClick={onDone}>Back to Login</button></div>);
  if(status==='success')return wrap(<div style={{textAlign:'center'}}><div style={{fontSize:40,marginBottom:12}}>✅</div><h2 style={{color:'var(--ink)',marginBottom:8}}>Password Updated</h2><p style={{color:'var(--warm-gray)',fontSize:13,marginBottom:20}}>You can now sign in with your new password.</p><button style={s.btn()} onClick={onDone}>Go to Login</button></div>);
  return wrap(<div>
    <div style={{textAlign:'center',marginBottom:28}}><div style={{fontSize:40,marginBottom:8}}>🔑</div><h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:'var(--ink)'}}>Reset Password</h1><p style={{color:'var(--warm-gray)',fontSize:13,marginTop:4}}>Setting new password for <strong>{username}</strong></p></div>
    {error&&<div style={{background:'#FEF3F0',color:'var(--terracotta)',padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:16}}>{error}</div>}
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <Field label="New Password"><input style={s.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min 6 characters" autoFocus/></Field>
      <Field label="Confirm Password"><input style={s.input} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/></Field>
      <button style={{...s.btn(),marginTop:4}} onClick={submit}>Set New Password</button>
    </div>
  </div>);
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({onLogin}){
  const [mode,setMode]=useState('loading');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{fetch('/api/auth/status').then(r=>r.json()).then(d=>setMode(d.needsSetup?'setup':'login'));},[]);
  const submit=async()=>{
    setError('');
    const r=await fetch(mode==='setup'?'/api/auth/setup':'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const d=await r.json();
    if(!r.ok){setError(d.error);return;}
    localStorage.setItem('miq-token',d.token);localStorage.setItem('miq-user',d.username);onLogin(d.username);
  };
  if(mode==='loading')return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--cream)'}}><div style={{color:'var(--warm-gray)'}}>Loading...</div></div>;
  if(mode==='forgot')return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{...s.card,width:360,padding:'40px'}}>
        <div style={{textAlign:'center',marginBottom:28}}><div style={{fontSize:40,marginBottom:8}}>🔑</div><h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:24,color:'var(--ink)'}}>Forgot Password?</h1></div>
        <p style={{color:'var(--warm-gray)',fontSize:13,lineHeight:1.6,marginBottom:16}}>Since PayoffIQ is self-hosted, password reset works through your server. Visit:</p>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',fontFamily:'monospace',fontSize:12,wordBreak:'break-all',marginBottom:16}}>http://[your-server-ip]:3010/api/auth/generate-reset-token</div>
        <p style={{color:'var(--warm-gray)',fontSize:12,lineHeight:1.6,marginBottom:24}}>That returns a reset link valid for 15 minutes. Copy the <code>reset_url</code> and open it.</p>
        <button style={{...s.btn('ghost'),width:'100%'}} onClick={()=>setMode('login')}>← Back to Login</button>
      </div>
    </div>
  );
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{...s.card,width:360,padding:'40px'}}>
        <div style={{textAlign:'center',marginBottom:32}}><div style={{fontSize:40,marginBottom:8}}>💰</div><h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,color:'var(--ink)'}}>PayoffIQ</h1><p style={{color:'var(--warm-gray)',fontSize:13,marginTop:4}}>{mode==='setup'?'Create your account to get started':'Sign in to your account'}</p></div>
        {error&&<div style={{background:'#FEF3F0',color:'var(--terracotta)',padding:'10px 14px',borderRadius:8,fontSize:13,marginBottom:16}}>{error}</div>}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <Field label="Username"><input style={s.input} value={username} onChange={e=>setUsername(e.target.value)} placeholder="Enter username" autoFocus/></Field>
          <Field label="Password"><input style={s.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}/></Field>
          <button style={{...s.btn(),marginTop:4}} onClick={submit}>{mode==='setup'?'Create Account':'Sign In'}</button>
        </div>
        {mode==='login'&&<div style={{textAlign:'center',marginTop:16}}><button style={{background:'none',border:'none',color:'var(--warm-gray)',fontSize:12,cursor:'pointer',textDecoration:'underline'}} onClick={()=>setMode('forgot')}>Forgot password?</button></div>}
        {mode==='setup'&&<p style={{fontSize:11,color:'var(--warm-gray)',textAlign:'center',marginTop:16}}>This creates the only account for this instance.</p>}
      </div>
    </div>
  );
}

// ─── LOAN FORM ────────────────────────────────────────────────────────────────
function LoanForm({initial={},onSave,onCancel}){
  const [form,setForm]=useState({name:initial.name||'',loan_type:initial.loan_type||'mortgage',original_amount:initial.original_amount||'',interest_rate:initial.interest_rate||'',loan_term_months:initial.loan_term_months||360,start_date:initial.start_date?initial.start_date.split('T')[0]:'',monthly_payment:initial.monthly_payment||'',arm_fixed_months:initial.arm_fixed_months||'',arm_rate_cap:initial.arm_rate_cap||'',arm_rate_floor:initial.arm_rate_floor||'',arm_periodic_cap:initial.arm_periodic_cap||'2'});
  const set=(k)=>(e)=>setForm(f=>({...f,[k]:e.target.value}));
  const calcPayment=()=>{const P=parseFloat(form.original_amount),r=parseFloat(form.interest_rate)/100/12,n=parseInt(form.loan_term_months);if(P&&r&&n)setForm(f=>({...f,monthly_payment:(P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1)).toFixed(2)}));};
  const isARM=form.loan_type==='arm';
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <Field label="Loan Nickname"><input style={s.input} value={form.name} onChange={set('name')} placeholder="e.g. Primary Home"/></Field>
      <Field label="Loan Type"><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{LOAN_TYPES.map(t=>(<div key={t.id} onClick={()=>setForm(f=>({...f,loan_type:t.id}))} style={{padding:'10px 16px',borderRadius:8,cursor:'pointer',border:`2px solid ${form.loan_type===t.id?'var(--gold)':'var(--border)'}`,background:form.loan_type===t.id?'rgba(201,151,58,0.08)':'var(--surface)',fontSize:13,fontWeight:form.loan_type===t.id?600:400,color:form.loan_type===t.id?'var(--gold)':'var(--ink)'}}>{t.icon} {t.label}</div>))}</div></Field>
      <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Original Amount ($)"><input style={s.input} type="number" value={form.original_amount} onChange={set('original_amount')} placeholder="350000"/></Field>
        <Field label="Interest Rate (%)"><input style={s.input} type="number" step="0.001" value={form.interest_rate} onChange={set('interest_rate')} placeholder="6.750"/></Field>
        <Field label="Loan Term"><select style={s.input} value={form.loan_term_months} onChange={set('loan_term_months')}><option value={60}>5 Years</option><option value={84}>7 Years</option><option value={120}>10 Years</option><option value={180}>15 Years</option><option value={240}>20 Years</option><option value={360}>30 Years</option></select></Field>
        <Field label="Start Date"><input style={s.input} type="date" value={form.start_date} onChange={set('start_date')}/></Field>
      </div>
      <Field label="Monthly Payment (P+I)"><div style={{display:'flex',gap:8}}><input style={s.input} type="number" value={form.monthly_payment} onChange={set('monthly_payment')} placeholder="Auto-calculate →"/><button style={s.btn('outline')} onClick={calcPayment}>Calc</button></div></Field>
      {isARM&&(<div style={{padding:16,borderRadius:10,border:'1px solid var(--gold)',background:'rgba(201,151,58,0.05)'}}>
        <div style={{fontSize:13,fontWeight:600,color:'var(--gold)',marginBottom:12}}>📈 ARM Settings</div>
        <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Fixed Period (months)"><input style={s.input} type="number" value={form.arm_fixed_months} onChange={set('arm_fixed_months')} placeholder="84 (7yr ARM)"/></Field>
          <Field label="Periodic Cap (%)"><input style={s.input} type="number" step="0.25" value={form.arm_periodic_cap} onChange={set('arm_periodic_cap')} placeholder="2.0"/></Field>
          <Field label="Lifetime Rate Cap (%)"><input style={s.input} type="number" step="0.25" value={form.arm_rate_cap} onChange={set('arm_rate_cap')} placeholder="e.g. 11.75"/></Field>
          <Field label="Rate Floor (%)"><input style={s.input} type="number" step="0.25" value={form.arm_rate_floor} onChange={set('arm_rate_floor')} placeholder="e.g. 3.0"/></Field>
        </div>
      </div>)}
      <div style={{display:'flex',gap:10,marginTop:8,justifyContent:'flex-end'}}>
        <button style={s.btn('ghost')} onClick={onCancel}>Cancel</button>
        <button style={s.btn()} onClick={()=>onSave(form)}>Save Loan</button>
      </div>
    </div>
  );
}

// ─── DOCUMENT UPLOADER ────────────────────────────────────────────────────────
function DocumentUploader({loanId,paymentId,escrowItemId,billId,onUploaded,compact,description:initDesc=''}){
  const [uploading,setUploading]=useState(false);
  const [desc,setDesc]=useState(initDesc);
  const [dragOver,setDragOver]=useState(false);
  const uid=`doc-upload-${paymentId||escrowItemId||billId||'loan'}-${Math.random().toString(36).slice(2)}`;
  const upload=async(file)=>{
    setUploading(true);
    const fd=new FormData();fd.append('file',file);
    if(paymentId)fd.append('payment_id',paymentId);
    if(escrowItemId)fd.append('escrow_item_id',escrowItemId);
    if(billId)fd.append('bill_id',billId);
    if(desc)fd.append('description',desc);
    fd.append('doc_type',paymentId?'statement':escrowItemId?'escrow':billId?'bill':'document');
    if(billId){await authFetch(`${API}/bills/${billId}/documents`,{method:'POST',body:fd});}
    else{await authFetch(`${API}/loans/${loanId}/documents`,{method:'POST',body:fd});}
    setUploading(false);setDesc('');onUploaded();
  };
  const onDrop=(e)=>{e.preventDefault();setDragOver(false);if(e.dataTransfer.files[0])upload(e.dataTransfer.files[0]);};
  if(compact)return(
    <div><input type="file" id={uid} accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif" style={{display:'none'}} onChange={e=>e.target.files[0]&&upload(e.target.files[0])}/>
      <button style={{...s.btn('outline'),fontSize:12,padding:'5px 10px'}} onClick={()=>document.getElementById(uid).click()} disabled={uploading}>{uploading?'⏳':'📎 Attach'}</button>
    </div>
  );
  return(
    <div>
      <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop} onClick={()=>document.getElementById(uid).click()} style={{...s.uploadZone,background:dragOver?'rgba(201,151,58,0.1)':'rgba(201,151,58,0.04)',marginBottom:10}}>
        <input id={uid} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif" style={{display:'none'}} onChange={e=>e.target.files[0]&&upload(e.target.files[0])}/>
        {uploading?<div style={{color:'var(--gold)'}}>⏳ Uploading...</div>:<><div style={{fontSize:28,marginBottom:4}}>📎</div><div style={{fontSize:13,color:'var(--warm-gray)'}}>Drop file or click to upload</div><div style={{fontSize:11,color:'var(--warm-gray)',marginTop:2}}>PDF, JPG, PNG supported · 50MB max</div></>}
      </div>
      <input style={s.input} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description (optional)"/>
    </div>
  );
}

// ─── DOCUMENT LIST ────────────────────────────────────────────────────────────
function DocumentList({loanId,paymentId,escrowItemId,billId,refresh,onNavigateToPayment}){
  const [docs,setDocs]=useState([]);
  const load=useCallback(()=>{
    let url;
    if(billId)url=`${API}/bills/${billId}/documents`;
    else if(escrowItemId)url=`${API}/escrow/${escrowItemId}/documents`;
    else if(paymentId)url=`${API}/loans/${loanId}/documents?payment_id=${paymentId}`;
    else url=`${API}/loans/${loanId}/documents`;
    authFetch(url).then(r=>r.json()).then(setDocs);
  },[loanId,paymentId,escrowItemId,billId]);
  useEffect(()=>{load();},[load,refresh]);
  const del=async(id)=>{if(!confirm('Remove this document?'))return;await authFetch(`${API}/documents/${id}`,{method:'DELETE'});load();};
  const icon=(name)=>/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(name)?'🖼️':'📄';
  if(!docs.length)return null;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8}}>
      {docs.map(d=>(
        <div key={d.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'var(--surface)',borderRadius:6,fontSize:12}}>
          <span>{icon(d.original_name)}</span>
          <a href={`/statements/${d.filename}`} target="_blank" rel="noreferrer" style={{color:'var(--gold)',textDecoration:'none',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.description||d.original_name}</a>
          {d.payment_date&&onNavigateToPayment&&<button style={{background:'none',border:'1px solid var(--border)',borderRadius:4,fontSize:10,color:'var(--warm-gray)',cursor:'pointer',padding:'2px 6px',whiteSpace:'nowrap'}} onClick={()=>onNavigateToPayment(d.payment_id)}>→ Payment</button>}
          <span style={{color:'var(--warm-gray)',fontSize:11}}>{new Date(d.uploaded_at).toLocaleDateString()}</span>
          <button onClick={()=>del(d.id)} style={{background:'none',border:'none',color:'var(--warm-gray)',cursor:'pointer',fontSize:14,padding:'0 2px'}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── STORE PDF WITHOUT AI ─────────────────────────────────────────────────────
function StorePDFSection({loanId,paymentId,escrowItemId,onStored}){
  const [uploading,setUploading]=useState(false);
  const [desc,setDesc]=useState('');
  const [msg,setMsg]=useState(null);
  const uid=`store-pdf-${paymentId||escrowItemId||'general'}-${Math.random().toString(36).slice(2)}`;
  const store=async(file)=>{
    setUploading(true);setMsg(null);
    const fd=new FormData();fd.append('pdf',file);
    if(paymentId)fd.append('payment_id',paymentId);
    if(escrowItemId)fd.append('escrow_item_id',escrowItemId);
    fd.append('doc_type',escrowItemId?'escrow':'statement');
    if(desc)fd.append('description',desc);
    const r=await authFetch(`${API}/loans/${loanId}/store-pdf`,{method:'POST',body:fd});
    const data=await r.json();
    setUploading(false);
    if(data.success){setMsg('✓ PDF saved to Documents');setDesc('');onStored&&onStored(data.document);}
    else setMsg('⚠ '+data.error);
  };
  return(
    <div style={{padding:16,borderRadius:10,border:'1px solid var(--border)',background:'var(--surface)'}}>
      <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'var(--ink)'}}>📁 Save to Documents (no AI analysis)</div>
      <input type="file" id={uid} accept=".pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&store(e.target.files[0])}/>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input style={{...s.input,flex:1}} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Label/description (optional)"/>
        <button style={s.btn('outline')} onClick={()=>document.getElementById(uid).click()} disabled={uploading}>{uploading?'⏳ Saving...':'📁 Choose PDF'}</button>
      </div>
      {msg&&<div style={{marginTop:8,fontSize:12,color:msg.startsWith('✓')?'var(--sage)':'var(--terracotta)'}}>{msg}</div>}
    </div>
  );
}

// ─── ARM RATE MANAGER ─────────────────────────────────────────────────────────
function ARMRateManager({loan,onUpdate}){
  const [rates,setRates]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [form,setForm]=useState({effective_date:'',rate:'',notes:''});
  const load=()=>authFetch(`${API}/loans/${loan.id}/arm-rates`).then(r=>r.json()).then(setRates);
  useEffect(()=>{load();},[loan.id]);
  const save=async()=>{await authFetch(`${API}/loans/${loan.id}/arm-rates`,{method:'POST',body:JSON.stringify(form)});setShowForm(false);setForm({effective_date:'',rate:'',notes:''});load();onUpdate();};
  const del=async(id)=>{if(!confirm('Remove?'))return;await authFetch(`${API}/arm-rates/${id}`,{method:'DELETE'});load();};
  const fixedEnds=loan.arm_fixed_months&&loan.start_date?new Date(new Date(loan.start_date).setMonth(new Date(loan.start_date).getMonth()+loan.arm_fixed_months)).toISOString().split('T')[0]:null;
  return(
    <div>
      <div style={{...s.pageHeader}}><h1 style={s.pageTitle}>ARM Rate History</h1><p style={s.pageSub}>Track rate adjustments over time</p></div>
      <div style={{...s.card,marginBottom:20,border:'1px solid var(--gold)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div><h3 style={{...s.sectionTitle,marginBottom:2}}>📈 Rate Log</h3>{fixedEnds&&<p style={{fontSize:12,color:'var(--warm-gray)'}}>Fixed period ends: <strong>{fmtDate(fixedEnds)}</strong> · Current: <strong>{loan.interest_rate}%</strong></p>}</div>
          <button style={s.btn('outline')} onClick={()=>setShowForm(!showForm)}>+ Log Rate Change</button>
        </div>
        {showForm&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:10,marginBottom:16,alignItems:'flex-end'}}>
          <Field label="Effective Date"><input style={s.input} type="date" value={form.effective_date} onChange={e=>setForm(f=>({...f,effective_date:e.target.value}))}/></Field>
          <Field label="New Rate (%)"><input style={s.input} type="number" step="0.125" value={form.rate} onChange={e=>setForm(f=>({...f,rate:e.target.value}))} placeholder="7.25"/></Field>
          <Field label="Notes"><input style={s.input} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Annual adjustment"/></Field>
          <div style={{display:'flex',gap:6}}><button style={s.btn()} onClick={save}>Save</button><button style={s.btn('ghost')} onClick={()=>setShowForm(false)}>Cancel</button></div>
        </div>)}
        {rates.length>0?(<table style={s.table}><thead><tr><th style={s.th}>Date</th><th style={s.th}>Rate</th><th style={s.th}>Notes</th><th style={s.th}></th></tr></thead><tbody>{rates.map(r=>(<tr key={r.id}><td style={s.td}>{fmtDate(r.effective_date)}</td><td style={{...s.td,color:'var(--gold)',fontWeight:600}}>{r.rate}%</td><td style={s.td}>{r.notes||'—'}</td><td style={s.td}><button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>del(r.id)}>Del</button></td></tr>))}</tbody></table>)
        :<p style={{fontSize:13,color:'var(--warm-gray)'}}>No rate changes logged yet.</p>}
      </div>
    </div>
  );
}

// ─── PAYMENT FORM ─────────────────────────────────────────────────────────────
function PaymentForm({loanId,hasEscrow,initial={},onSave,onCancel}){
  const [form,setForm]=useState({payment_date:initial.payment_date?initial.payment_date.split('T')[0]:new Date().toISOString().split('T')[0],total_payment:initial.total_payment||'',principal:initial.principal||'',interest:initial.interest||'',escrow:initial.escrow||'',extra_principal:initial.extra_principal||'0',ending_balance:initial.ending_balance||'',statement_month:initial.statement_month||'',notes:initial.notes||''});
  const [uploading,setUploading]=useState(false);
  const [uploadResult,setUploadResult]=useState(null);
  const [dragOver,setDragOver]=useState(false);
  const [provider,setProvider]=useState('claude');
  const [lastBalance,setLastBalance]=useState(null);
  const [tempPdfFilename,setTempPdfFilename]=useState(null);
  const PROVIDERS=[{id:'claude',label:'Claude'},{id:'openai',label:'ChatGPT'},{id:'gemini',label:'Gemini'},{id:'copilot',label:'Copilot'}];
  useEffect(()=>{if(!initial.id)authFetch(`${API}/loans/${loanId}/latest-balance`).then(r=>r.json()).then(d=>setLastBalance(d.balance));},[loanId]);
  const set=(k)=>(e)=>setForm(f=>({...f,[k]:e.target.value}));
  const autoCalcEndingBalance=()=>{if(lastBalance==null)return;const paid=(parseFloat(form.principal)||0)+(parseFloat(form.extra_principal)||0);setForm(f=>({...f,ending_balance:Math.max(0,lastBalance-paid).toFixed(2)}));};
  const fieldSum=(parseFloat(form.principal)||0)+(parseFloat(form.interest)||0)+(hasEscrow?parseFloat(form.escrow)||0:0)+(parseFloat(form.extra_principal)||0);
  const mismatch=parseFloat(form.total_payment)>0&&Math.abs(fieldSum-parseFloat(form.total_payment))>0.02;
  const processPDF=async(file)=>{
    setUploading(true);setUploadResult(null);
    const fd=new FormData();fd.append('pdf',file);fd.append('provider',provider);
    try{
      const r=await authFetch(`${API}/loans/${loanId}/process-pdf`,{method:'POST',body:fd});
      const data=await r.json();
      if(data.success){const e=data.extracted;setUploadResult('✓ Data extracted — review before saving');setTempPdfFilename(data.tempFilename||null);setForm(f=>({...f,payment_date:e.payment_date||f.payment_date,statement_month:e.statement_month||f.statement_month,total_payment:e.total_payment||f.total_payment,principal:e.principal||f.principal,interest:e.interest||f.interest,escrow:e.escrow||f.escrow,extra_principal:e.extra_principal||f.extra_principal||'0',ending_balance:e.ending_balance||f.ending_balance,notes:e.notes||f.notes}));}
      else setUploadResult('⚠ '+data.error);
    }catch(err){setUploadResult('⚠ Failed: '+err.message);}
    setUploading(false);
  };
  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* AI PDF upload */}
      <div style={{...s.card,padding:16,border:'1px solid var(--gold)'}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'var(--gold)'}}>🤖 AI Statement Extraction</div>
        <div style={{...s.uploadZone,background:dragOver?'rgba(201,151,58,0.1)':'rgba(201,151,58,0.04)',marginBottom:10}} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);processPDF(e.dataTransfer.files[0]);}} onClick={()=>document.getElementById('pdfIn').click()}>
          <input id="pdfIn" type="file" accept=".pdf" style={{display:'none'}} onChange={e=>processPDF(e.target.files[0])}/>
          {uploading?<div style={{color:'var(--gold)'}}>🔄 Processing with {PROVIDERS.find(p=>p.id===provider)?.label}...</div>:<><div style={{fontSize:24,marginBottom:4}}>📄</div><div style={{fontSize:13,color:'var(--warm-gray)'}}>Drop statement PDF for AI data extraction</div></>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
          <label style={{fontSize:13,fontWeight:600,color:'var(--ink)',whiteSpace:'nowrap'}}>AI Provider:</label>
          <select value={provider} onChange={e=>setProvider(e.target.value)} style={{flex:1,padding:'6px 10px',fontSize:13,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--ink)',cursor:'pointer',outline:'none'}}>{PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
          <span style={{fontSize:12,color:'var(--warm-gray)',whiteSpace:'nowrap'}}>Keys in ⚙️ Settings</span>
        </div>
        {uploadResult&&<div style={{marginTop:8,padding:'8px 12px',background:uploadResult.startsWith('✓')?'#E8F5E9':'#FFF3E0',borderRadius:8,fontSize:13,color:uploadResult.startsWith('✓')?'var(--sage)':'var(--terracotta)'}}>{uploadResult}</div>}
      </div>
      {/* Store PDF without AI */}
      <StorePDFSection loanId={loanId} paymentId={initial.id} onStored={()=>{}}/>
      {/* Manual fields */}
      <Field label="Total Payment ($)"><input style={s.input} type="number" value={form.total_payment} onChange={set('total_payment')} placeholder="e.g. 1842.50"/></Field>
      {mismatch&&<div style={{padding:'8px 12px',background:'#FFF3E0',borderRadius:8,fontSize:13,color:'var(--terracotta)'}}>⚠ Fields sum to {fmt(fieldSum)} — doesn't match total {fmt(parseFloat(form.total_payment))}</div>}
      <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <Field label="Payment Date"><input style={s.input} type="date" value={form.payment_date} onChange={set('payment_date')}/></Field>
        <Field label="Statement Month"><input style={s.input} type="month" value={form.statement_month} onChange={set('statement_month')}/></Field>
        <Field label="Principal ($)"><input style={s.input} type="number" value={form.principal} onChange={set('principal')}/></Field>
        <Field label="Interest ($)"><input style={s.input} type="number" value={form.interest} onChange={set('interest')}/></Field>
        {hasEscrow&&<Field label="Escrow ($)"><input style={s.input} type="number" value={form.escrow} onChange={set('escrow')}/></Field>}
        <Field label="Extra Principal ($)"><input style={s.input} type="number" value={form.extra_principal} onChange={set('extra_principal')}/></Field>
      </div>
      <Field label="Ending Balance ($)">
        <div style={{display:'flex',gap:8}}>
          <input style={s.input} type="number" value={form.ending_balance} onChange={set('ending_balance')} placeholder={lastBalance!=null?`Prev: ${fmt(lastBalance)}`:''}/>
          {lastBalance!=null&&!initial.id&&<button style={{...s.btn('outline'),whiteSpace:'nowrap',fontSize:12}} onClick={autoCalcEndingBalance}>Auto-calc</button>}
        </div>
        {lastBalance!=null&&!initial.id&&<div style={{fontSize:11,color:'var(--warm-gray)',marginTop:4}}>Previous: {fmt(lastBalance)}</div>}
      </Field>
      <Field label="Notes"><textarea style={{...s.input,height:60,resize:'vertical'}} value={form.notes} onChange={set('notes')}/></Field>
      <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
        <button style={s.btn('ghost')} onClick={onCancel}>Cancel</button>
        <button style={s.btn()} onClick={()=>onSave({...form,_tempPdfFilename:tempPdfFilename})}>{mismatch?'Save Anyway':'Save Payment'}</button>
      </div>
    </div>
  );
}

// ─── PAYMENTS VIEW ────────────────────────────────────────────────────────────
function PaymentsView({loan,payments,onRefresh,onNavigateToDocuments}){
  const [showForm,setShowForm]=useState(false);
  const [editPayment,setEditPayment]=useState(null);
  const [docRefresh,setDocRefresh]=useState(0);
  const lt=loanTypeInfo(loan?.loan_type);
  const savePayment=async(form)=>{
    const{_tempPdfFilename,...data}=form;
    const method=editPayment?'PUT':'POST';
    const url=editPayment?`${API}/payments/${editPayment.id}`:`${API}/loans/${loan.id}/payments`;
    const r=await authFetch(url,{method,body:JSON.stringify(data)});
    const saved=await r.json();
    if(_tempPdfFilename&&saved.id){await authFetch(`${API}/payments/${saved.id}/attach-temp-pdf`,{method:'POST',body:JSON.stringify({tempFilename:_tempPdfFilename})});}
    setShowForm(false);setEditPayment(null);onRefresh();
  };
  const delPayment=async(id)=>{if(!confirm('Delete this payment?'))return;await authFetch(`${API}/payments/${id}`,{method:'DELETE'});onRefresh();};
  if(!loan)return<div style={s.card}><p style={{color:'var(--warm-gray)'}}>Select a loan first</p></div>;
  const sorted=[...payments].sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date));
  return(
    <div>
      <div className="page-header-row" style={{...s.pageHeader,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1 style={s.pageTitle}>💳 Payment History</h1><p style={s.pageSub}>{payments.length} payments for {loan.name}</p></div>
        <button style={s.btn()} onClick={()=>{setEditPayment(null);setShowForm(true);}}>+ Add Payment</button>
      </div>
      {showForm&&(<div style={{...s.card,marginBottom:20}}><h3 style={{...s.sectionTitle,marginBottom:20}}>{editPayment?'Edit Payment':'Add Payment'}</h3><PaymentForm loanId={loan.id} hasEscrow={lt.hasEscrow} initial={editPayment||{}} onSave={savePayment} onCancel={()=>{setShowForm(false);setEditPayment(null);}}/></div>)}
      <div style={s.card}>
        {payments.length===0?<div style={{padding:'40px',textAlign:'center',color:'var(--warm-gray)'}}>No payments yet. Click "+ Add Payment" to get started.</div>:(
          <div style={{overflowX:'auto'}}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Date</th><th style={s.th}>Total</th><th style={s.th}>Principal</th><th style={s.th}>Interest</th>{lt.hasEscrow&&<th className="col-escrow" style={s.th}>Escrow</th>}<th className="col-extra" style={s.th}>Extra</th><th style={s.th}>Balance</th><th style={s.th}>Docs</th><th style={s.th}></th></tr></thead>
              <tbody>{sorted.map(p=>(<tr key={p.id}>
                <td style={s.td}>{fmtDate(p.payment_date)}</td>
                <td style={{...s.td,fontWeight:600}}>{fmt(p.total_payment)}</td>
                <td style={{...s.td,color:'var(--gold)'}}>{fmt(p.principal)}</td>
                <td style={{...s.td,color:'var(--terracotta)'}}>{fmt(p.interest)}</td>
                {lt.hasEscrow&&<td className="col-escrow" style={{...s.td,color:'var(--chart-escrow)'}}>{fmt(p.escrow)}</td>}
                <td className="col-extra" style={{...s.td,color:'var(--sage)'}}>{fmt(p.extra_principal)}</td>
                <td style={s.td}>{fmt(p.ending_balance)}</td>
                <td style={s.td}>
                  <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                    <DocumentUploader loanId={loan.id} paymentId={p.id} compact onUploaded={()=>setDocRefresh(x=>x+1)}/>
                    <DocumentList loanId={loan.id} paymentId={p.id} refresh={docRefresh} onNavigateToPayment={onNavigateToDocuments?()=>onNavigateToDocuments():null}/>
                  </div>
                </td>
                <td style={s.td}><div style={{display:'flex',gap:6}}><button style={s.btn('sm')} onClick={()=>{setEditPayment(p);setShowForm(true);window.scrollTo(0,0);}}>Edit</button><button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>delPayment(p.id)}>Del</button></div></td>
              </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── CALCULATOR ───────────────────────────────────────────────────────────────
function ScenarioResult({label,color,scenario,savings}){
  if(!scenario)return null;
  const isBase=!savings;
  return(<div style={{borderRadius:10,padding:16,background:isBase?'var(--surface)':color+'18',border:`1px solid ${isBase?'var(--border)':color+'44'}`}}>
    <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:isBase?'var(--warm-gray)':color,marginBottom:8}}>{label}</div>
    <div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:isBase?'var(--ink)':color}}>{fmtDate(scenario.payoffDate)}</div>
    <div style={{fontSize:13,color:'var(--warm-gray)',marginTop:3}}>{fmtMonths(scenario.months)} · {fmt(scenario.totalInterest)} interest</div>
    {savings&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${color}33`,display:'flex',gap:20}}><div><div style={{fontSize:11,color:'var(--warm-gray)'}}>Time saved</div><div style={{fontSize:15,fontWeight:600,color}}>{fmtMonths(savings.months)}</div></div><div><div style={{fontSize:11,color:'var(--warm-gray)'}}>Interest saved</div><div style={{fontSize:15,fontWeight:600,color}}>{fmt(savings.interest)}</div></div></div>}
  </div>);
}

function Calculator({loan}){
  const [extraMonthly,setExtraMonthly]=useState('');
  const [lumpSum,setLumpSum]=useState('');
  const [result,setResult]=useState(null);
  const [targetDates,setTargetDates]=useState(['','','']);
  const [amortize,setAmortize]=useState([]);
  const [showAmort,setShowAmort]=useState(false);
  const [amortScenario,setAmortScenario]=useState('base');
  const calculate=async()=>{const r=await authFetch(`${API}/loans/${loan.id}/calculate-payoff`,{method:'POST',body:JSON.stringify({extra_monthly:parseFloat(extraMonthly)||0,lump_sum:parseFloat(lumpSum)||0,target_dates:targetDates.filter(Boolean)})});setResult(await r.json());setShowAmort(false);};
  const buildAmort=(scenario)=>{
    if(!loan)return;
    const startBal=(scenario==='base'||scenario==='monthly')?parseFloat(loan.current_balance||loan.original_amount):Math.max(0,parseFloat(loan.current_balance||loan.original_amount)-(parseFloat(lumpSum)||0));
    const extra=(scenario==='monthly'||scenario==='combined')?(parseFloat(extraMonthly)||0):0;
    const r=parseFloat(loan.interest_rate)/100/12,payment=parseFloat(loan.monthly_payment)+extra;
    let bal=startBal;const rows=[];let month=0;
    while(bal>0.01&&month<600){month++;const ic=bal*r,pr=Math.min(payment-ic,bal);bal=Math.max(0,bal-pr);rows.push({month,interest:ic.toFixed(2),principal:pr.toFixed(2),balance:bal.toFixed(2)});}
    setAmortize(rows);setAmortScenario(scenario);setShowAmort(true);
  };
  if(!loan)return<div style={s.card}><p style={{color:'var(--warm-gray)'}}>Select a loan first</p></div>;
  const hasMonthly=parseFloat(extraMonthly)>0,hasLump=parseFloat(lumpSum)>0,isARM=loan.loan_type==='arm';
  return(
    <div>
      <div style={s.pageHeader}><h1 style={s.pageTitle}>Payoff Calculator</h1><p style={s.pageSub}>Model extra payments and target payoff dates</p></div>
      <div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>Extra Payment Scenarios</h3>
        <div className="calc-input-row" style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:16,alignItems:'flex-end',marginBottom:12}}>
          <Field label="Extra Monthly Payment ($)"><input style={s.input} type="number" min="0" value={extraMonthly} onChange={e=>setExtraMonthly(e.target.value)} placeholder="e.g. 200"/></Field>
          <Field label="One-Time Lump Sum ($)"><input style={s.input} type="number" min="0" value={lumpSum} onChange={e=>setLumpSum(e.target.value)} placeholder="e.g. 5000"/></Field>
          <button style={{...s.btn(),padding:'9px 28px',whiteSpace:'nowrap'}} onClick={calculate}>Calculate</button>
        </div>
        <div style={{fontSize:12,color:'var(--warm-gray)'}}>Balance: <strong>{fmt(loan.current_balance||loan.original_amount)}</strong> · Payment: <strong>{fmt(loan.monthly_payment)}</strong> · Rate: <strong>{loan.interest_rate}%</strong></div>
      </div>
      <div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>Payoff-by-Date Calculator</h3>
        <p style={{fontSize:13,color:'var(--warm-gray)',marginBottom:16}}>Enter up to 3 target dates — see how much extra you'd need monthly.</p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end',marginBottom:12}}>
          {targetDates.map((d,i)=>(<Field key={i} label={`Target Date ${i+1}`}><input style={{...s.input,width:160}} type="date" value={d} onChange={e=>{const arr=[...targetDates];arr[i]=e.target.value;setTargetDates(arr);}}/></Field>))}
          <button style={{...s.btn(),padding:'9px 28px',whiteSpace:'nowrap'}} onClick={calculate}>Calculate</button>
        </div>
      </div>
      {result&&(<>
        {(result.base||result.monthly||result.lump||result.combined)&&(<div style={{...s.card,marginBottom:20}}><h3 style={{...s.sectionTitle,marginBottom:16}}>Scenario Results</h3><div className="scenario-grid" style={{display:'grid',gridTemplateColumns:`repeat(${1+(hasMonthly?1:0)+(hasLump?1:0)+(hasMonthly&&hasLump?1:0)},1fr)`,gap:12}}>{result.base&&<ScenarioResult label="Baseline" scenario={result.base}/>}{hasMonthly&&result.monthly&&<ScenarioResult label={`+${fmt(extraMonthly)}/mo`} color="var(--sage)" scenario={result.monthly} savings={result.savings?.monthly}/>}{hasLump&&result.lump&&<ScenarioResult label={`${fmt(lumpSum)} lump sum`} color="var(--gold)" scenario={result.lump} savings={result.savings?.lump}/>}{hasMonthly&&hasLump&&result.combined&&<ScenarioResult label="Combined" color="var(--terracotta)" scenario={result.combined} savings={result.savings?.combined}/>}</div></div>)}
        {result.targetResults?.length>0&&(<div style={{...s.card,marginBottom:20}}><h3 style={{...s.sectionTitle,marginBottom:16}}>Payoff-by-Date Results</h3><div className="scenario-grid" style={{display:'grid',gridTemplateColumns:`repeat(${result.targetResults.length},1fr)`,gap:12}}>{result.targetResults.map((tr,i)=>(<div key={i} style={{borderRadius:10,padding:16,background:tr.impossible?'var(--surface)':'rgba(74,103,65,0.1)',border:`1px solid ${tr.impossible?'var(--border)':'var(--sage)44'}`}}><div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',color:tr.impossible?'var(--warm-gray)':'var(--sage)',marginBottom:8}}>Target: {fmtDate(tr.date)}</div>{tr.impossible?(<div style={{color:'var(--terracotta)',fontSize:13}}>⚠ {tr.reason}</div>):(<><div style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:'var(--sage)'}}>{fmt(tr.extraMonthlyNeeded)}<span style={{fontSize:14}}>/mo extra</span></div><div style={{fontSize:13,color:'var(--warm-gray)',marginTop:4}}>Total payment: {fmt(tr.totalPayment)}</div><div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--sage)33',display:'flex',gap:16}}><div><div style={{fontSize:11,color:'var(--warm-gray)'}}>Time saved</div><div style={{fontSize:14,fontWeight:600,color:'var(--sage)'}}>{fmtMonths(tr.monthsSaved)}</div></div><div><div style={{fontSize:11,color:'var(--warm-gray)'}}>Interest saved</div><div style={{fontSize:14,fontWeight:600,color:'var(--sage)'}}>{fmt(tr.interestSaved)}</div></div></div></>)}</div>))}</div></div>)}
        {isARM&&result.armScenarios?.length>0&&(<div style={{...s.card,marginBottom:20,border:'1px solid var(--gold)'}}><h3 style={{...s.sectionTitle,marginBottom:16}}>📈 ARM Rate Scenarios</h3><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>{result.armScenarios.map((sc,i)=>(<div key={i} style={{borderRadius:10,padding:16,background:'var(--surface)',border:'1px solid var(--border)'}}><div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',color:'var(--warm-gray)',marginBottom:8}}>{sc.label}</div><div style={{fontSize:20,color:'var(--gold)',fontWeight:700}}>{sc.rate}%</div><div style={{fontFamily:"'DM Serif Display',serif",fontSize:18,color:'var(--ink)',marginTop:4}}>{fmtDate(sc.payoffDate)}</div><div style={{fontSize:12,color:'var(--warm-gray)',marginTop:2}}>{fmtMonths(sc.months)} · {fmt(sc.totalInterest)} interest</div></div>))}</div></div>)}
      </>)}
      <div style={s.card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:showAmort?16:0,flexWrap:'wrap',gap:10}}>
          <h3 style={s.sectionTitle}>Amortization Schedule</h3>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {showAmort&&<button style={s.btn('ghost')} onClick={()=>setShowAmort(false)}>Hide</button>}
            <button style={s.btn('outline')} onClick={()=>buildAmort('base')}>Baseline</button>
            {result&&hasMonthly&&<button style={{...s.btn('outline'),borderColor:'var(--sage)',color:'var(--sage)'}} onClick={()=>buildAmort('monthly')}>+Monthly</button>}
            {result&&hasLump&&<button style={{...s.btn('outline'),borderColor:'var(--gold)',color:'var(--gold)'}} onClick={()=>buildAmort('lump')}>Lump Sum</button>}
            {result&&hasMonthly&&hasLump&&<button style={{...s.btn('outline'),borderColor:'var(--terracotta)',color:'var(--terracotta)'}} onClick={()=>buildAmort('combined')}>Combined</button>}
          </div>
        </div>
        {showAmort&&<><div style={{fontSize:12,color:'var(--warm-gray)',marginBottom:12}}>Showing: <strong>{amortScenario}</strong> — {amortize.length} months</div><div style={{overflowX:'auto',maxHeight:400}}><table style={s.table}><thead><tr>{['Month','Principal','Interest','Balance'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead><tbody>{amortize.map(r=><tr key={r.month}><td style={s.td}>{r.month}</td><td style={{...s.td,color:'var(--gold)'}}>{fmt(r.principal)}</td><td style={{...s.td,color:'var(--terracotta)'}}>{fmt(r.interest)}</td><td style={s.td}>{fmt(r.balance)}</td></tr>)}</tbody></table></div></>}
        {!showAmort&&<p style={{fontSize:13,color:'var(--warm-gray)',marginTop:8}}>Click a scenario button above to view the full amortization table.</p>}
      </div>
    </div>
  );
}

// ─── ESCROW VIEW ──────────────────────────────────────────────────────────────
function EscrowView({loan}){
  const [items,setItems]=useState([]);
  const [account,setAccount]=useState(null);
  const [ledger,setLedger]=useState([]);
  const [adjustments,setAdjustments]=useState([]);
  const [showForm,setShowForm]=useState(false);
  const [showAccountForm,setShowAccountForm]=useState(false);
  const [showAdjForm,setShowAdjForm]=useState(false);
  const [showAnalyze,setShowAnalyze]=useState(false);
  const [form,setForm]=useState({item_type:'tax',description:'',amount:'',payment_date:'',year:new Date().getFullYear()});
  const [acctForm,setAcctForm]=useState({starting_balance:'',target_balance:'',notes:''});
  const [adjForm,setAdjForm]=useState({effective_date:'',new_monthly_escrow:'',new_target_balance:'',reason:'',notes:''});
  const [provider,setProvider]=useState('claude');
  const [analyzing,setAnalyzing]=useState(false);
  const [analyzeResult,setAnalyzeResult]=useState(null);
  const [docRefresh,setDocRefresh]=useState(0);
  const PROVIDERS=[{id:'claude',label:'Claude'},{id:'openai',label:'ChatGPT'},{id:'gemini',label:'Gemini'},{id:'copilot',label:'Copilot'}];

  const loadAll=useCallback(()=>{
    if(!loan)return;
    authFetch(`${API}/loans/${loan.id}/escrow`).then(r=>r.json()).then(setItems);
    authFetch(`${API}/loans/${loan.id}/escrow-account`).then(r=>r.json()).then(d=>{setAccount(d);setAcctForm({starting_balance:d.starting_balance||'',target_balance:d.target_balance||'',notes:d.notes||''});});
    authFetch(`${API}/loans/${loan.id}/escrow-balance`).then(r=>r.json()).then(d=>setLedger(d.ledger||[]));
    authFetch(`${API}/loans/${loan.id}/escrow-adjustments`).then(r=>r.json()).then(setAdjustments);
  },[loan]);
  useEffect(()=>{loadAll();},[loadAll]);

  const set=(k)=>(e)=>setForm(f=>({...f,[k]:e.target.value}));
  const save=async()=>{await authFetch(`${API}/loans/${loan.id}/escrow`,{method:'POST',body:JSON.stringify(form)});setShowForm(false);loadAll();};
  const saveAcct=async()=>{await authFetch(`${API}/loans/${loan.id}/escrow-account`,{method:'POST',body:JSON.stringify(acctForm)});setShowAccountForm(false);loadAll();};
  const saveAdj=async()=>{await authFetch(`${API}/loans/${loan.id}/escrow-adjustments`,{method:'POST',body:JSON.stringify(adjForm)});setShowAdjForm(false);loadAll();};
  const del=async(id)=>{if(!confirm('Delete?'))return;await authFetch(`${API}/escrow/${id}`,{method:'DELETE'});loadAll();};

  const analyzeEscrowPDF=async(file)=>{
    setAnalyzing(true);setAnalyzeResult(null);
    const fd=new FormData();fd.append('pdf',file);fd.append('provider',provider);
    const r=await authFetch(`${API}/loans/${loan.id}/analyze-escrow-pdf`,{method:'POST',body:fd});
    const data=await r.json();
    if(data.success){setAnalyzeResult(data.extracted);if(data.extracted.new_monthly_escrow)setAdjForm(f=>({...f,new_monthly_escrow:data.extracted.new_monthly_escrow,new_target_balance:data.extracted.target_balance||'',reason:'Annual escrow statement'}));}
    else setAnalyzeResult({error:data.error});
    setAnalyzing(false);
  };

  const taxes=items.filter(i=>i.item_type==='tax'),ins=items.filter(i=>i.item_type==='insurance');
  const currentBalance=ledger.length>0?ledger[ledger.length-1].running_balance:(account?.starting_balance||0);
  const targetBal=account?.target_balance;

  if(!loan)return<div style={s.card}><p style={{color:'var(--warm-gray)'}}>Select a loan first</p></div>;

  return(
    <div>
      <div className="page-header-row" style={{...s.pageHeader,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1 style={s.pageTitle}>Escrow Tracker</h1><p style={s.pageSub}>Bank-accurate escrow balance tracking</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button style={s.btn('outline')} onClick={()=>setShowAccountForm(!showAccountForm)}>⚙️ Account Setup</button>
          <button style={s.btn('outline')} onClick={()=>setShowAdjForm(!showAdjForm)}>📋 Annual Statement</button>
          <button style={s.btn()} onClick={()=>setShowForm(!showForm)}>+ Add Disbursement</button>
        </div>
      </div>

      {/* Running Balance Cards */}
      <div className="stat-grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
        <div style={s.statCard('var(--gold)')}><div style={s.statLabel}>Current Escrow Balance</div><div style={s.statValue}>{fmt(currentBalance)}</div><div style={s.statSub}>Starting: {fmt(account?.starting_balance||0)}</div></div>
        <div style={s.statCard('var(--terracotta)')}><div style={s.statLabel}>Total Taxes Paid</div><div style={s.statValue}>{fmt(taxes.reduce((s,i)=>s+parseFloat(i.amount),0))}</div><div style={s.statSub}>{taxes.length} disbursements</div></div>
        <div style={s.statCard('var(--chart-escrow)')}><div style={s.statLabel}>Total Insurance Paid</div><div style={s.statValue}>{fmt(ins.reduce((s,i)=>s+parseFloat(i.amount),0))}</div><div style={s.statSub}>{ins.length} disbursements</div></div>
      </div>

      {targetBal&&(<div style={{...s.card,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}><span style={{fontSize:14,fontWeight:600}}>Escrow Balance vs Target</span><span style={{fontSize:13,color:currentBalance>=targetBal?'var(--sage)':'var(--terracotta)'}}>{currentBalance>=targetBal?`✓ ${fmt(currentBalance-targetBal)} surplus`:`⚠ ${fmt(targetBal-currentBalance)} below target`}</span></div>
        <div style={{height:10,borderRadius:5,background:'var(--surface)',overflow:'hidden'}}><div style={{width:`${Math.min((currentBalance/targetBal)*100,100)}%`,height:'100%',background:currentBalance>=targetBal?'var(--sage)':'var(--gold)',borderRadius:5}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--warm-gray)',marginTop:4}}><span>{fmt(0)}</span><span>Target: {fmt(targetBal)}</span></div>
      </div>)}

      {/* Account Setup Form */}
      {showAccountForm&&(<div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:16}}>⚙️ Escrow Account Setup</h3>
        <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Starting Balance ($)"><input style={s.input} type="number" value={acctForm.starting_balance} onChange={e=>setAcctForm(f=>({...f,starting_balance:e.target.value}))} placeholder="0.00"/></Field>
          <Field label="Target Balance ($)"><input style={s.input} type="number" value={acctForm.target_balance} onChange={e=>setAcctForm(f=>({...f,target_balance:e.target.value}))} placeholder="e.g. 3000"/></Field>
        </div>
        <Field label="Notes"><input style={{...s.input,marginTop:12}} value={acctForm.notes} onChange={e=>setAcctForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Lender requires 2-month cushion"/></Field>
        <div style={{display:'flex',gap:10,marginTop:14,justifyContent:'flex-end'}}><button style={s.btn('ghost')} onClick={()=>setShowAccountForm(false)}>Cancel</button><button style={s.btn()} onClick={saveAcct}>Save</button></div>
      </div>)}

      {/* Annual Escrow Statement */}
      {showAdjForm&&(<div style={{...s.card,marginBottom:20,border:'1px solid var(--gold)'}}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>📋 Annual Escrow Statement</h3>
        <p style={{fontSize:13,color:'var(--warm-gray)',marginBottom:16}}>Log adjustments from your annual escrow analysis statement. AI can extract data from the PDF, or enter manually.</p>
        {/* AI Analysis */}
        <div style={{padding:16,borderRadius:10,border:'1px solid var(--gold)',background:'rgba(201,151,58,0.04)',marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:13,color:'var(--gold)',marginBottom:10}}>🤖 AI Statement Extraction</div>
          <input type="file" id="escrowPdfAI" accept=".pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&analyzeEscrowPDF(e.target.files[0])}/>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
            <select value={provider} onChange={e=>setProvider(e.target.value)} style={{flex:1,padding:'6px 10px',fontSize:13,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--ink)'}}>{PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <button style={s.btn('outline')} onClick={()=>document.getElementById('escrowPdfAI').click()} disabled={analyzing}>{analyzing?'⏳ Analyzing...':'📄 Upload & Analyze PDF'}</button>
          </div>
          {analyzeResult&&!analyzeResult.error&&(<div style={{fontSize:12,background:'#E8F5E9',padding:10,borderRadius:8,color:'var(--sage)'}}><strong>✓ Extracted:</strong> New monthly escrow: {fmt(analyzeResult.new_monthly_escrow)} · Target: {fmt(analyzeResult.target_balance)} · Shortage/surplus: {fmt(analyzeResult.shortage_surplus)}</div>)}
          {analyzeResult?.error&&<div style={{fontSize:12,color:'var(--terracotta)'}}>⚠ {analyzeResult.error}</div>}
        </div>
        {/* Store PDF without AI */}
        <StorePDFSection loanId={loan.id} onStored={()=>setDocRefresh(x=>x+1)}/>
        <div style={{height:1,background:'var(--border)',margin:'16px 0'}}/>
        {/* Manual Entry */}
        <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Effective Date"><input style={s.input} type="date" value={adjForm.effective_date} onChange={e=>setAdjForm(f=>({...f,effective_date:e.target.value}))}/></Field>
          <Field label="New Monthly Escrow ($)"><input style={s.input} type="number" value={adjForm.new_monthly_escrow} onChange={e=>setAdjForm(f=>({...f,new_monthly_escrow:e.target.value}))}/></Field>
          <Field label="New Target Balance ($)"><input style={s.input} type="number" value={adjForm.new_target_balance} onChange={e=>setAdjForm(f=>({...f,new_target_balance:e.target.value}))}/></Field>
          <Field label="Reason"><input style={s.input} value={adjForm.reason} onChange={e=>setAdjForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Tax increase"/></Field>
        </div>
        <Field label="Notes"><input style={{...s.input,marginTop:12}} value={adjForm.notes} onChange={e=>setAdjForm(f=>({...f,notes:e.target.value}))}/></Field>
        <div style={{display:'flex',gap:10,marginTop:14,justifyContent:'flex-end'}}><button style={s.btn('ghost')} onClick={()=>setShowAdjForm(false)}>Cancel</button><button style={s.btn()} onClick={saveAdj}>Save Adjustment</button></div>
      </div>)}

      {/* Adjustments History */}
      {adjustments.length>0&&(<div style={{...s.card,marginBottom:20}}>
        <h3 style={s.sectionTitle}>Annual Statement History</h3>
        <table style={s.table}><thead><tr><th style={s.th}>Effective Date</th><th style={s.th}>New Monthly Escrow</th><th style={s.th}>New Target</th><th style={s.th}>Reason</th><th style={s.th}></th></tr></thead>
        <tbody>{adjustments.map(a=>(<tr key={a.id}><td style={s.td}>{fmtDate(a.effective_date)}</td><td style={{...s.td,fontWeight:600,color:'var(--gold)'}}>{fmt(a.new_monthly_escrow)}</td><td style={s.td}>{fmt(a.new_target_balance)}</td><td style={s.td}>{a.reason||'—'}</td><td style={s.td}><button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>{authFetch(`${API}/escrow-adjustments/${a.id}`,{method:'DELETE'}).then(loadAll);}}>Del</button></td></tr>))}</tbody>
        </table>
      </div>)}

      {/* Add Disbursement Form */}
      {showForm&&(<div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:16}}>Add Escrow Disbursement</h3>
        <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Type"><select style={s.input} value={form.item_type} onChange={set('item_type')}><option value="tax">Property Tax</option><option value="insurance">Insurance</option><option value="other">Other</option></select></Field>
          <Field label="Amount ($)"><input style={s.input} type="number" value={form.amount} onChange={set('amount')}/></Field>
          <Field label="Payment Date"><input style={s.input} type="date" value={form.payment_date} onChange={set('payment_date')}/></Field>
          <Field label="Year"><input style={s.input} type="number" value={form.year} onChange={set('year')}/></Field>
        </div>
        <Field label="Description"><input style={{...s.input,marginTop:12}} value={form.description} onChange={set('description')} placeholder="e.g. County property tax Q2"/></Field>
        <div style={{marginTop:16}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--ink)'}}>Attach Documents</div>
          <DocumentUploader loanId={loan.id} onUploaded={()=>setDocRefresh(x=>x+1)}/>
          <DocumentList loanId={loan.id} refresh={docRefresh}/>
        </div>
        <div style={{display:'flex',gap:10,marginTop:14,justifyContent:'flex-end'}}><button style={s.btn('ghost')} onClick={()=>setShowForm(false)}>Cancel</button><button style={s.btn()} onClick={save}>Save Item</button></div>
      </div>)}

      {/* Running Balance Ledger */}
      {ledger.length>0&&(<div style={{...s.card,marginBottom:20}}>
        <h3 style={s.sectionTitle}>Running Balance Ledger</h3>
        <div style={{overflowX:'auto',maxHeight:400}}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Date</th><th style={s.th}>Type</th><th style={s.th}>Description</th><th style={s.th}>Amount</th><th style={s.th}>Balance</th></tr></thead>
            <tbody>{ledger.map((e,i)=>(<tr key={i}>
              <td style={s.td}>{fmtDate(e.date)}</td>
              <td style={s.td}><span style={s.badge(e.type==='deposit'?'green':'orange')}>{e.type==='deposit'?'Deposit':'Disbursement'}</span></td>
              <td style={s.td}>{e.description}</td>
              <td style={{...s.td,color:e.type==='deposit'?'var(--sage)':'var(--terracotta)',fontWeight:600}}>{e.type==='deposit'?'+':'-'}{fmt(e.amount)}</td>
              <td style={{...s.td,fontWeight:600}}>{fmt(e.running_balance)}</td>
            </tr>))}</tbody>
          </table>
        </div>
      </div>)}

      {/* Disbursements Table */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>Disbursements ({items.length})</h3>
        {items.length===0?<div style={{padding:'40px',textAlign:'center',color:'var(--warm-gray)'}}>No escrow items logged yet.</div>:(
          <table style={s.table}>
            <thead><tr>{['Date','Type','Description','Year','Amount','Docs',''].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>{[...items].reverse().map(item=>(<tr key={item.id}>
              <td style={s.td}>{fmtDate(item.payment_date)}</td>
              <td style={s.td}><span style={s.badge(item.item_type==='tax'?'orange':item.item_type==='insurance'?'blue':'green')}>{item.item_type==='tax'?'Tax':item.item_type==='insurance'?'Insurance':'Other'}</span></td>
              <td style={s.td}>{item.description}</td>
              <td style={s.td}>{item.year}</td>
              <td style={{...s.td,fontWeight:600}}>{fmt(item.amount)}</td>
              <td style={s.td}>
                <DocumentUploader loanId={loan.id} escrowItemId={item.id} compact onUploaded={()=>setDocRefresh(x=>x+1)}/>
                <DocumentList loanId={loan.id} escrowItemId={item.id} refresh={docRefresh}/>
              </td>
              <td style={s.td}><button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>del(item.id)}>Del</button></td>
            </tr>))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// ─── BILLS VIEW ───────────────────────────────────────────────────────────────
const BILL_PRESETS = [
  {name:'Electric',icon:'⚡',color:'#F59E0B',custom_fields:[{key:'usage_kwh',label:'Usage (kWh)',type:'number'},{key:'rate_per_kwh',label:'Rate ($/kWh)',type:'number'}]},
  {name:'Internet',icon:'🌐',color:'#3B82F6',custom_fields:[{key:'data_gb',label:'Data Used (GB)',type:'number'},{key:'plan_speed',label:'Plan Speed (Mbps)',type:'number'}]},
  {name:'Water',icon:'💧',color:'#06B6D4',custom_fields:[{key:'usage_gallons',label:'Usage (gallons)',type:'number'},{key:'usage_hcf',label:'Usage (HCF)',type:'number'}]},
  {name:'TV/Cable/Streaming',icon:'📺',color:'#8B5CF6',custom_fields:[{key:'num_services',label:'# Services',type:'number'}]},
  {name:'Home Insurance',icon:'🏠',color:'#10B981',custom_fields:[{key:'coverage_amount',label:'Coverage ($)',type:'number'},{key:'deductible',label:'Deductible ($)',type:'number'}]},
  {name:'Flood Insurance',icon:'🌊',color:'#0EA5E9',custom_fields:[{key:'coverage_amount',label:'Coverage ($)',type:'number'}]},
  {name:'Auto Insurance',icon:'🚗',color:'#F97316',custom_fields:[{key:'vehicles',label:'# Vehicles',type:'number'},{key:'deductible',label:'Deductible ($)',type:'number'}]},
  {name:'Gas',icon:'🔥',color:'#EF4444',custom_fields:[{key:'usage_therms',label:'Usage (therms)',type:'number'}]},
  {name:'Phone',icon:'📱',color:'#6366F1',custom_fields:[{key:'lines',label:'# Lines',type:'number'},{key:'data_gb',label:'Data (GB)',type:'number'}]},
  {name:'Other',icon:'💼',color:'#64748B',custom_fields:[]},
];

const BILL_CYCLES=[{id:'monthly',label:'Monthly'},{id:'quarterly',label:'Quarterly'},{id:'biannual',label:'Every 6 Months'},{id:'annual',label:'Annual'}];

function BillsView({initialCatId}){
  const [categories,setCategories]=useState([]);
  const [bills,setBills]=useState([]);
  const [selectedCat,setSelectedCat]=useState(null);
  const [showCatForm,setShowCatForm]=useState(false);
  const [showBillForm,setShowBillForm]=useState(false);
  const [catForm,setCatForm]=useState({name:'',icon:'💡',color:'#7B8FA1',custom_fields:[],cycle:'monthly'});
  const [billForm,setBillForm]=useState({category_id:'',bill_date:'',amount:'',due_date:'',paid:false,notes:'',custom_data:{}});
  const [provider,setProvider]=useState('claude');
  const [analyzing,setAnalyzing]=useState(false);
  const [analyzeResult,setAnalyzeResult]=useState(null);
  const [docRefresh,setDocRefresh]=useState(0);
  const [activePreset,setActivePreset]=useState(null);
  const PROVIDERS=[{id:'claude',label:'Claude'},{id:'openai',label:'ChatGPT'},{id:'gemini',label:'Gemini'},{id:'copilot',label:'Copilot'}];

  const loadCats=()=>authFetch(`${API}/bills/categories`).then(r=>r.json()).then(cats=>{setCategories(cats);if(initialCatId){const c=cats.find(x=>x.id===initialCatId);if(c)setSelectedCat(c);}});
  const loadBills=(catId)=>{
    const url=catId?`${API}/bills?category_id=${catId}`:`${API}/bills`;
    authFetch(url).then(r=>r.json()).then(setBills);
  };
  useEffect(()=>{loadCats();},[]);
  useEffect(()=>{loadBills(selectedCat?.id);},[selectedCat]);

  const saveCat=async()=>{
    const method=catForm.id?'PUT':'POST';
    const url=catForm.id?`${API}/bills/categories/${catForm.id}`:`${API}/bills/categories`;
    await authFetch(url,{method,body:JSON.stringify({...catForm,custom_fields:catForm.custom_fields})});
    setShowCatForm(false);loadCats();
  };
  const delCat=async(id)=>{if(!confirm('Delete this category and all bills?'))return;await authFetch(`${API}/bills/categories/${id}`,{method:'DELETE'});loadCats();if(selectedCat?.id===id)setSelectedCat(null);};
  const saveBill=async()=>{
    if(!billForm.category_id)return;
    await authFetch(`${API}/bills`,{method:'POST',body:JSON.stringify(billForm)});
    setShowBillForm(false);setBillForm({category_id:selectedCat?.id||'',bill_date:'',amount:'',due_date:'',paid:false,notes:'',custom_data:{}});
    setAnalyzeResult(null);loadBills(selectedCat?.id);
  };
  const delBill=async(id)=>{if(!confirm('Delete?'))return;await authFetch(`${API}/bills/${id}`,{method:'DELETE'});loadBills(selectedCat?.id);};
  const togglePaid=async(bill)=>{await authFetch(`${API}/bills/${bill.id}`,{method:'PUT',body:JSON.stringify({...bill,paid:!bill.paid,custom_data:bill.custom_data?JSON.parse(bill.custom_data):{}})});loadBills(selectedCat?.id);};

  const analyzeBillPDF=async(file,catId)=>{
    setAnalyzing(true);setAnalyzeResult(null);
    const fd=new FormData();fd.append('pdf',file);fd.append('provider',provider);
    const r=await authFetch(`${API}/bills/${catId}/analyze-pdf`,{method:'POST',body:fd});
    const data=await r.json();
    if(data.success){
      const e=data.extracted;setAnalyzeResult(e);
      const cat=categories.find(c=>c.id===catId);
      const fields=cat?.custom_fields?JSON.parse(cat.custom_fields):[];
      const custom_data={};
      fields.forEach(f=>{if(e[f.key]!=null)custom_data[f.key]=e[f.key];});
      setBillForm(prev=>({...prev,category_id:catId,bill_date:e.bill_date||prev.bill_date,amount:e.amount||prev.amount,due_date:e.due_date||prev.due_date,notes:e.notes||prev.notes,custom_data}));
    }else setAnalyzeResult({error:data.error});
    setAnalyzing(false);
  };

  const catBills=bills.filter(b=>!selectedCat||b.category_id===selectedCat.id);

  const getCustomFields=(cat)=>{
    if(!cat?.custom_fields)return[];
    try{return JSON.parse(cat.custom_fields);}catch{return[];}
  };

  const usePreset=(preset)=>{
    setCatForm({name:preset.name,icon:preset.icon,color:preset.color,custom_fields:preset.custom_fields,cycle:'monthly'});
    setActivePreset(preset.name);
  };

  // Build chart data grouped by billing cycle
  const buildChartData=(cat,billList)=>{
    if(!cat||!billList.length)return[];
    const cycle=cat.cycle||'monthly';
    const grouped={};
    billList.forEach(b=>{
      let key=b.bill_date?.slice(0,7)||'';
      if(cycle==='quarterly'){const m=parseInt(b.bill_date?.slice(5,7));const q=Math.ceil(m/3);key=`${b.bill_date?.slice(0,4)}-Q${q}`;}
      else if(cycle==='biannual'){const m=parseInt(b.bill_date?.slice(5,7));const h=m<=6?'H1':'H2';key=`${b.bill_date?.slice(0,4)}-${h}`;}
      else if(cycle==='annual'){key=b.bill_date?.slice(0,4)||'';}
      if(!grouped[key])grouped[key]={date:key,amount:0};
      grouped[key].amount+=parseFloat(b.amount||0);
      const cd=b.custom_data?JSON.parse(b.custom_data):{};
      const fields=getCustomFields(cat);
      fields.forEach(f=>{if(cd[f.key]!=null){if(!grouped[key][f.key])grouped[key][f.key]=0;grouped[key][f.key]+=parseFloat(cd[f.key]||0);}});
    });
    return Object.values(grouped).sort((a,b)=>a.date.localeCompare(b.date));
  };

  return(
    <div>
      <div className="page-header-row" style={{...s.pageHeader,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1 style={s.pageTitle}>💡 Household Bills</h1><p style={s.pageSub}>Track and analyze all your recurring bills</p></div>
        <button style={s.btn()} onClick={()=>{setCatForm({name:'',icon:'💡',color:'#7B8FA1',custom_fields:[],cycle:'monthly'});setActivePreset(null);setShowCatForm(!showCatForm);}}>+ Add Bill Category</button>
      </div>

      {/* Category Form */}
      {showCatForm&&(<div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:12}}>Add Bill Category</h3>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:'var(--warm-gray)',marginBottom:8,fontWeight:500}}>Quick Presets</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {BILL_PRESETS.map(p=>(<button key={p.name} style={{padding:'6px 12px',borderRadius:6,fontSize:12,cursor:'pointer',border:`2px solid ${activePreset===p.name?p.color:'var(--border)'}`,background:activePreset===p.name?p.color+'20':'var(--surface)',color:'var(--ink)',fontWeight:activePreset===p.name?600:400}} onClick={()=>usePreset(p)}>{p.icon} {p.name}</button>))}
          </div>
        </div>
        <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 80px 80px 150px',gap:12,alignItems:'flex-end',marginBottom:12}}>
          <Field label="Category Name"><input style={s.input} value={catForm.name} onChange={e=>setCatForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Electric"/></Field>
          <Field label="Icon"><input style={s.input} value={catForm.icon} onChange={e=>setCatForm(f=>({...f,icon:e.target.value}))} placeholder="💡"/></Field>
          <Field label="Color"><input type="color" style={{...s.input,padding:'4px',height:42,cursor:'pointer'}} value={catForm.color} onChange={e=>setCatForm(f=>({...f,color:e.target.value}))}/></Field>
          <Field label="Billing Cycle">
            <select style={s.input} value={catForm.cycle||'monthly'} onChange={e=>setCatForm(f=>({...f,cycle:e.target.value}))}>
              {BILL_CYCLES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <button style={s.btn()} onClick={saveCat}>Save Category</button>
        {catForm.custom_fields?.length>0&&(<div style={{marginTop:12,padding:12,background:'var(--surface)',borderRadius:8}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'var(--ink)'}}>Custom Tracking Fields</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{catForm.custom_fields.map(f=>(<span key={f.key} style={{padding:'3px 8px',background:'var(--card)',border:'1px solid var(--border)',borderRadius:4,fontSize:11,color:'var(--ink)'}}>{f.label}</span>))}</div>
        </div>)}
      </div>)}

      {/* Category Cards */}
      {categories.length>0&&(<div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
        <div onClick={()=>setSelectedCat(null)} style={{padding:'12px 16px',borderRadius:10,cursor:'pointer',border:`2px solid ${!selectedCat?'var(--gold)':'var(--border)'}`,background:!selectedCat?'rgba(201,151,58,0.08)':'var(--card)',minWidth:80,textAlign:'center'}}>
          <div style={{fontSize:20,marginBottom:2}}>📋</div><div style={{fontSize:12,fontWeight:!selectedCat?600:400,color:!selectedCat?'var(--gold)':'var(--ink)'}}>All Bills</div>
        </div>
        {categories.map(c=>{
          const catBillCount=bills.filter(b=>b.category_id===c.id).length;
          const cycle=BILL_CYCLES.find(x=>x.id===(c.cycle||'monthly'))?.label||'Monthly';
          return(<div key={c.id} style={{position:'relative'}}>
            <div onClick={()=>setSelectedCat(c)} style={{padding:'12px 16px',borderRadius:10,cursor:'pointer',border:`2px solid ${selectedCat?.id===c.id?c.color:'var(--border)'}`,background:selectedCat?.id===c.id?c.color+'15':'var(--card)',minWidth:110,textAlign:'center'}}>
              <div style={{fontSize:20,marginBottom:2}}>{c.icon}</div>
              <div style={{fontSize:12,fontWeight:selectedCat?.id===c.id?600:400,color:selectedCat?.id===c.id?c.color:'var(--ink)'}}>{c.name}</div>
              <div style={{fontSize:10,color:'var(--warm-gray)',marginTop:2}}>{catBillCount} entries · {cycle}</div>
            </div>
            <button onClick={(e)=>{e.stopPropagation();delCat(c.id);}} style={{position:'absolute',top:-6,right:-6,background:'var(--terracotta)',color:'white',border:'none',borderRadius:'50%',width:18,height:18,fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>);
        })}
      </div>)}

      {/* Bill Form */}
      {(selectedCat||categories.length>0)&&(<div style={{...s.card,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:showBillForm?16:0}}>
          <h3 style={{...s.sectionTitle,marginBottom:0}}>Add Bill Entry</h3>
          <button style={s.btn('outline')} onClick={()=>{setShowBillForm(!showBillForm);setBillForm({category_id:selectedCat?.id||'',bill_date:new Date().toISOString().split('T')[0],amount:'',due_date:'',paid:false,notes:'',custom_data:{}});setAnalyzeResult(null);}}>+ Add Entry</button>
        </div>
        {showBillForm&&(<div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
            {categories.map(c=>(<button key={c.id} onClick={()=>setBillForm(f=>({...f,category_id:c.id,custom_data:{}}))} style={{padding:'6px 12px',borderRadius:6,fontSize:12,cursor:'pointer',border:`2px solid ${billForm.category_id===c.id?c.color:'var(--border)'}`,background:billForm.category_id===c.id?c.color+'20':'var(--surface)',color:'var(--ink)'}}>{c.icon} {c.name}</button>))}
          </div>
          {billForm.category_id&&(<>
            <div style={{padding:16,borderRadius:10,border:'1px solid var(--gold)',background:'rgba(201,151,58,0.04)',marginBottom:12}}>
              <div style={{fontWeight:600,fontSize:13,color:'var(--gold)',marginBottom:10}}>🤖 AI Bill Extraction</div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <select value={provider} onChange={e=>setProvider(e.target.value)} style={{padding:'6px 10px',fontSize:13,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--ink)'}}>{PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
                <input type="file" id="billPdfAI" accept=".pdf" style={{display:'none'}} onChange={e=>e.target.files[0]&&analyzeBillPDF(e.target.files[0],billForm.category_id)}/>
                <button style={s.btn('outline')} onClick={()=>document.getElementById('billPdfAI').click()} disabled={analyzing}>{analyzing?'⏳ Analyzing...':'📄 Upload & Analyze PDF'}</button>
                {analyzeResult&&!analyzeResult.error&&<span style={{fontSize:12,color:'var(--sage)'}}>✓ Data extracted</span>}
                {analyzeResult?.error&&<span style={{fontSize:12,color:'var(--terracotta)'}}>⚠ {analyzeResult.error}</span>}
              </div>
            </div>
            <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <Field label="Bill Date"><input style={s.input} type="date" value={billForm.bill_date} onChange={e=>setBillForm(f=>({...f,bill_date:e.target.value}))}/></Field>
              <Field label="Amount ($)"><input style={s.input} type="number" value={billForm.amount} onChange={e=>setBillForm(f=>({...f,amount:e.target.value}))} placeholder="0.00"/></Field>
              <Field label="Due Date (optional)"><input style={s.input} type="date" value={billForm.due_date} onChange={e=>setBillForm(f=>({...f,due_date:e.target.value}))}/></Field>
              <Field label="Status"><div style={{display:'flex',alignItems:'center',gap:10,height:42}}><input type="checkbox" checked={billForm.paid} onChange={e=>setBillForm(f=>({...f,paid:e.target.checked}))} style={{width:18,height:18}}/><span style={{fontSize:14,color:'var(--ink)'}}>Paid</span></div></Field>
            </div>
            {(()=>{
              const cat=categories.find(c=>c.id===billForm.category_id);
              const fields=getCustomFields(cat);
              if(!fields.length)return null;
              return(<div style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--ink)',marginBottom:8}}>Custom Fields</div>
                <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {fields.map(f=>(<Field key={f.key} label={f.label}><input style={s.input} type={f.type||'text'} value={billForm.custom_data[f.key]||''} onChange={e=>setBillForm(prev=>({...prev,custom_data:{...prev.custom_data,[f.key]:e.target.value}}))}/></Field>))}
                </div>
              </div>);
            })()}
            <Field label="Notes"><input style={{...s.input,marginBottom:12}} value={billForm.notes} onChange={e=>setBillForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes"/></Field>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button style={s.btn('ghost')} onClick={()=>setShowBillForm(false)}>Cancel</button>
              <button style={s.btn()} onClick={saveBill}>Save Bill</button>
            </div>
          </>)}
        </div>)}
      </div>)}

      {/* Per-Category Analytics Charts */}
      {selectedCat&&catBills.length>0&&(()=>{
        const fields=getCustomFields(selectedCat);
        const chartData=buildChartData(selectedCat,catBills);
        const cycleLabel=BILL_CYCLES.find(c=>c.id===(selectedCat.cycle||'monthly'))?.label||'Monthly';
        const totalSpend=catBills.reduce((s,b)=>s+parseFloat(b.amount||0),0);
        const avgSpend=catBills.length>0?totalSpend/catBills.length:0;
        const lastBill=catBills.sort((a,b)=>b.bill_date.localeCompare(a.bill_date))[0];
        return(
          <div style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <span style={{fontSize:24}}>{selectedCat.icon}</span>
              <div><h3 style={{...s.sectionTitle,marginBottom:0}}>{selectedCat.name} Analytics</h3><div style={{fontSize:12,color:'var(--warm-gray)'}}>{cycleLabel} billing</div></div>
            </div>
            {/* Stat row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
              <div style={s.statCard(selectedCat.color)}><div style={s.statLabel}>Total Spent</div><div style={s.statValue}>{fmt(totalSpend)}</div><div style={s.statSub}>{catBills.length} entries</div></div>
              <div style={s.statCard(selectedCat.color)}><div style={s.statLabel}>Avg per Cycle</div><div style={s.statValue}>{fmt(avgSpend)}</div><div style={s.statSub}>Per {cycleLabel.toLowerCase()}</div></div>
              <div style={s.statCard(selectedCat.color)}><div style={s.statLabel}>Last Entry</div><div style={s.statValue}>{fmt(lastBill?.amount)}</div><div style={s.statSub}>{fmtDate(lastBill?.bill_date)}</div></div>
            </div>
            {/* Charts */}
            {chartData.length>1&&(
              <div style={{display:'grid',gridTemplateColumns:fields.length>0?'1fr 1fr':'1fr',gap:16,marginBottom:16}}>
                <div style={s.card}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--ink)'}}>Cost per {cycleLabel} Cycle</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
                      <defs><linearGradient id={`billGrad${selectedCat.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={selectedCat.color} stopOpacity={0.3}/><stop offset="95%" stopColor={selectedCat.color} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                      <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
                      <YAxis tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--ink)'}}/>
                      <Area type="monotone" dataKey="amount" stroke={selectedCat.color} fill={`url(#billGrad${selectedCat.id})`} name="Amount"/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {fields.slice(0,3).map((f,fi)=>(
                  <div key={f.key} style={s.card}>
                    <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:'var(--ink)'}}>{f.label} per Cycle</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                        <XAxis dataKey="date" tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
                        <YAxis tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
                        <Tooltip contentStyle={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--ink)'}}/>
                        <Line type="monotone" dataKey={f.key} stroke={['#3B82F6','#10B981','#F59E0B'][fi%3]} dot={{r:3}} name={f.label}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Bills Table */}
      {catBills.length>0&&(<div style={s.card}>
        <h3 style={s.sectionTitle}>{selectedCat?`${selectedCat.icon} ${selectedCat.name} Bills`:'All Bills'} ({catBills.length})</h3>
        <div style={{overflowX:'auto'}}>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>Category</th><th style={s.th}>Date</th><th style={s.th}>Amount</th><th style={s.th}>Due</th>
              <th style={s.th}>Status</th><th style={s.th}>Docs</th><th style={s.th}></th>
            </tr></thead>
            <tbody>{[...catBills].sort((a,b)=>b.bill_date.localeCompare(a.bill_date)).map(b=>{
              const cat=categories.find(c=>c.id===b.category_id);
              return(<tr key={b.id}>
                <td style={s.td}><span style={{color:cat?.color||'var(--warm-gray)'}}>{cat?.icon||'💼'} {cat?.name||'Unknown'}</span></td>
                <td style={s.td}>{fmtDate(b.bill_date)}</td>
                <td style={{...s.td,fontWeight:600}}>{fmt(b.amount)}</td>
                <td style={s.td}>{fmtDate(b.due_date)}</td>
                <td style={s.td}><span style={s.badge(b.paid?'green':'orange')} onClick={()=>togglePaid(b)} title="Click to toggle">{b.paid?'✓ Paid':'Unpaid'}</span></td>
                <td style={s.td}>
                  <DocumentUploader billId={b.id} compact onUploaded={()=>setDocRefresh(x=>x+1)}/>
                  <DocumentList billId={b.id} refresh={docRefresh}/>
                </td>
                <td style={s.td}><button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>delBill(b.id)}>Del</button></td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </div>)}

      {categories.length===0&&(<div style={{...s.card,textAlign:'center',padding:'60px'}}>
        <div style={{fontSize:48,marginBottom:16}}>💡</div>
        <h2 style={{fontFamily:"'DM Serif Display',serif",marginBottom:8,color:'var(--ink)'}}>No Bill Categories Yet</h2>
        <p style={{color:'var(--warm-gray)',marginBottom:20}}>Add a category to start tracking bills like electricity, water, or insurance.</p>
        <button style={s.btn()} onClick={()=>setShowCatForm(true)}>Add Your First Category</button>
      </div>)}
    </div>
  );
}
// ─── LOANS MANAGER ────────────────────────────────────────────────────────────
function LoansManager({loans,onRefresh,onSelect}){
  const [showForm,setShowForm]=useState(false);
  const [editLoan,setEditLoan]=useState(null);
  const save=async(form)=>{const method=editLoan?'PUT':'POST',url=editLoan?`${API}/loans/${editLoan.id}`:`${API}/loans`;const r=await authFetch(url,{method,body:JSON.stringify(form)});const loan=await r.json();setShowForm(false);setEditLoan(null);onRefresh();if(!editLoan)onSelect(loan);};
  const del=async(id)=>{if(!confirm('Delete this loan and all data? Cannot be undone.'))return;await authFetch(`${API}/loans/${id}`,{method:'DELETE'});onRefresh();};
  return(
    <div>
      <div className="page-header-row" style={{...s.pageHeader,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1 style={s.pageTitle}>Manage Loans</h1><p style={s.pageSub}>Add and manage all your loans</p></div>
        <button style={s.btn()} onClick={()=>{setEditLoan(null);setShowForm(true);}}>+ New Loan</button>
      </div>
      {showForm&&<div style={{...s.card,marginBottom:20}}><h3 style={{...s.sectionTitle,marginBottom:16}}>{editLoan?'Edit Loan':'Add New Loan'}</h3><LoanForm initial={editLoan||{}} onSave={save} onCancel={()=>{setShowForm(false);setEditLoan(null);}}/></div>}
      {loans.length===0&&!showForm&&<div style={{...s.card,textAlign:'center',padding:'60px'}}><div style={{fontSize:40,marginBottom:12}}>🏡</div><h3 style={{fontFamily:"'DM Serif Display',serif",marginBottom:8,color:'var(--ink)'}}>No Loans Yet</h3><p style={{color:'var(--warm-gray)',marginBottom:20}}>Add your first loan to start tracking</p><button style={s.btn()} onClick={()=>setShowForm(true)}>Add Your First Loan</button></div>}
      {loans.map(loan=>{const lt=loanTypeInfo(loan.loan_type);return(<div key={loan.id} className="loan-card" style={{...s.card,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontFamily:"'DM Serif Display',serif",fontSize:20,marginBottom:4,color:'var(--ink)'}}>{lt.icon} {loan.name} <span style={{...s.badge('blue'),fontSize:10,verticalAlign:'middle',marginLeft:4}}>{lt.label}</span></div><div style={{fontSize:13,color:'var(--warm-gray)'}}>{fmt(loan.original_amount)} · {parseFloat(loan.interest_rate)}% · {parseInt(loan.loan_term_months)/12}yr · Started {fmtDate(loan.start_date)}</div><div style={{fontSize:13,marginTop:4,color:'var(--ink)'}}>Balance: <strong>{fmt(loan.current_balance||loan.original_amount)}</strong> · Monthly: <strong>{fmt(loan.monthly_payment)}</strong></div></div>
        <div className="loan-card-btns" style={{display:'flex',gap:8}}><button style={s.btn('outline')} onClick={()=>onSelect(loan)}>View</button><button style={s.btn('ghost')} onClick={()=>{setEditLoan(loan);setShowForm(true);window.scrollTo(0,0);}}>Edit</button><button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>del(loan.id)}>Delete</button></div>
      </div>);})}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({theme,setTheme,onLogout}){
  const PROVIDERS=[{id:'claude_api_key',label:'Claude (Anthropic)',placeholder:'sk-ant-api03-...',link:'https://console.anthropic.com/api-keys'},{id:'openai_api_key',label:'ChatGPT (OpenAI)',placeholder:'sk-proj-...',link:'https://platform.openai.com/api-keys'},{id:'gemini_api_key',label:'Gemini (Google)',placeholder:'AIza...',link:'https://aistudio.google.com/app/apikey'},{id:'copilot_api_key',label:'Copilot (Microsoft)',placeholder:'GitHub PAT',link:'https://github.com/settings/tokens'}];
  const [keys,setKeys]=useState({claude_api_key:'',openai_api_key:'',gemini_api_key:'',copilot_api_key:''});
  const [saved,setSaved]=useState({});
  const [status,setStatus]=useState(null);
  const [pwForm,setPwForm]=useState({current:'',newPw:'',confirm:''});
  const [pwStatus,setPwStatus]=useState(null);
  useEffect(()=>{authFetch(`${API}/settings`).then(r=>r.json()).then(data=>{const c={};PROVIDERS.forEach(p=>{c[p.id]=!!data[p.id];});setSaved(c);});},[]);
  const saveKeys=async()=>{const body={};PROVIDERS.forEach(p=>{if(keys[p.id]&&keys[p.id]!=='••••••••••••••••')body[p.id]=keys[p.id];});if(!Object.keys(body).length){setStatus({ok:false,msg:'No new keys to save.'});return;}const r=await authFetch(`${API}/settings`,{method:'POST',body:JSON.stringify(body)});const data=await r.json();if(data.success){const u={...saved};data.updated.forEach(k=>{u[k]=true;});setSaved(u);setKeys(prev=>{const n={...prev};data.updated.forEach(k=>{n[k]='';});return n;});setStatus({ok:true,msg:`Saved ${data.updated.length} key(s).`});}else setStatus({ok:false,msg:'Save failed.'});setTimeout(()=>setStatus(null),3000);};
  const removeKey=async(key)=>{await authFetch(`${API}/settings/${key}`,{method:'DELETE'});setSaved(prev=>({...prev,[key]:false}));setKeys(prev=>({...prev,[key]:''}));};
  const changePw=async()=>{setPwStatus(null);if(pwForm.newPw!==pwForm.confirm){setPwStatus({ok:false,msg:'Passwords do not match'});return;}const r=await authFetch(`${API}/auth/change-password`,{method:'POST',body:JSON.stringify({currentPassword:pwForm.current,newPassword:pwForm.newPw})});const d=await r.json();if(d.success){setPwStatus({ok:true,msg:'Password changed!'});setPwForm({current:'',newPw:'',confirm:''});}else setPwStatus({ok:false,msg:d.error});setTimeout(()=>setPwStatus(null),3000);};
  return(
    <div>
      <div style={s.pageHeader}><h1 style={s.pageTitle}>Settings</h1><p style={s.pageSub}>Appearance, security, and API keys</p></div>
      {/* Theme */}
      <div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>Theme</h3>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>
          {THEMES.map(t=>(<div key={t.id} onClick={()=>setTheme(t.id)} style={{padding:'14px 20px',borderRadius:10,cursor:'pointer',minWidth:110,textAlign:'center',border:`2px solid ${theme===t.id?'var(--gold)':'var(--border)'}`,background:theme===t.id?'rgba(201,151,58,0.08)':'var(--surface)'}}><div style={{fontSize:20,marginBottom:4}}>{t.label.split(' ')[0]}</div><div style={{fontSize:13,fontWeight:theme===t.id?600:400,color:theme===t.id?'var(--gold)':'var(--ink)'}}>{t.label.split(' ').slice(1).join(' ')}</div><div style={{fontSize:11,color:'var(--warm-gray)',marginTop:2}}>{t.desc}</div></div>))}
        </div>
      </div>
      {/* Security */}
      <div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>Security</h3>
        <p style={{fontSize:13,color:'var(--warm-gray)',marginBottom:16}}>Change your login password.</p>
        <div className="form-grid-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
          <Field label="Current Password"><input style={s.input} type="password" value={pwForm.current} onChange={e=>setPwForm(f=>({...f,current:e.target.value}))}/></Field>
          <Field label="New Password"><input style={s.input} type="password" value={pwForm.newPw} onChange={e=>setPwForm(f=>({...f,newPw:e.target.value}))}/></Field>
          <Field label="Confirm New Password"><input style={s.input} type="password" value={pwForm.confirm} onChange={e=>setPwForm(f=>({...f,confirm:e.target.value}))}/></Field>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:16}}><button style={s.btn()} onClick={changePw}>Change Password</button>{pwStatus&&<span style={{fontSize:13,color:pwStatus.ok?'var(--sage)':'var(--terracotta)'}}>{pwStatus.msg}</span>}<button style={{...s.btn('ghost'),marginLeft:'auto'}} onClick={onLogout}>Sign Out</button></div>
      </div>
      {/* Support */}
      <div style={{...s.card,marginBottom:20}}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>Help & Support</h3>
        <p style={{fontSize:13,color:'var(--warm-gray)',marginBottom:16}}>Have a feature request or found a bug? Visit the GitHub page to open an issue or discussion.</p>
        <a href="https://github.com/JonGaydos/payoffiq" target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 20px',background:'var(--ink)',color:theme==='dark'||theme==='midnight'?'var(--cream)':'white',borderRadius:8,fontSize:14,fontWeight:500,textDecoration:'none'}}><span>⬡</span> View on GitHub</a>
      </div>
      {/* API Keys */}
      <div style={s.card}>
        <h3 style={{...s.sectionTitle,marginBottom:4}}>AI Provider API Keys</h3>
        <p style={{fontSize:13,color:'var(--warm-gray)',marginBottom:20}}>Keys are stored securely in your local database and never leave your server.</p>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {PROVIDERS.map(p=>(<div key={p.id} style={{padding:16,borderRadius:10,border:`1px solid ${saved[p.id]?'var(--sage)':'var(--border)'}`,background:saved[p.id]?'rgba(107,153,100,0.05)':'var(--surface)'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div><span style={{fontWeight:600,fontSize:14,color:'var(--ink)'}}>{p.label}</span>{saved[p.id]&&<span style={{marginLeft:10,fontSize:11,color:'var(--sage)',fontWeight:600}}>✓ CONFIGURED</span>}</div><a href={p.link} target="_blank" rel="noreferrer" style={{fontSize:12,color:'var(--gold)',textDecoration:'none'}}>Get key →</a></div><div style={{display:'flex',gap:8}}><input type="password" style={{...s.input,flex:1}} placeholder={saved[p.id]?'•••••• (saved — enter new to replace)':p.placeholder} value={keys[p.id]} onChange={e=>setKeys(prev=>({...prev,[p.id]:e.target.value}))}/>{saved[p.id]&&<button style={{...s.btn('outline'),borderColor:'var(--terracotta)',color:'var(--terracotta)',whiteSpace:'nowrap'}} onClick={()=>removeKey(p.id)}>Remove</button>}</div></div>))}
        </div>
        <div style={{marginTop:20,display:'flex',alignItems:'center',gap:16}}><button style={s.btn()} onClick={saveKeys}>Save Keys</button>{status&&<span style={{fontSize:13,color:status.ok?'var(--sage)':'var(--terracotta)'}}>{status.msg}</span>}</div>
      </div>
    </div>
  );
}

// ─── GLOBAL DASHBOARD ─────────────────────────────────────────────────────────
function Dashboard({loans,navigate}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    authFetch(`${API}/dashboard`).then(r=>r.json()).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  if(loading)return<div style={s.card}><p style={{color:'var(--warm-gray)'}}>Loading dashboard...</p></div>;
  if(!data||!data.loanSummaries)return<div style={s.card}><p style={{color:'var(--warm-gray)'}}>No data yet. Add a loan to get started.</p></div>;

  const {loanSummaries,paymentTimeline,billSummary,billTimeline,billCategories}=data;
  const totalBalance=loanSummaries.reduce((s,l)=>s+l.currentBalance,0);
  const totalPaid=loanSummaries.reduce((s,l)=>s+l.totalPaid,0);
  const totalInterest=loanSummaries.reduce((s,l)=>s+l.totalInterest,0);
  const totalBillSpend=billSummary.reduce((s,b)=>s+b.totalSpent,0);

  const LOAN_COLORS=['#C9973A','#4A6741','#7B4F3A','#3B82F6','#8B5CF6'];

  return(
    <div>
      <div style={s.pageHeader}><h1 style={s.pageTitle}>📊 Dashboard</h1><p style={s.pageSub}>Overview of all loans and household bills</p></div>

      {/* Summary stat cards */}
      <div className="stat-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
        <div style={s.statCard('var(--gold)')}><div style={s.statLabel}>Total Loan Balance</div><div style={s.statValue}>{fmt(totalBalance)}</div><div style={s.statSub}>{loanSummaries.length} active loan{loanSummaries.length!==1?'s':''}</div></div>
        <div style={s.statCard('var(--sage)')}><div style={s.statLabel}>Total Amount Paid</div><div style={s.statValue}>{fmt(totalPaid)}</div><div style={s.statSub}>Across all loans</div></div>
        <div style={s.statCard('var(--terracotta)')}><div style={s.statLabel}>Total Interest Paid</div><div style={s.statValue}>{fmt(totalInterest)}</div><div style={s.statSub}>All loans combined</div></div>
        <div style={s.statCard('#3B82F6')}><div style={s.statLabel}>Total Bills Tracked</div><div style={s.statValue}>{fmt(totalBillSpend)}</div><div style={s.statSub}>{billSummary.length} categories</div></div>
      </div>

      {/* Combined payment timeline */}
      {paymentTimeline.length>1&&(
        <div style={{...s.card,marginBottom:20}}>
          <h3 style={s.sectionTitle}>All Loan Payments Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={paymentTimeline} margin={{top:0,right:0,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--ink)'}}/>
              <Legend/>
              <Bar dataKey="principal" fill="var(--gold)" name="Principal" stackId="a"/>
              <Bar dataKey="interest" fill="var(--terracotta)" name="Interest" stackId="a"/>
              <Bar dataKey="escrow" fill="var(--chart-escrow)" name="Escrow" stackId="a"/>
              <Bar dataKey="extra" fill="var(--sage)" name="Extra" stackId="a"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-loan summary cards */}
      {loanSummaries.length>0&&(
        <div style={{marginBottom:20}}>
          <h3 style={{...s.sectionTitle,marginBottom:12}}>Loan Summary</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
            {loanSummaries.map((loan,i)=>{
              const lt=loanTypeInfo(loan.loan_type);
              const color=LOAN_COLORS[i%LOAN_COLORS.length];
              return(
                <div key={loan.id} style={{...s.card,borderTop:`3px solid ${color}`,cursor:'pointer'}} onClick={()=>navigate('loan-payments',loan.id)}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <span style={{fontSize:20}}>{lt.icon}</span>
                    <div><div style={{fontWeight:600,color:'var(--ink)',fontSize:15}}>{loan.name}</div><div style={{fontSize:11,color:'var(--warm-gray)'}}>{lt.label} · {loan.interest_rate}%</div></div>
                  </div>
                  <div style={{height:6,borderRadius:3,background:'var(--surface)',overflow:'hidden',marginBottom:8}}>
                    <div style={{width:`${loan.progress}%`,height:'100%',background:color,borderRadius:3}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--warm-gray)',marginBottom:8}}><span>{fmt(parseFloat(loan.original_amount)-loan.currentBalance)} paid</span><span>{fmt(loan.currentBalance)} left</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{padding:'8px',background:'var(--surface)',borderRadius:6}}><div style={{fontSize:10,color:'var(--warm-gray)',textTransform:'uppercase'}}>Balance</div><div style={{fontSize:14,fontFamily:"'DM Serif Display',serif",color:'var(--ink)'}}>{fmt(loan.currentBalance)}</div></div>
                    <div style={{padding:'8px',background:'var(--surface)',borderRadius:6}}><div style={{fontSize:10,color:'var(--warm-gray)',textTransform:'uppercase'}}>Payments</div><div style={{fontSize:14,fontFamily:"'DM Serif Display',serif",color:'var(--ink)'}}>{loan.paymentCount}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bills timeline */}
      {billTimeline.length>1&&billCategories.length>0&&(
        <div style={{...s.card,marginBottom:20}}>
          <h3 style={s.sectionTitle}>Household Bills Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={billTimeline} margin={{top:0,right:0,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
              <XAxis dataKey="month" tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
              <YAxis tick={{fontSize:10,fill:'var(--warm-gray)'}}/>
              <Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--ink)'}}/>
              <Legend/>
              {billCategories.map((cat,i)=>(
                <Area key={cat.id} type="monotone" dataKey={cat.name} stroke={cat.color||'#7B8FA1'} fill={cat.color+'22'||'#7B8FA122'} name={`${cat.icon} ${cat.name}`} stackId="bills"/>
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bill category quick view */}
      {billSummary.length>0&&(
        <div style={{marginBottom:20}}>
          <h3 style={{...s.sectionTitle,marginBottom:12}}>Bills by Category</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
            {billSummary.map(b=>(
              <div key={b.id} style={{...s.card,borderTop:`3px solid ${b.color||'#7B8FA1'}`,cursor:'pointer',padding:'14px 16px'}} onClick={()=>navigate('bills',null,b.id)}>
                <div style={{fontSize:22,marginBottom:4}}>{b.icon}</div>
                <div style={{fontWeight:600,fontSize:13,color:'var(--ink)',marginBottom:2}}>{b.name}</div>
                <div style={{fontSize:18,fontFamily:"'DM Serif Display',serif",color:b.color||'var(--gold)',marginBottom:4}}>{fmt(b.totalSpent)}</div>
                <div style={{fontSize:11,color:'var(--warm-gray)'}}>{b.billCount} entries{b.lastAmount?` · Last: ${fmt(b.lastAmount)}`:''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loanSummaries.length===0&&billSummary.length===0&&(
        <div style={{...s.card,textAlign:'center',padding:'60px 40px'}}>
          <div style={{fontSize:48,marginBottom:16}}>📊</div>
          <h2 style={{fontFamily:"'DM Serif Display',serif",marginBottom:8,color:'var(--ink)'}}>Welcome to PayoffIQ</h2>
          <p style={{color:'var(--warm-gray)'}}>Add loans or bill categories to see your financial summary here.</p>
        </div>
      )}
    </div>
  );
}
// ─── LOAN DASHBOARD (single loan) ─────────────────────────────────────────────
function LoanDashboard({loan,analytics,payments}){
  if(!loan||!analytics)return<div style={s.card}><p style={{color:'var(--warm-gray)'}}>Loading loan data...</p></div>;
  const a=analytics,lt=loanTypeInfo(loan.loan_type);
  const progress=((parseFloat(loan.original_amount)-a.currentBalance)/parseFloat(loan.original_amount))*100;
  const chartData=payments.map((p,i)=>({month:p.statement_month||`#${i+1}`,principal:parseFloat(p.principal),interest:parseFloat(p.interest),escrow:parseFloat(p.escrow),extra:parseFloat(p.extra_principal),balance:parseFloat(p.ending_balance||0)})).slice(-24);
  const hasEscrow=lt.hasEscrow;
  return(
    <div>
      <div style={s.pageHeader}><h1 style={s.pageTitle}>{lt.icon} {loan.name}</h1><p style={s.pageSub}>{lt.label} · {parseFloat(loan.interest_rate)}% · {parseInt(loan.loan_term_months)/12}yr · Started {fmtDate(loan.start_date)}</p></div>
      <div style={{...s.card,marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}}><span style={{fontSize:14,fontWeight:600,color:'var(--ink)'}}>Loan Payoff Progress</span><span style={{fontSize:22,fontFamily:"'DM Serif Display',serif",color:'var(--gold)'}}>{progress.toFixed(1)}%</span></div>
        <div style={{height:12,borderRadius:6,background:'var(--surface)',overflow:'hidden'}}><div style={{width:`${Math.min(progress,100)}%`,height:'100%',background:'linear-gradient(to right,var(--gold),var(--gold-light))',borderRadius:6}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:8,fontSize:12,color:'var(--warm-gray)'}}><span>{fmt(parseFloat(loan.original_amount)-a.currentBalance)} paid</span><span>{fmt(a.currentBalance)} remaining</span></div>
      </div>
      <div className="stat-grid-4" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20}}>
        <div style={s.statCard('var(--gold)')}><div style={s.statLabel}>Current Balance</div><div style={s.statValue}>{fmt(a.currentBalance)}</div><div style={s.statSub}>{fmt(loan.original_amount)} original</div></div>
        <div style={s.statCard('var(--sage)')}><div style={s.statLabel}>Projected Payoff</div><div style={s.statValue}>{fmtDate(a.projectedPayoffDate)}</div><div style={s.statSub}>{fmtMonths(a.projectedMonths)} remaining</div></div>
        <div style={s.statCard('var(--terracotta)')}><div style={s.statLabel}>Total Interest Paid</div><div style={s.statValue}>{fmt(a.totalInterestPaid)}</div><div style={s.statSub}>{fmt(a.projectedRemainingInterest)} remaining</div></div>
        {hasEscrow?<div style={s.statCard('var(--chart-escrow)')}><div style={s.statLabel}>Total Escrow Paid</div><div style={s.statValue}>{fmt(a.totalEscrowPaid)}</div><div style={s.statSub}>{a.paymentCount} payments</div></div>
        :<div style={s.statCard('#7B8FA1')}><div style={s.statLabel}>Payments Made</div><div style={s.statValue}>{a.paymentCount}</div><div style={s.statSub}>{fmt(a.totalPaid)} total paid</div></div>}
      </div>
      {chartData.length>0&&(<div className="chart-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
        <div style={s.card}><h3 style={s.sectionTitle}>Payment Breakdown</h3><ResponsiveContainer width="100%" height={220}><BarChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="month" tick={{fontSize:10,fill:'var(--warm-gray)'}}/><YAxis tick={{fontSize:10,fill:'var(--warm-gray)'}}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--ink)'}}/><Legend/><Bar dataKey="principal" fill="var(--gold)" name="Principal" stackId="a"/><Bar dataKey="interest" fill="var(--terracotta)" name="Interest" stackId="a"/>{hasEscrow&&<Bar dataKey="escrow" fill="var(--chart-escrow)" name="Escrow" stackId="a"/>}<Bar dataKey="extra" fill="var(--sage)" name="Extra" stackId="a"/></BarChart></ResponsiveContainer></div>
        <div style={s.card}><h3 style={s.sectionTitle}>Balance Over Time</h3><ResponsiveContainer width="100%" height={220}><AreaChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}><defs><linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--gold)" stopOpacity={0.2}/><stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="month" tick={{fontSize:10,fill:'var(--warm-gray)'}}/><YAxis tick={{fontSize:10,fill:'var(--warm-gray)'}}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:'var(--card)',border:'1px solid var(--border)',color:'var(--ink)'}}/><Area type="monotone" dataKey="balance" stroke="var(--gold)" fill="url(#balGrad)" name="Balance"/></AreaChart></ResponsiveContainer></div>
      </div>)}
      <div style={s.card}><h3 style={s.sectionTitle}>Loan Summary</h3><div className="stat-grid-3" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>{[['Monthly Payment',fmt(loan.monthly_payment)],['Payments Made',a.paymentCount],['Months Ahead',a.monthsAhead>0?`${a.monthsAhead} months`:'On track'],['Total Paid',fmt(a.totalPaid)],['Total Principal Paid',fmt(a.totalPrincipalPaid)],['Original Total Interest',fmt(a.originalTotalInterest)]].map(([l,v])=>(<div key={l} style={{padding:'12px',background:'var(--surface)',borderRadius:8}}><div style={{fontSize:11,color:'var(--warm-gray)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{l}</div><div style={{fontSize:18,fontFamily:"'DM Serif Display',serif",marginTop:2,color:'var(--ink)'}}>{v}</div></div>))}</div></div>
    </div>
  );
}
// ─── DOCUMENTS VIEW (CONTAINER-WIDE) ──────────────────────────────────────────
function DocumentsView({loans,navigate}){
  const [docs,setDocs]=useState([]);
  const [allPayments,setAllPayments]=useState([]);
  const [editDoc,setEditDoc]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [paperlessUrl,setPaperlessUrl]=useState('');
  const [paperlessMode,setPaperlessMode]=useState(false);
  const [saving,setSaving]=useState(false);
  const [filterLoan,setFilterLoan]=useState('');
  const [filterType,setFilterType]=useState('');

  const load=()=>{
    authFetch(`${API}/documents`).then(r=>r.json()).then(setDocs).catch(()=>setDocs([]));
    authFetch(`${API}/payments`).then(r=>r.json()).then(setAllPayments).catch(()=>setAllPayments([]));
    authFetch(`${API}/settings`).then(r=>r.json()).then(d=>{
      const url=d.find?.(s=>s.key==='paperless_ngx_url')?.value||'';
      setPaperlessUrl(url);
      setPaperlessMode(!!url);
    }).catch(()=>{});
  };
  useEffect(()=>{load();},[]);

  const savePaperlessUrl=async()=>{
    await authFetch(`${API}/settings`,{method:'POST',body:JSON.stringify({paperless_ngx_url:paperlessUrl})});
    setPaperlessMode(!!paperlessUrl);
    alert('Paperless-NGX URL saved!');
  };

  const startEdit=(doc)=>{
    setEditDoc(doc.id);
    setEditForm({original_name:doc.original_name,description:doc.description||'',payment_id:doc.payment_id||''});
  };
  const saveEdit=async(id)=>{
    setSaving(true);
    await authFetch(`${API}/documents/${id}`,{method:'PUT',body:JSON.stringify({
      original_name:editForm.original_name||undefined,
      description:editForm.description||undefined,
      payment_id:editForm.payment_id?parseInt(editForm.payment_id):null
    })});
    setSaving(false);setEditDoc(null);load();
  };
  const del=async(id)=>{if(!confirm('Delete this document?'))return;await authFetch(`${API}/documents/${id}`,{method:'DELETE'});load();};
  const icon=(name)=>/\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(name)?'🖼️':'📄';

  const filtered=docs.filter(d=>{
    if(filterLoan&&String(d.loan_id)!==filterLoan)return false;
    if(filterType&&d.doc_type!==filterType)return false;
    return true;
  });
  const docTypes=[...new Set(docs.map(d=>d.doc_type).filter(Boolean))];

  return(
    <div>
      <div style={s.pageHeader}><h1 style={s.pageTitle}>📁 Documents</h1><p style={s.pageSub}>All files stored on this server — {docs.length} total</p></div>

      {/* Paperless-NGX Integration */}
      <div style={{...s.card,marginBottom:20,border:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <span style={{fontSize:20}}>🗂️</span>
          <div><div style={{fontWeight:600,color:'var(--ink)'}}>Document Storage Mode</div><div style={{fontSize:12,color:'var(--warm-gray)'}}>Store files locally or link to your Paperless-NGX server</div></div>
        </div>
        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <button style={{...s.btn(paperlessMode?'ghost':'outline'),fontSize:13}} onClick={()=>{setPaperlessMode(false);}}>📂 Local Storage</button>
          <button style={{...s.btn(paperlessMode?'outline':'ghost'),fontSize:13}} onClick={()=>setPaperlessMode(true)}>🗂️ Paperless-NGX</button>
        </div>
        {paperlessMode&&(
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input style={{...s.input,flex:1}} value={paperlessUrl} onChange={e=>setPaperlessUrl(e.target.value)} placeholder="http://your-server:8000 (Paperless-NGX URL)"/>
            <button style={s.btn()} onClick={savePaperlessUrl}>Save URL</button>
            {paperlessUrl&&<a href={paperlessUrl} target="_blank" rel="noreferrer" style={{...s.btn('outline'),textDecoration:'none',whiteSpace:'nowrap',fontSize:13,padding:'9px 16px'}}>Open Paperless ↗</a>}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{...s.card,marginBottom:20}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end'}}>
          <Field label="Filter by Loan">
            <select style={{...s.input,width:180}} value={filterLoan} onChange={e=>setFilterLoan(e.target.value)}>
              <option value="">All Loans</option>
              {loans.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Filter by Type">
            <select style={{...s.input,width:150}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {docTypes.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <button style={s.btn('ghost')} onClick={()=>{setFilterLoan('');setFilterType('');}}>Clear</button>
        </div>
      </div>

      {/* Documents table */}
      <div style={s.card}>
        <h3 style={s.sectionTitle}>All Documents ({filtered.length})</h3>
        {filtered.length===0?<p style={{color:'var(--warm-gray)',fontSize:13}}>No documents found.</p>:(
          <div style={{overflowX:'auto'}}>
            <table style={s.table}>
              <thead><tr>
                <th style={s.th}>File</th>
                <th style={s.th}>Type</th>
                <th style={s.th}>Loan</th>
                <th style={s.th}>Linked Payment</th>
                <th style={s.th}>Uploaded</th>
                <th style={s.th}></th>
              </tr></thead>
              <tbody>{filtered.map(d=>(
                <tr key={d.id}>
                  <td style={s.td}>
                    {editDoc===d.id?(
                      <div style={{display:'flex',flexDirection:'column',gap:6}}>
                        <input style={{...s.input,fontSize:12}} value={editForm.original_name} onChange={e=>setEditForm(f=>({...f,original_name:e.target.value}))} placeholder="File name"/>
                        <input style={{...s.input,fontSize:12}} value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} placeholder="Description"/>
                      </div>
                    ):(
                      paperlessMode&&paperlessUrl?(
                        <a href={`${paperlessUrl}/documents?search=${encodeURIComponent(d.original_name)}`} target="_blank" rel="noreferrer" style={{color:'var(--gold)',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>{icon(d.original_name)} {d.description||d.original_name} ↗</a>
                      ):(
                        <a href={`/statements/${d.filename}`} target="_blank" rel="noreferrer" style={{color:'var(--gold)',textDecoration:'none',display:'flex',alignItems:'center',gap:6}}>{icon(d.original_name)} {d.description||d.original_name}</a>
                      )
                    )}
                  </td>
                  <td style={s.td}><span style={s.badge('blue')}>{d.doc_type}</span></td>
                  <td style={s.td}><span style={{color:'var(--warm-gray)',fontSize:12}}>{d.loan_name||'—'}</span></td>
                  <td style={s.td}>
                    {editDoc===d.id?(
                      <select style={{...s.input,fontSize:12}} value={editForm.payment_id} onChange={e=>setEditForm(f=>({...f,payment_id:e.target.value}))}>
                        <option value="">No payment link</option>
                        {allPayments.filter(p=>!d.loan_id||p.loan_id===d.loan_id).map(p=>(
                          <option key={p.id} value={p.id}>{p.loan_name} – {fmtDate(p.payment_date)} – {fmt(p.total_payment)}</option>
                        ))}
                      </select>
                    ):(
                      d.payment_date?(
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:12}}>{fmtDate(d.payment_date)}{d.statement_month?` (${d.statement_month})`:''}</span>
                          <button style={{background:'none',border:'1px solid var(--border)',borderRadius:4,fontSize:10,color:'var(--gold)',cursor:'pointer',padding:'2px 6px'}} onClick={()=>navigate('loan-payments',d.loan_id)}>→ View</button>
                        </div>
                      ):<span style={{color:'var(--warm-gray)',fontSize:12}}>—</span>
                    )}
                  </td>
                  <td style={s.td}><span style={{fontSize:12}}>{new Date(d.uploaded_at).toLocaleDateString()}</span></td>
                  <td style={s.td}>
                    <div style={{display:'flex',gap:6}}>
                      {editDoc===d.id?(
                        <>
                          <button style={s.btn('sm')} onClick={()=>saveEdit(d.id)} disabled={saving}>{saving?'…':'Save'}</button>
                          <button style={s.btn('ghost')} onClick={()=>setEditDoc(null)}>Cancel</button>
                        </>
                      ):(
                        <>
                          <button style={s.btn('sm')} onClick={()=>startEdit(d)}>Edit</button>
                          <button style={{...s.btn('sm'),background:'#FEF3F0',color:'var(--terracotta)'}} onClick={()=>del(d.id)}>Del</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App(){
  const [authed,setAuthed]=useState(!!localStorage.getItem('miq-token'));
  const [username,setUsername]=useState(localStorage.getItem('miq-user')||'');
  const [view,setView]=useState('dashboard');
  const [viewLoanId,setViewLoanId]=useState(null); // which loan is selected for sub-views
  const [viewBillCatId,setViewBillCatId]=useState(null);
  const [loans,setLoans]=useState([]);
  const [loanData,setLoanData]=useState({}); // {[loanId]: {analytics, payments}}
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [theme,setTheme]=useState(()=>localStorage.getItem('payoffiq-theme')||'light');

  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme===('light')?'':theme);localStorage.setItem('payoffiq-theme',theme);},[theme]);

  const loadLoans=useCallback(async()=>{
    const r=await authFetch(`${API}/loans`);
    if(r.status===401){logout();return[];}
    const d=await r.json();setLoans(d);return d;
  },[]);

  const loadLoanData=useCallback(async(loan)=>{
    const[a,p]=await Promise.all([
      authFetch(`${API}/loans/${loan.id}/analytics`).then(r=>r.json()),
      authFetch(`${API}/loans/${loan.id}/payments`).then(r=>r.json())
    ]);
    setLoanData(prev=>({...prev,[loan.id]:{analytics:a,payments:p}}));
    return{analytics:a,payments:p};
  },[]);

  useEffect(()=>{if(authed){loadLoans().then(d=>{d.forEach(loan=>loadLoanData(loan));});};},[authed]);

  const refreshLoan=useCallback(async(loanId)=>{
    const allLoans=await loadLoans();
    const loan=allLoans.find(l=>l.id===loanId);
    if(loan)await loadLoanData(loan);
  },[loadLoans,loadLoanData]);

  const logout=()=>{localStorage.removeItem('miq-token');localStorage.removeItem('miq-user');setAuthed(false);setUsername('');setLoans([]);setLoanData({});};
  const onLogin=(u)=>{setAuthed(true);setUsername(u);};

  // navigate(view, loanId?, billCatId?)
  const navigate=(id,loanId=null,billCatId=null)=>{
    setView(id);
    if(loanId)setViewLoanId(loanId);
    if(billCatId)setViewBillCatId(billCatId);
    setSidebarOpen(false);
  };

  // Handle password reset URLs
  const resetToken=new URLSearchParams(window.location.search).get('token')||(window.location.hash.includes('token=')?new URLSearchParams(window.location.hash.split('?')[1]).get('token'):null);
  if(resetToken||window.location.pathname==='/reset-password')return<ResetPasswordPage token={resetToken||''} onDone={()=>{window.history.replaceState({},'','/');setAuthed(false);}}/>;
  if(!authed)return<LoginPage onLogin={onLogin}/>;

  // Current selected loan for single-loan views
  const selectedLoan=loans.find(l=>l.id===viewLoanId)||loans[0]||null;
  const selectedLoanData=selectedLoan?loanData[selectedLoan.id]:{};

  // Group loans by type for sidebar
  const LOAN_TYPE_ORDER=['mortgage','arm','heloc','auto','personal'];
  const loansByType={};
  loans.forEach(l=>{
    if(!loansByType[l.loan_type])loansByType[l.loan_type]=[];
    loansByType[l.loan_type].push(l);
  });

  const isLoanView=view==='loan-dashboard'||view==='loan-payments'||view==='loan-calculator'||view==='loan-escrow'||view==='loan-arm';
  const currentLoan=isLoanView?selectedLoan:null;

  return(
    <div style={s.app}>
      <button className="hamburger" onClick={()=>setSidebarOpen(o=>!o)} aria-label="Toggle menu">{sidebarOpen?'✕':'☰'}</button>
      <div className={`sidebar-overlay${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)}/>

      {/* ── SIDEBAR ── */}
      <div className={`sidebar${sidebarOpen?' open':''}`} style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoTitle}>PayoffIQ</div>
          <div style={s.logoSub}>Loan Manager</div>
          {username&&<div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:6}}>👤 {username}</div>}
        </div>

        {/* General */}
        <div style={s.navGroup}>General</div>
        <div style={s.navItem(view==='dashboard',null)} onClick={()=>navigate('dashboard')}>
          <span>📊</span><span>Dashboard</span>
        </div>
        <div style={s.navItem(view==='documents',null)} onClick={()=>navigate('documents')}>
          <span>📁</span><span>Documents</span>
        </div>

        {/* Loans — grouped by type */}
        {LOAN_TYPE_ORDER.filter(type=>loansByType[type]).map(type=>{
          const lt=loanTypeInfo(type);
          return(
            <div key={type}>
              <div style={s.navDivider}/>
              <div style={s.navGroup}>{lt.icon} {lt.label}{loansByType[type].length>1?'s':''}</div>
              {loansByType[type].map(loan=>{
                const isActive=viewLoanId===loan.id;
                const subActive=isLoanView&&isActive;
                return(
                  <div key={loan.id}>
                    {/* Loan header — click to go to its dashboard */}
                    <div style={{...s.navItem(subActive&&view==='loan-dashboard',lt.color||null),paddingLeft:16}} onClick={()=>{setViewLoanId(loan.id);navigate('loan-dashboard',loan.id);}}>
                      <span style={{fontSize:12}}>{lt.icon}</span>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{loan.name}</span>
                    </div>
                    {/* Sub-nav only shows when this loan is selected */}
                    {isActive&&(
                      <div style={{paddingLeft:8}}>
                        <div style={{...s.navItem(view==='loan-payments'),paddingLeft:24}} onClick={()=>navigate('loan-payments',loan.id)}>
                          <span>💳</span><span>Payments</span>
                        </div>
                        <div style={{...s.navItem(view==='loan-calculator'),paddingLeft:24}} onClick={()=>navigate('loan-calculator',loan.id)}>
                          <span>🧮</span><span>Calculator</span>
                        </div>
                        {lt.hasEscrow&&<div style={{...s.navItem(view==='loan-escrow'),paddingLeft:24}} onClick={()=>navigate('loan-escrow',loan.id)}>
                          <span>🏛️</span><span>Escrow</span>
                        </div>}
                        {loan.loan_type==='arm'&&<div style={{...s.navItem(view==='loan-arm'),paddingLeft:24}} onClick={()=>navigate('loan-arm',loan.id)}>
                          <span>📈</span><span>ARM Rates</span>
                        </div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Household Bills */}
        <div style={s.navDivider}/>
        <div style={s.navGroup}>💡 Household</div>
        <div style={s.navItem(view==='bills'&&!viewBillCatId,null)} onClick={()=>{setViewBillCatId(null);navigate('bills');}}>
          <span>💡</span><span>All Bills</span>
        </div>

        {/* Management */}
        <div style={s.navDivider}/>
        <div style={s.navGroup}>Account</div>
        <div style={s.navItem(view==='loans-manager',null)} onClick={()=>navigate('loans-manager')}>
          <span>🏠</span><span>Manage Loans</span>
        </div>
        <div style={s.navItem(view==='settings',null)} onClick={()=>navigate('settings')}>
          <span>⚙️</span><span>Settings</span>
        </div>

        {/* GitHub at bottom */}
        <div style={{marginTop:'auto',borderTop:'1px solid rgba(255,255,255,0.08)',padding:'8px 0 4px'}}>
          <a href="https://github.com/JonGaydos/payoffiq" target="_blank" rel="noreferrer"
            style={s.githubLink}
            onMouseOver={e=>e.currentTarget.style.color='rgba(255,255,255,0.65)'}
            onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,0.35)'}>
            <span>⬡</span><span>GitHub / Get Help</span>
          </a>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="main-content" style={s.main}>
        {view==='dashboard'&&<Dashboard loans={loans} navigate={navigate}/>}
        {view==='documents'&&<DocumentsView loans={loans} navigate={navigate}/>}
        {view==='bills'&&<BillsView initialCatId={viewBillCatId}/>}
        {view==='loans-manager'&&<LoansManager loans={loans} onRefresh={loadLoans} onSelect={l=>{setViewLoanId(l.id);loadLoanData(l).then(()=>navigate('loan-dashboard',l.id));}}/>}
        {view==='settings'&&<Settings theme={theme} setTheme={setTheme} onLogout={logout}/>}
        {isLoanView&&selectedLoan&&(()=>{
          const ld=loanData[selectedLoan.id]||{};
          const lt=loanTypeInfo(selectedLoan.loan_type);
          return(
            <>
              {view==='loan-dashboard'&&<LoanDashboard loan={selectedLoan} analytics={ld.analytics} payments={ld.payments||[]}/>}
              {view==='loan-payments'&&<PaymentsView loan={selectedLoan} payments={ld.payments||[]} onRefresh={()=>refreshLoan(selectedLoan.id)} onNavigateToDocuments={()=>navigate('documents')}/>}
              {view==='loan-calculator'&&<Calculator loan={selectedLoan}/>}
              {view==='loan-escrow'&&lt.hasEscrow&&<EscrowView loan={selectedLoan}/>}
              {view==='loan-arm'&&selectedLoan.loan_type==='arm'&&<ARMRateManager loan={selectedLoan} onUpdate={()=>refreshLoan(selectedLoan.id)}/>}
            </>
          );
        })()}
        {isLoanView&&!selectedLoan&&<div style={s.card}><p style={{color:'var(--warm-gray)'}}>No loan selected. <button style={{background:'none',border:'none',color:'var(--gold)',cursor:'pointer',fontSize:14}} onClick={()=>navigate('loans-manager')}>Add a loan →</button></p></div>}
      </div>
    </div>
  );
}

import { useMemo,useState } from 'react'
import { Link,useSearchParams } from 'react-router-dom'
import { Building2,Landmark,ShieldCheck,Users } from 'lucide-react'
import { supabase,configured } from '../lib/supabase'

const PORTALS={
 lgu:{title:'LGU User',sub:'Submit city / municipal reports',icon:Building2,register:'LGU Focal Registration'},
 pswdo:{title:'PSWDO User',sub:'Review LGU reports & consolidate',icon:ShieldCheck,register:'PSWDO Account Registration'},
 viewer:{title:'DSWD / PDRRMO',sub:'View finalized Situation Reports',icon:Landmark,register:'DSWD / PDRRMO Viewer Registration'}
}

export function Login(){
 const [search]=useSearchParams()
 const initial=PORTALS[search.get('portal')]?search.get('portal'):'lgu'
 const [portal,setPortal]=useState(initial),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false)
 async function submit(e){
  e.preventDefault();setError('')
  if(!configured)return setError('Supabase is not configured. Check your .env values.')
  setLoading(true)
  try{
   const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
   if(error)throw error
   if(!data?.session)throw new Error('No login session was returned.')
   window.location.replace('/')
  }catch(err){setError(err?.message||'Unable to sign in.');setLoading(false)}
 }
 const signupText=portal==='lgu'?'Create LGU focal account':portal==='pswdo'?'Create PSWDO account':'Create DSWD / PDRRMO viewer account'
 return <AuthShell><form className="auth-card" onSubmit={submit}>
  <div className="auth-title"><span className="eyebrow">Secure access</span><h2>Sign in to DROMIC</h2><p>Choose the account type that was assigned to you, then enter your email and password.</p></div>
  <PortalChoice portal={portal} setPortal={setPortal}/>
  <label>Email<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {error&&<div className="alert red">{error}</div>}
  <button className="btn primary login-btn" disabled={loading}>{loading?'Signing in…':'Sign in'}</button>
  <div className="auth-register-link"><span>Need an account?</span> <Link to={`/register?portal=${portal}`}>{signupText}</Link></div>
  <small className="muted">LGU accounts require PSWDO approval. PSWDO accounts require System Administrator authorization. DSWD/PDRRMO viewer accounts are read-only and do not enter the LGU approval queue.</small>
 </form></AuthShell>
}

export function Register(){
 const [search,setSearch]=useSearchParams()
 const initial=PORTALS[search.get('portal')]?search.get('portal'):'lgu'
 const [portal,setPortalState]=useState(initial)
 const [form,setForm]=useState({full_name:'',email:'',contact_number:'',password:'',office_position:'',requested_lgu_name:'',institution:'DSWD'}),[msg,setMsg]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false)
 function setPortal(id){setPortalState(id);setSearch({portal:id});setMsg('');setError('')}
 const details=useMemo(()=>{
  if(portal==='lgu')return {eyebrow:'LGU focal account',title:'Request LGU reporting access',desc:'For city/municipal focal persons. PSWDO verifies the focal person and assigns the official LGU before reporting access is activated.',button:'Submit to PSWDO for approval'}
  if(portal==='pswdo')return {eyebrow:'PSWDO institutional account',title:'Request PSWDO access',desc:'For Provincial Social Welfare and Development Office personnel. A System Administrator must authorize the PSWDO role before provincial operations access is activated.',button:'Submit PSWDO account request'}
  return {eyebrow:'Authorized viewer account',title:'Create DSWD / PDRRMO viewer access',desc:'For authorized DSWD or PDRRMO personnel. Viewer accounts are read-only and do not pass through the LGU focal approval queue.',button:'Create viewer account'}
 },[portal])
 async function submit(e){
  e.preventDefault();setMsg('');setError('')
  if(!configured)return setError('Configure Supabase first.')
  setLoading(true)
  const metadata={full_name:form.full_name,office_position:form.office_position,contact_number:form.contact_number,registration_type:portal}
  if(portal==='lgu')metadata.requested_lgu_name=form.requested_lgu_name
  if(portal==='viewer')metadata.institution=form.institution
  const {error}=await supabase.auth.signUp({email:form.email.trim(),password:form.password,options:{data:metadata}})
  if(error)setError(error.message)
  else if(portal==='lgu')setMsg('Registration received. PSWDO must verify your focal account and assign your LGU before you can submit reports.')
  else if(portal==='pswdo')setMsg('PSWDO account request received. A System Administrator must authorize your provincial role before access is activated.')
  else setMsg(`${form.institution} viewer account created. If email confirmation is enabled in Supabase, confirm your email first, then sign in to the DSWD / PDRRMO workspace.`)
  setLoading(false)
 }
 return <AuthShell><form className="auth-card" onSubmit={submit}>
  <div className="auth-title"><span className="eyebrow">{details.eyebrow}</span><h2>{details.title}</h2><p>{details.desc}</p></div>
  <PortalChoice portal={portal} setPortal={setPortal}/>
  <label>Full name<input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label>
  <label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
  <label>Contact number<input type="tel" inputMode="tel" required placeholder="e.g., 0917 123 4567" value={form.contact_number} onChange={e=>setForm({...form,contact_number:e.target.value})}/></label>
  <label>Office / Position<input required placeholder={portal==='lgu'?'e.g., MSWDO / MDRRMO Focal':portal==='pswdo'?'e.g., Social Welfare Officer / Disaster Focal':'e.g., DRMD Staff / Operations Officer'} value={form.office_position} onChange={e=>setForm({...form,office_position:e.target.value})}/></label>
  {portal==='lgu'&&<label>City / Municipality represented<input required placeholder="e.g., Lingayen" value={form.requested_lgu_name} onChange={e=>setForm({...form,requested_lgu_name:e.target.value})}/></label>}
  {portal==='viewer'&&<label>Agency<select value={form.institution} onChange={e=>setForm({...form,institution:e.target.value})}><option value="DSWD">DSWD</option><option value="PDRRMO">PDRRMO</option></select></label>}
  <label>Password<input type="password" minLength="8" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
  {error&&<div className="alert red">{error}</div>}{msg&&<div className="alert blue">{msg}</div>}
  <button className="btn primary" disabled={loading}>{loading?'Submitting…':details.button}</button>
  <small><Link to={`/login?portal=${portal}`}>Back to sign in</Link></small>
 </form></AuthShell>
}

function PortalChoice({portal,setPortal}){return <div className="portal-choice">{Object.entries(PORTALS).map(([id,p])=>{const I=p.icon;return <button type="button" key={id} className={portal===id?'active':''} onClick={()=>setPortal(id)}><I size={18}/><span><b>{p.title}</b><small>{p.sub}</small></span></button>})}</div>}

function AuthShell({children}){return <div className="auth-page"><div className="auth-hero"><div className="gov-mark"><div className="seal big">DR</div><div><span>Republic of the Philippines</span><b>Province of Pangasinan</b></div></div><h1>DROMIC Disaster Reporting & Consolidation System</h1><p>One secure provincial workspace for LGU submission, PSWDO validation, automatic consolidation and official Situation Reports.</p><div className="hero-points"><span><Users size={14}/> Centralized LGU reporting</span><span><ShieldCheck size={14}/> Role-based access</span><span><Landmark size={14}/> PSWDO-led validation</span></div></div>{children}<footer className="auth-footer"><b>Provincial DROMIC Disaster Reporting & Consolidation System</b><span>Provincial Social Welfare and Development Office • Province of Pangasinan</span><span>In support of DSWD disaster response and information management</span><small>Developed by ZNBC • © 2026 Province of Pangasinan</small></footer></div>}

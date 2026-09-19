import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'
import { ROLE_LABELS } from '../lib/constants'

export default function Admin(){
 const [profiles,setProfiles]=useState([]),[lgus,setLgus]=useState([]),[incidents,setIncidents]=useState([]),[cycles,setCycles]=useState([]),[logs,setLogs]=useState([])
 const [drafts,setDrafts]=useState({}),[saving,setSaving]=useState({}),[notice,setNotice]=useState('')
 const [form,setForm]=useState({name:'',type:'Typhoon',start_date:new Date().toISOString().slice(0,10),description:''})
 const [cycle,setCycle]=useState({incident_id:'',sitrep_number:1,cutoff_at:'',deadline_at:''})
 useEffect(()=>{load()},[])
 async function load(){
  const [{data:p,error:pe},{data:l},{data:i},{data:c},{data:a}]=await Promise.all([
   supabase.from('profiles').select('*').order('created_at',{ascending:false}),
   supabase.from('lgus').select('*').order('name'),
   supabase.from('incidents').select('*').order('start_date',{ascending:false}),
   supabase.from('reporting_cycles').select('*,incidents(name)').order('cutoff_at',{ascending:false}).limit(100),
   supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(50)
  ])
  if(pe){setNotice(`Could not load users: ${pe.message}`);return}
  setProfiles(p||[]);setLgus(l||[]);setIncidents(i||[]);setCycles(c||[]);setLogs(a||[])
  const next={};(p||[]).forEach(x=>{next[x.id]={role:x.role,lgu_id:x.lgu_id||'',approved:!!x.approved}});setDrafts(next)
 }
 function edit(id,patch){setDrafts(d=>({...d,[id]:{...d[id],...patch}}));setNotice('')}
 async function saveUser(p){
  const d=drafts[p.id];if(!d)return
  if(d.role==='lgu'&&d.approved&&!d.lgu_id){setNotice(`Assign an LGU before approving ${p.full_name}.`);return}
  setSaving(s=>({...s,[p.id]:true}));setNotice('')
  const {error}=await supabase.rpc('admin_update_profile',{p_user_id:p.id,p_role:d.role,p_lgu_id:d.role==='lgu'?(d.lgu_id||null):null,p_approved:d.approved})
  setSaving(s=>({...s,[p.id]:false}))
  if(error){setNotice(error.message);return}
  setNotice(`${p.full_name}'s access was updated successfully.`);await load()
 }
 function changed(p){const d=drafts[p.id];return !!d&&(d.role!==p.role||(d.lgu_id||'')!==(p.lgu_id||'')||d.approved!==!!p.approved)}
 async function createIncident(e){e.preventDefault();const {data,error}=await supabase.from('incidents').insert({...form,status:'ACTIVE'}).select().single();if(error)return alert(error.message);setCycle(x=>({...x,incident_id:data.id}));setForm({...form,name:'',description:''});load()}
 async function createCycle(e){e.preventDefault();const payload={incident_id:cycle.incident_id,sitrep_number:Number(cycle.sitrep_number),reporting_date:cycle.cutoff_at.slice(0,10),cutoff_at:new Date(cycle.cutoff_at).toISOString(),deadline_at:cycle.deadline_at?new Date(cycle.deadline_at).toISOString():null,status:'OPEN'};const {error}=await supabase.from('reporting_cycles').insert(payload);if(error)alert(error.message);else{setCycle({...cycle,sitrep_number:Number(cycle.sitrep_number)+1,cutoff_at:'',deadline_at:''});load()}}
 return <>
  <div className="page-head"><div><span className="eyebrow">System Administration</span><h1>Accounts, Incidents & Reporting Cycles</h1><p>Configuration here directly controls LGU access and SitRep cut-offs.</p></div></div>
  {notice&&<div className={`alert ${notice.includes('successfully')?'green':'orange'}`} style={{marginBottom:16}}>{notice}</div>}
  <div className="split">
   <section className="panel"><h2>Create incident</h2><form className="stack" onSubmit={createIncident}><label>Incident name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Typhoon</option><option>Habagat</option><option>Flooding</option><option>Earthquake</option><option>Fire</option><option>Combined Weather Event</option><option>Other</option></select></label><label>Start date<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><button className="btn primary">Create active incident</button></form>
   <h2>Create reporting cycle</h2><form className="stack" onSubmit={createCycle}><label>Incident<select required value={cycle.incident_id} onChange={e=>setCycle({...cycle,incident_id:e.target.value})}><option value="">Select incident</option>{incidents.filter(i=>i.status==='ACTIVE').map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>SitRep number<input type="number" min="1" required value={cycle.sitrep_number} onChange={e=>setCycle({...cycle,sitrep_number:e.target.value})}/></label><label>Reporting cut-off<input type="datetime-local" required value={cycle.cutoff_at} onChange={e=>setCycle({...cycle,cutoff_at:e.target.value})}/></label><label>LGU deadline<input type="datetime-local" value={cycle.deadline_at} onChange={e=>setCycle({...cycle,deadline_at:e.target.value})}/></label><button className="btn primary">Open reporting cycle</button></form>
   </section>
   <section className="panel"><div className="panel-head"><div><h2>Institutional account roles</h2><p>System Administrator assigns PSWDO, DSWD/PDRRMO or administrator roles. LGU focal approval is handled from the dedicated LGU Approvals page.</p></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>LGU</th><th>Approved</th><th></th></tr></thead><tbody>{profiles.map(p=>{const d=drafts[p.id]||{role:p.role,lgu_id:p.lgu_id||'',approved:!!p.approved};return <tr key={p.id}><td><b>{p.full_name}</b><small>{p.email}</small><small>{p.requested_lgu_name||''}</small></td><td><select value={d.role} onChange={e=>edit(p.id,{role:e.target.value,lgu_id:e.target.value==='lgu'?d.lgu_id:''})}>{Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td><select value={d.lgu_id||''} disabled={d.role!=='lgu'} onChange={e=>edit(p.id,{lgu_id:e.target.value})}><option value="">— Select LGU —</option>{lgus.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></td><td>{d.role==='lgu'?<span className={`badge ${d.approved?'green':'yellow'}`}>{d.approved?'Approved by PSWDO':'Use LGU Approvals'}</span>:<span className="badge green">Automatic</span>}</td><td><button className="btn primary" disabled={!changed(p)||saving[p.id]} onClick={()=>saveUser(p)}>{saving[p.id]?'Saving…':'Save changes'}</button></td></tr>})}</tbody></table></div></section>
  </div>
  <section className="panel"><div className="panel-head"><div><h2>Reporting cycles</h2><p>Configured count is database-driven; no LGU denominator is hard-coded.</p></div></div><div className="table-wrap"><table><thead><tr><th>Incident</th><th>SitRep</th><th>Cut-off</th><th>Deadline</th><th>Status</th></tr></thead><tbody>{cycles.map(c=><tr key={c.id}><td>{c.incidents?.name}</td><td>{c.sitrep_number}</td><td>{new Date(c.cutoff_at).toLocaleString()}</td><td>{c.deadline_at?new Date(c.deadline_at).toLocaleString():'—'}</td><td>{c.status}</td></tr>)}</tbody></table></div></section>
  <section className="panel"><div className="panel-head"><div><h2>Recent audit trail</h2><p>Latest 50 major system actions.</p></div></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>LGU</th><th>Details</th></tr></thead><tbody>{logs.map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td><b>{a.action}</b></td><td>{a.entity_type}</td><td>{a.lgu_id||'—'}</td><td><small>{JSON.stringify(a.details||{})}</small></td></tr>)}</tbody></table></div></section>
 </>
}

import {useEffect,useState} from 'react'
import {Shield,Trash2,UserCheck} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {ROLE_LABELS} from '../lib/constants'

export default function Admin({profile}){
 const [profiles,setProfiles]=useState([]),[lgus,setLgus]=useState([]),[drafts,setDrafts]=useState({}),[saving,setSaving]=useState({}),[notice,setNotice]=useState('')
 useEffect(()=>{load()},[])
 async function load(){
  const [{data:p,error},{data:l}]=await Promise.all([supabase.from('profiles').select('*').order('created_at',{ascending:false}),supabase.from('lgus').select('*').order('name')])
  if(error)return setNotice(error.message)
  setProfiles(p||[]);setLgus(l||[]);const d={};(p||[]).forEach(x=>d[x.id]={role:x.role,lgu_id:x.lgu_id||'',approved:!!x.approved,emergency_operator:!!x.emergency_operator});setDrafts(d)
 }
 function edit(id,patch){setDrafts(d=>({...d,[id]:{...d[id],...patch}}))}
 async function saveUser(p){const d=drafts[p.id];if(d.role==='lgu'&&d.approved&&!d.lgu_id)return setNotice('Assign an LGU before approval.');setSaving(s=>({...s,[p.id]:true}));const {error}=await supabase.rpc('admin_update_profile_v6',{p_user_id:p.id,p_role:d.role,p_lgu_id:d.role==='lgu'?(d.lgu_id||null):null,p_approved:d.approved,p_emergency_operator:!!d.emergency_operator});setSaving(s=>({...s,[p.id]:false}));if(error)return setNotice(error.message);setNotice('Account access updated.');load()}
 async function removeUser(p){if(p.id===profile?.id)return setNotice('You cannot delete the account you are currently using.');if(!confirm(`Delete ${p.full_name}? This permanently removes login access. Historical report attribution is retained.`))return;const {error}=await supabase.rpc('admin_delete_account_v6',{p_user_id:p.id});if(error)return setNotice(error.message);setNotice('Account deleted.');load()}
 return <><div className="page-head"><div><span className="eyebrow">System Administration</span><h1>Account Management</h1><p>Manage institutional access separately from incidents and reporting operations.</p></div></div>
 {notice&&<div className="alert blue">{notice}</div>}
 <section className="panel glass-panel"><div className="panel-head"><div><h2><Shield size={18}/> Institutional accounts</h2><p>Deactivate access whenever possible. Permanent deletion is available to the System Administrator and designated Emergency Operator.</p></div></div>
 <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>LGU</th><th>Access</th><th>Emergency Operator</th><th>Actions</th></tr></thead><tbody>{profiles.map(p=>{const d=drafts[p.id]||{};return <tr key={p.id}><td><b>{p.full_name}</b><small>{p.email}</small></td><td><select value={d.role||p.role} onChange={e=>edit(p.id,{role:e.target.value})}>{Object.entries(ROLE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td><select disabled={(d.role||p.role)!=='lgu'} value={d.lgu_id||''} onChange={e=>edit(p.id,{lgu_id:e.target.value})}><option value="">—</option>{lgus.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></td><td><label className="switch-row"><input type="checkbox" checked={!!d.approved} onChange={e=>edit(p.id,{approved:e.target.checked})}/>{d.approved?'Active':'Inactive'}</label></td><td><label className="switch-row"><input type="checkbox" checked={!!d.emergency_operator} onChange={e=>edit(p.id,{emergency_operator:e.target.checked})}/>{d.emergency_operator?'Enabled':'Off'}</label></td><td><div className="row-actions"><button className="btn primary" disabled={saving[p.id]} onClick={()=>saveUser(p)}><UserCheck size={15}/>Save</button>{(profile?.role==='admin'||profile?.emergency_operator)&&<button className="btn danger" onClick={()=>removeUser(p)}><Trash2 size={15}/>Delete</button>}</div></td></tr>})}</tbody></table></div></section></>
}
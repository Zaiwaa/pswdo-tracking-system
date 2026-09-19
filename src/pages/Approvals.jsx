import { useEffect,useMemo,useState } from 'react'
import { CheckCircle2,Clock3,Search,ShieldCheck,XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Approvals(){
  const [rows,setRows]=useState([]),[lgus,setLgus]=useState([]),[drafts,setDrafts]=useState({})
  const [loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('PENDING')
  useEffect(()=>{load()},[])
  async function load(){
    setLoading(true);setNotice('')
    const [{data:r,error},{data:l}]=await Promise.all([
      supabase.rpc('pswdo_list_lgu_registrations'),
      supabase.from('lgus').select('id,name').order('name')
    ])
    if(error){setNotice(error.message);setRows([])} else {
      setRows(r||[])
      const d={};(r||[]).forEach(x=>d[x.id]={lgu_id:x.lgu_id||'',note:''});setDrafts(d)
    }
    setLgus(l||[]);setLoading(false)
  }
  const visible=useMemo(()=>rows.filter(r=>{
    const statusOk=filter==='ALL'||(filter==='PENDING'?!r.approved:r.approved)
    const q=query.toLowerCase();return statusOk&&(!q||`${r.full_name} ${r.email} ${r.requested_lgu_name||''}`.toLowerCase().includes(q))
  }),[rows,query,filter])
  function edit(id,patch){setDrafts(d=>({...d,[id]:{...d[id],...patch}}))}
  async function decide(row,approved){
    const d=drafts[row.id]||{}
    if(approved&&!d.lgu_id){setNotice('Select the LGU assignment before approving this focal account.');return}
    const {error}=await supabase.rpc('pswdo_review_lgu_registration',{p_user_id:row.id,p_lgu_id:d.lgu_id||null,p_approved:approved,p_note:d.note||null})
    if(error){setNotice(error.message);return}
    setNotice(approved?`${row.full_name} was approved successfully.`:`${row.full_name}'s LGU access was updated.`);await load()
  }
  return <>
    <div className="page-head"><div><span className="eyebrow">PSWDO account control</span><h1>LGU Focal Approvals</h1><p>Only LGU focal registrations require PSWDO approval. DSWD, PDRRMO and PSWDO institutional accounts are provisioned separately and do not enter this queue.</p></div></div>
    {notice&&<div className={`alert ${notice.includes('successfully')?'green':'orange'}`}>{notice}</div>}
    <div className="approval-summary">
      <div><Clock3/><span>Pending</span><b>{rows.filter(r=>!r.approved).length}</b></div>
      <div><ShieldCheck/><span>Approved</span><b>{rows.filter(r=>r.approved).length}</b></div>
    </div>
    <section className="panel">
      <div className="panel-head approvals-tools"><div><h2>LGU registrations</h2><p>Verify the focal person and assign the correct city/municipality before approval.</p></div><div className="filters"><div className="searchbox compact"><Search size={16}/><input placeholder="Search focal…" value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="PENDING">Pending only</option><option value="APPROVED">Approved</option><option value="ALL">All LGU accounts</option></select></div></div>
      {loading?<div className="loading">Loading registrations…</div>:<div className="table-wrap"><table className="approval-table"><thead><tr><th>Focal person</th><th>Requested LGU</th><th>Assign LGU</th><th>PSWDO note</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(r=>{const d=drafts[r.id]||{};return <tr key={r.id}><td><b>{r.full_name}</b><small>{r.email}</small><small>{r.office_position||'No office/position supplied'}</small></td><td>{r.requested_lgu_name||'—'}</td><td><select value={d.lgu_id||''} onChange={e=>edit(r.id,{lgu_id:e.target.value})}><option value="">Select LGU…</option>{lgus.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></td><td><input className="inline-input" value={d.note||''} onChange={e=>edit(r.id,{note:e.target.value})} placeholder="Optional note"/></td><td>{r.approved?<span className="badge green"><CheckCircle2 size={12}/> Approved</span>:<span className="badge yellow"><Clock3 size={12}/> Pending</span>}</td><td><div className="actions">{!r.approved?<button className="btn primary small" onClick={()=>decide(r,true)}><CheckCircle2 size={15}/>Approve</button>:<button className="btn secondary small danger-outline" onClick={()=>decide(r,false)}><XCircle size={15}/>Remove approval</button>}</div></td></tr>})}{!visible.length&&<tr><td colSpan="6" className="empty">No matching LGU registrations.</td></tr>}</tbody></table></div>}
    </section>
  </>
}

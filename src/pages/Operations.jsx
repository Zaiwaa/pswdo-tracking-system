import {useEffect,useState} from 'react'
import {BellRing,CalendarPlus,CloudDownload,Plus} from 'lucide-react'
import {supabase} from '../lib/supabase'

export default function Operations(){
 const [incidents,setIncidents]=useState([]),[notice,setNotice]=useState('')
 const [form,setForm]=useState({name:'',type:'Typhoon',start_date:new Date().toISOString().slice(0,10),description:''})
 const [cycle,setCycle]=useState({incident_id:'',sitrep_number:1,cutoff_at:'',deadline_at:''})
 useEffect(()=>{load()},[])
 async function load(){const {data}=await supabase.from('incidents').select('*').order('start_date',{ascending:false});setIncidents(data||[])}
 async function createIncident(e){e.preventDefault();setNotice('');const {data,error}=await supabase.from('incidents').insert({...form,status:'ACTIVE'}).select().single();if(error)return setNotice(error.message);setCycle(x=>({...x,incident_id:data.id}));setForm({...form,name:'',description:''});setNotice('Incident created. All approved users were notified.');load()}
 async function createCycle(e){e.preventDefault();setNotice('');const payload={incident_id:cycle.incident_id,sitrep_number:Number(cycle.sitrep_number),reporting_date:cycle.cutoff_at.slice(0,10),cutoff_at:new Date(cycle.cutoff_at).toISOString(),deadline_at:cycle.deadline_at?new Date(cycle.deadline_at).toISOString():null,status:'OPEN'};const {error}=await supabase.from('reporting_cycles').insert(payload);if(error)return setNotice(error.message);setCycle({...cycle,sitrep_number:Number(cycle.sitrep_number)+1,cutoff_at:'',deadline_at:''});setNotice('SitRep cycle opened. All approved users were notified.')}
 async function syncBarangays(){
  setNotice('Syncing the July 2026 PSGC Pangasinan barangay masterlist…')
  try{
   const url='https://raw.githubusercontent.com/bendlikeabamboo/barangay-data-repository/main/2026-07-13/barangay_flat.json'
   const res=await fetch(url);if(!res.ok)throw new Error('Could not download PSGC masterlist.')
   const json=await res.json();const rows=(Array.isArray(json)?json:Object.values(json)).filter(x=>String(x.province||x.province_name||'').toLowerCase()==='pangasinan')
   const {data,error}=await supabase.rpc('import_pangasinan_barangays',{p_rows:rows});if(error)throw error
   setNotice(`Barangay masterlist synchronized: ${data?.barangays||0} barangays across ${data?.lgus||0} LGUs.`)
  }catch(e){setNotice(`Barangay sync failed: ${e.message}. You can retry when this device has internet access.`)}
 }
 return <><div className="page-head"><div><span className="eyebrow">PSWDO Operations</span><h1>Incidents & SitRep Cycles</h1><p>PSWDO can open incidents and reporting cycles. Every approved user is notified automatically.</p></div></div>{notice&&<div className={`alert ${notice.includes('failed')||notice.includes('Could')?'red':'blue'}`}>{notice}</div>}
 <div className="split"><section className="panel"><h2><Plus size={18}/> Create incident</h2><form className="stack" onSubmit={createIncident}><label>Incident name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Typhoon</option><option>Habagat</option><option>Flooding</option><option>Earthquake</option><option>Fire</option><option>Combined Weather Event</option><option>Other</option></select></label><label>Start date<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><button className="btn primary"><BellRing size={16}/>Create & notify everyone</button></form></section>
 <section className="panel"><h2><CalendarPlus size={18}/> Open SitRep cycle</h2><form className="stack" onSubmit={createCycle}><label>Incident<select required value={cycle.incident_id} onChange={e=>setCycle({...cycle,incident_id:e.target.value})}><option value="">Select incident</option>{incidents.filter(i=>i.status==='ACTIVE').map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><label>SitRep number<input type="number" min="1" required value={cycle.sitrep_number} onChange={e=>setCycle({...cycle,sitrep_number:e.target.value})}/></label><label>Reporting cut-off<input type="datetime-local" required value={cycle.cutoff_at} onChange={e=>setCycle({...cycle,cutoff_at:e.target.value})}/></label><label>LGU deadline<input type="datetime-local" value={cycle.deadline_at} onChange={e=>setCycle({...cycle,deadline_at:e.target.value})}/></label><button className="btn primary"><BellRing size={16}/>Open cycle & notify everyone</button></form></section></div>
 <section className="panel"><div className="panel-head"><div><h2>Barangay masterlist</h2><p>One-click import of Pangasinan barangays from the July 2026 PSGC masterlist. This replaces the incomplete seed list.</p></div><button className="btn secondary" onClick={syncBarangays}><CloudDownload size={16}/>Sync official barangays</button></div></section></>
}

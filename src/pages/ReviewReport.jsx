import { useEffect,useState } from 'react'
import { useNavigate,useParams } from 'react-router-dom'
import { ArrowLeft,CheckCircle2,Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'
import DromicSummaryTable from '../components/DromicSummaryTable'

export default function ReviewReport(){
 const {id}=useParams(),nav=useNavigate();const [report,setReport]=useState(null),[version,setVersion]=useState(null),[rows,setRows]=useState([]),[issues,setIssues]=useState([]),[remark,setRemark]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{load()},[id])
 async function load(){
  const {data:r}=await supabase.from('reports').select('*,incidents(*),lgus(*),reporting_cycles(*)').eq('id',id).single();setReport(r)
  const {data:v}=await supabase.from('report_versions').select('*').eq('report_id',id).order('version_number',{ascending:false}).limit(1).maybeSingle();setVersion(v)
  if(v){const {data:b}=await supabase.from('report_version_barangays').select('*,barangays(*)').eq('report_version_id',v.id).order('barangay_id');setRows((b||[]).map(x=>({...x,data:x.data_snapshot,barangay:x.barangays,barangay_name:x.barangays?.name})));const {data:val}=await supabase.rpc('validate_report_version',{p_version_id:v.id});setIssues(val||[])}
 }
 async function validate(){
  setBusy(true);setNotice('');const {error}=await supabase.rpc('approve_report_version',{p_version_id:version.id});setBusy(false)
  if(error)return setNotice(error.message)
  setNotice('Validated successfully. This LGU has been added to the current DRAFT PSWDO consolidated report.');await load()
 }
 async function sendBack(){if(!remark.trim())return setNotice('Add a correction remark first.');setBusy(true);const {error}=await supabase.rpc('return_report_for_correction',{p_version_id:version.id,p_remark:remark});setBusy(false);if(error)setNotice(error.message);else nav('/')}
 if(!report||!version)return <div className="loading">Loading submitted version…</div>
 const red=issues.filter(x=>x.severity==='RED')
 return <>
  <div className="page-head"><div><button className="back" onClick={()=>nav(-1)}><ArrowLeft size={16}/>Back</button><span className="eyebrow">PSWDO Validation • LGU Version {version.version_number}</span><h1>{report.lgus?.name}</h1><p>{report.incidents?.name} • Submitted {new Date(version.submitted_at).toLocaleString()}</p></div><StatusBadge status={report.status}/></div>
  {notice&&<div className={`alert ${notice.startsWith('Validated')?'blue':'red'}`}>{notice}</div>}
  <DromicSummaryTable singleLguName={report.lgus?.name} singleBarangays={rows} defaultDetail title="Submitted LGU Report"/>
  <div className="review-grid"><section className="panel"><div className="panel-head"><div><h2>Validation results</h2><p>Check discrepancies before accepting this report into the provincial consolidation.</p></div></div>{issues.length?issues.map((x,i)=><div key={i} className={`validation-line ${String(x.severity).toLowerCase()}`}><b>{x.severity}</b> • {x.barangay_name||'Report'} • {x.message}</div>):<div className="success-box"><CheckCircle2/>No blocking discrepancies detected.</div>}</section>
   <section className="panel correction"><h2>PSWDO action</h2><p>Validate to include this LGU automatically in the current provincial DROMIC report, or return it with a correction note.</p><textarea placeholder="Correction remarks to LGU…" value={remark} onChange={e=>setRemark(e.target.value)}/><div className="actions"><button className="btn secondary danger-outline" disabled={busy} onClick={sendBack}><Undo2 size={16}/>Return for correction</button><button className="btn primary" disabled={busy||red.length>0||['VALIDATED','INCLUDED_IN_SITREP'].includes(report.status)} onClick={validate}><CheckCircle2 size={16}/>{busy?'Validating…':'Validate & add to PSWDO report'}</button></div>{red.length>0&&<small className="danger-text">Resolve {red.length} blocking validation error{red.length>1?'s':''} before this report can be validated.</small>}</section>
  </div>
 </>
}

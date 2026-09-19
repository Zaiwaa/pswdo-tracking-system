import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CalendarClock, CheckCircle2, FilePlus2, FileText, MapPin, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StatusBadge from '../components/StatusBadge'

export default function CurrentReport({ profile }) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [incident, setIncident] = useState(null)
  const [cycle, setCycle] = useState(null)
  const [lgu, setLgu] = useState(null)
  const [report, setReport] = useState(null)
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [profile?.lgu_id])

  async function load() {
    setLoading(true)
    setMessage('')
    const [{ data: l, error: lErr }, { data: i, error: iErr }] = await Promise.all([
      supabase.from('lgus').select('*').eq('id', profile.lgu_id).maybeSingle(),
      supabase.from('incidents').select('*').eq('status', 'ACTIVE').order('start_date', { ascending: false }).limit(1).maybeSingle()
    ])
    if (lErr || iErr) setMessage(lErr?.message || iErr?.message || '')
    setLgu(l || null)
    setIncident(i || null)

    if (!i) {
      setCycle(null); setReport(null); setLoading(false); return
    }

    const { data: c, error: cErr } = await supabase.from('reporting_cycles')
      .select('*').eq('incident_id', i.id).eq('status', 'OPEN')
      .order('cutoff_at', { ascending: true }).limit(1).maybeSingle()
    if (cErr) setMessage(cErr.message)
    setCycle(c || null)

    if (c) {
      const { data: r, error: rErr } = await supabase.from('reports')
        .select('*,reporting_cycles(*),incidents(*),lgus(*)')
        .eq('reporting_cycle_id', c.id).eq('lgu_id', profile.lgu_id).maybeSingle()
      if (rErr) setMessage(rErr.message)
      setReport(r || null)
    } else setReport(null)
    setLoading(false)
  }

  async function createReport() {
    if (!incident || !cycle || !profile?.lgu_id) return
    setCreating(true); setMessage('')
    const { data, error } = await supabase.from('reports').insert({
      incident_id: incident.id,
      reporting_cycle_id: cycle.id,
      lgu_id: profile.lgu_id,
      prepared_by: profile.full_name,
      office_position: profile.office_position,
      reporting_period: `Situation Report No. ${cycle.sitrep_number}`,
      status: 'DRAFT',
      created_by: profile.id
    }).select().single()
    setCreating(false)
    if (error) {
      if (error.code === '23505') {
        await load()
        setMessage('A report already exists for this reporting cycle. Open the current report instead.')
      } else setMessage(error.message)
      return
    }
    nav(`/report/${data.id}`)
  }

  const deadline = useMemo(() => cycle?.deadline_at ? new Date(cycle.deadline_at) : null, [cycle])
  if (loading) return <div className="loading">Preparing your LGU reporting workspace…</div>

  return <>
    <div className="page-head">
      <div>
        <span className="eyebrow">LGU Reporting</span>
        <h1>Create / Current Report</h1>
        <p>Encode only your assigned LGU. Your report is linked automatically to the active incident and SitRep cycle.</p>
      </div>
    </div>

    {message && <div className="alert blue">{message}</div>}

    <section className="report-launch-card">
      <div className="launch-main">
        <div className="launch-kicker"><ShieldCheck size={16}/> Secure LGU assignment</div>
        <h2>{lgu?.name || 'Assigned LGU'}</h2>
        <p className="muted">This LGU is locked to your account and cannot be changed from the report form.</p>

        {!incident ? <div className="launch-empty"><AlertCircle/><div><b>No active incident</b><span>PSWDO must create an active incident before LGUs can prepare a report.</span></div></div> : <>
          <div className="launch-grid">
            <div><span>Active Incident</span><b>{incident.name}</b><small>{incident.type}</small></div>
            <div><span>Reporting Cycle</span><b>{cycle ? `Situation Report No. ${cycle.sitrep_number}` : 'No open cycle'}</b><small>{cycle ? `Cut-off: ${new Date(cycle.cutoff_at).toLocaleString()}` : 'PSWDO must open a reporting cycle.'}</small></div>
            <div><span>Prepared By</span><b>{profile.full_name}</b><small>{profile.office_position || 'LGU Disaster Focal'}</small></div>
            <div><span>Deadline</span><b>{deadline ? deadline.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'}</b><small>{deadline ? deadline.toLocaleDateString() : 'No deadline configured'}</small></div>
          </div>

          {cycle && <div className="launch-action">
            <div>
              <span>Current report status</span>
              {report ? <StatusBadge status={report.status}/> : <b className="no-report">NO REPORT CREATED</b>}
            </div>
            <button className="btn primary big-action" onClick={() => report ? nav(`/report/${report.id}`) : createReport()} disabled={creating}>
              {report ? <FileText size={18}/> : <FilePlus2 size={18}/>} {creating ? 'Creating…' : report ? 'Open Current Report' : 'Start DROMIC Report'}
            </button>
          </div>}
        </>}
      </div>
    </section>

    <section className="panel quick-guide">
      <div className="panel-head"><div><h2>How to accomplish this report</h2><p>The website follows the same DROMIC reporting structure without forcing you to work through hundreds of spreadsheet columns at once.</p></div></div>
      <div className="guide-steps">
        <div><i>1</i><b>Start report</b><span>Incident, SitRep cycle, LGU and preparer are filled automatically.</span></div>
        <div><i>2</i><b>Add affected barangays</b><span>Search and add only barangays with reportable data.</span></div>
        <div><i>3</i><b>Encode DROMIC table</b><span>Fill NOW/CUM, EC, displacement, damaged houses and assistance fields.</span></div>
        <div><i>4</i><b>Review validation</b><span>Correct red errors and review warnings before submitting.</span></div>
        <div><i>5</i><b>Submit to PSWDO</b><span>Your submitted version is locked and appears immediately in provincial monitoring.</span></div>
      </div>
    </section>
  </>
}

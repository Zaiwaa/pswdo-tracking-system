import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computedTotals } from './validators'
const num=v=>Number(v||0)
export function aggregateBarangays(rows=[]){
  const total={}
  for(const row of rows) for(const [k,v] of Object.entries(row.data||{})) if(typeof v==='number'||(!isNaN(Number(v))&&v!=='')) total[k]=num(total[k])+num(v)
  return {...total,...computedTotals(total)}
}
export function exportLGUXlsx({report,barangays,lgu,incident}){
  const rows=barangays.map(b=>({Barangay:b.barangay?.name||b.barangay_name,...b.data,...computedTotals(b.data)}))
  const wb=XLSX.utils.book_new();
  const meta=XLSX.utils.aoa_to_sheet([['Incident',incident?.name||''],['LGU',lgu?.name||''],['Reporting period',report?.reporting_period||''],['Prepared by',report?.prepared_by||''],['Status',report?.status||'']])
  XLSX.utils.book_append_sheet(wb,meta,'Information')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'DROMIC Data')
  XLSX.writeFile(wb,`${lgu?.name||'LGU'}_DROMIC_${report?.report_date||'report'}.xlsx`)
}
export function exportSitRepXlsx({sitrep,incident,entries}){
  const detail=[]; const summary=[]
  for(const entry of entries){
    const total=aggregateBarangays(entry.barangays)
    summary.push({LGU:entry.lgu_name,...total})
    for(const b of entry.barangays) detail.push({LGU:entry.lgu_name,Barangay:b.barangay_name,...b.data,...computedTotals(b.data)})
  }
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Situation Report',sitrep.sitrep_number],['Incident',incident?.name||''],['Cut-off',sitrep.cutoff_at],['Prepared by',sitrep.prepared_by||''],['Generated',new Date().toLocaleString()]]),'Information')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(summary),'LGU Summary')
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(detail),'Barangay Detail')
  XLSX.writeFile(wb,`DROMIC_SitRep_${sitrep.sitrep_number}_${String(incident?.name||'Incident').replace(/[^a-z0-9]+/gi,'_')}.xlsx`)
}
export function exportSitRepPdf({sitrep,incident,entries}){
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'})
  doc.setFontSize(14); doc.text('PROVINCE OF PANGASINAN',14,14); doc.setFontSize(11); doc.text('Provincial Social Welfare and Development Office — DROMIC Situation Report',14,21)
  doc.setFontSize(9); doc.text(`Incident: ${incident?.name||''}`,14,29); doc.text(`SitRep No.: ${sitrep.sitrep_number}    Cut-off: ${new Date(sitrep.cutoff_at).toLocaleString()}    Prepared by: ${sitrep.prepared_by||''}`,14,35)
  const body=entries.map(e=>{const t=aggregateBarangays(e.barangays);return [e.lgu_name,t.affected_families||0,t.affected_persons||0,t.total_displaced_families_now||0,t.total_displaced_persons_now||0,t.damaged_houses_total||0]})
  autoTable(doc,{startY:41,head:[['LGU','Affected Families','Affected Persons','Displaced Families NOW','Displaced Persons NOW','Damaged Houses']],body,styles:{fontSize:7},headStyles:{fillColor:[11,59,102]}})
  const pages=doc.getNumberOfPages(); for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(7);doc.text(`Generated ${new Date().toLocaleString()} • Page ${i} of ${pages}`,14,200)}
  doc.save(`DROMIC_SitRep_${sitrep.sitrep_number}.pdf`)
}
